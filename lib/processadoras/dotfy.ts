import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import {
  AssinaturaWebhookInvalida,
  normalizeStatus,
  type CobrancaPix,
  type DadosCobrancaPix,
  type Pagador,
  type ProcessadoraPagamento,
  type WebhookInterpretado,
} from "../pagamentos";

/**
 * Adaptador da Dotfy (https://app.dotfy.com.br).
 *
 * Tudo aqui foi confirmado contra a API real, não contra documentação:
 *
 *   Base        https://app.dotfy.com.br/api
 *   Auth        Authorization: Bearer vk_live_… (ou vk_test_…)
 *   Criar       POST /api/charges
 *   Consultar   GET  /api/charges/{correlationID}
 *
 * Duas particularidades que quebram a integração se ignoradas:
 *
 * 1. `value` VAI em reais e VOLTA em centavos. Enviamos `value: 1` e a
 *    resposta traz `value: 100`. A loja trabalha em centavos, então dividimos
 *    por 100 na ida. Mandar centavos direto transformaria uma camiseta de
 *    R$ 29,90 numa cobrança de R$ 2.990,00.
 *
 * 2. A criação é ASSÍNCRONA. O POST devolve `status: "QUEUED"` e NÃO traz o
 *    código PIX; o `brCode` só aparece depois, na consulta. Por isso criamos e
 *    então consultamos algumas vezes antes de desistir — e, quando mesmo assim
 *    não vier, devolvemos a cobrança sem código para a tela do pedido tentar
 *    de novo, em vez de estourar e perder o vínculo com a transação.
 *
 * A consulta é SEMPRE por `correlationID`. Consultar pelo `id` devolve
 * "Cobrança não encontrada" — por isso é o correlationID que guardamos em
 * `orders.transaction_hash`.
 */

const BASE_PADRAO = "https://app.dotfy.com.br/api";

/** Quantas vezes consultar a cobrança recém-criada esperando o `brCode`. */
const TENTATIVAS_BRCODE = 5;
const ESPERA_ENTRE_TENTATIVAS_MS = 700;

/** Janela aceita entre o timestamp assinado e agora, contra ataque de replay. */
const TOLERANCIA_ASSINATURA_SEGUNDOS = 5 * 60;

interface CobrancaDotfy {
  id?: string;
  correlationID?: string;
  transactionID?: string | null;
  status?: string;
  value?: number;
  brCode?: string | null;
  qrCodeImage?: string | null;
  paymentLink?: string | null;
  expiresAt?: string | null;
  payer?: { name?: string | null; email?: string | null; phone?: string | null; document?: string | null } | null;
  isPaid?: boolean;
  isExpired?: boolean;
  isActive?: boolean;
}

function espera(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function criarProcessadoraDotfy(): ProcessadoraPagamento {
  const base = (process.env.DOTFY_API_URL ?? BASE_PADRAO).replace(/\/+$/, "");
  const chave = process.env.DOTFY_API_KEY;
  const segredo = process.env.DOTFY_WEBHOOK_SECRET;

  if (!chave) throw new Error("DOTFY_API_KEY não configurada.");
  if (!segredo) throw new Error("DOTFY_WEBHOOK_SECRET não configurada.");

  async function chamar(caminho: string, init?: RequestInit): Promise<unknown> {
    const resposta = await fetch(`${base}${caminho}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${chave}`,
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(init?.headers ?? {}),
      },
      // Chamada de pagamento nunca pode vir de cache.
      cache: "no-store",
    });

    const texto = await resposta.text();
    let json: unknown = null;
    try {
      json = texto ? JSON.parse(texto) : null;
    } catch {
      json = { raw_text: texto };
    }

    if (!resposta.ok) {
      const msg =
        (json as { error?: string } | null)?.error ?? `HTTP ${resposta.status}`;
      throw new Error(`Dotfy respondeu ${resposta.status}: ${msg}`);
    }
    return json;
  }

  /** Traduz o status da Dotfy para o vocabulário da loja. */
  function statusDaCobranca(c: CobrancaDotfy): CobrancaPix["status"] {
    // Os booleanos são inequívocos; preferimos eles ao texto quando existem.
    if (c.isPaid) return "paid";
    if (c.isExpired) return "canceled";
    return normalizeStatus(c.status ?? "pending");
  }

  function paraCobrancaPix(c: CobrancaDotfy, raw: unknown): CobrancaPix {
    return {
      // correlationID é a chave de consulta na Dotfy — guardamos ela.
      idTransacao: c.correlationID ?? c.id ?? "",
      qrCodeImagem: c.qrCodeImage ?? null,
      qrCodeTexto: c.brCode ?? null,
      status: statusDaCobranca(c),
      raw,
    };
  }

  async function consultar(idTransacao: string): Promise<CobrancaPix> {
    const raw = await chamar(`/charges/${encodeURIComponent(idTransacao)}`, { method: "GET" });
    const dados = ((raw as { data?: CobrancaDotfy })?.data ?? {}) as CobrancaDotfy;
    return paraCobrancaPix(dados, raw);
  }

  return {
    nome: "Dotfy",

    async criarCobrancaPix(dados: DadosCobrancaPix): Promise<CobrancaPix> {
      // A loja guarda centavos; a Dotfy espera reais.
      const valorEmReais = dados.valor / 100;

      const descricao = dados.itens
        .map((i) => (i.quantidade > 1 ? `${i.quantidade}x ${i.titulo}` : i.titulo))
        .join(" | ")
        .slice(0, 200);

      const criada = await chamar("/charges", {
        method: "POST",
        body: JSON.stringify({
          value: valorEmReais,
          description: descricao,
          customer: {
            name: dados.cliente.nome,
            taxID: dados.cliente.documento,
            email: dados.cliente.email,
            phone: dados.cliente.telefone,
          },
          webhook_url: dados.urlWebhook,
        }),
      });

      const criadaDados = ((criada as { data?: CobrancaDotfy })?.data ?? {}) as CobrancaDotfy;
      const idTransacao = criadaDados.correlationID ?? criadaDados.id;

      if (!idTransacao) {
        throw new Error(`Dotfy criou a cobrança sem identificador: ${JSON.stringify(criada)}`);
      }

      // A criação volta "QUEUED" sem o PIX. Consultamos até o brCode aparecer.
      let ultima = paraCobrancaPix(criadaDados, criada);
      for (let tentativa = 0; tentativa < TENTATIVAS_BRCODE; tentativa++) {
        await espera(ESPERA_ENTRE_TENTATIVAS_MS);
        try {
          ultima = await consultar(idTransacao);
        } catch (err) {
          // Uma consulta que falha não invalida a cobrança já criada.
          console.warn(`Dotfy: falha ao consultar ${idTransacao} na tentativa ${tentativa + 1}:`, err);
          continue;
        }
        if (ultima.qrCodeTexto) break;
        // Cobrança que já morreu não vai gerar código — parar de insistir.
        if (ultima.status === "canceled") break;
      }

      // Pode voltar sem código: a fila da Dotfy ainda não processou, ou o
      // provedor por trás dela está indisponível. Devolvemos assim mesmo, com
      // o idTransacao preenchido, para o pedido ficar vinculado à cobrança e a
      // tela conseguir buscar o código depois — em vez de criar outra cobrança.
      return { ...ultima, idTransacao };
    },

    consultarTransacao: consultar,

    async reembolsar(): Promise<void> {
      // Verificado contra a API real: /charges/{id}/refund devolve HTML (rota
      // inexistente), /refunds não existe e DELETE /charges/{id} responde 405.
      // Em vez de fingir que estornou, falamos a verdade — o painel admin
      // mostra esta mensagem ao operador.
      throw new Error(
        "A Dotfy não expõe estorno pela API. Faça o estorno pelo painel da Dotfy e marque o pedido manualmente."
      );
    },

    interpretarWebhook(corpoBruto: string, cabecalhos: Headers): WebhookInterpretado {
      verificarAssinatura(corpoBruto, cabecalhos, segredo);

      let corpo: Record<string, unknown>;
      try {
        corpo = JSON.parse(corpoBruto) as Record<string, unknown>;
      } catch {
        throw new AssinaturaWebhookInvalida("corpo não é JSON válido");
      }

      const evento = typeof corpo.event === "string" ? corpo.event : null;
      const dados = ((corpo.data ?? corpo.charge ?? corpo) ?? {}) as CobrancaDotfy;

      const pagador: Pagador | null = dados.payer
        ? {
            nome: dados.payer.name ?? null,
            email: dados.payer.email ?? null,
            telefone: dados.payer.phone ?? null,
            documento: dados.payer.document ?? null,
          }
        : null;

      // O evento é a fonte mais confiável de status; o objeto é o reforço.
      const statusPorEvento = evento ? statusDoEvento(evento) : null;

      return {
        idTransacao: dados.correlationID ?? dados.id ?? null,
        status: statusPorEvento ?? statusDaCobranca(dados),
        evento,
        pagador,
      };
    },
  };
}

/** Mapeia os eventos que a Dotfy dispara (CHARGE_PAID, CHARGE_EXPIRED, …). */
function statusDoEvento(evento: string): CobrancaPix["status"] | null {
  const e = evento.toUpperCase();
  if (e.includes("PAID")) return "paid";
  if (e.includes("EXPIRED") || e.includes("CANCEL")) return "canceled";
  if (e.includes("REFUND") || e.includes("DISPUTE_LOST")) return "refunded";
  if (e.includes("CREATED")) return "pending";
  return null;
}

/**
 * Valida o header `X-Webhook-Signature`, no formato `t=<timestamp>,v1=<hmac>`.
 * O HMAC-SHA256 é calculado sobre `"<timestamp>.<corpo cru>"` — por isso o
 * corpo precisa chegar como string, exatamente como veio na requisição.
 */
function verificarAssinatura(corpoBruto: string, cabecalhos: Headers, segredo: string): void {
  const header = cabecalhos.get("x-webhook-signature");
  if (!header) throw new AssinaturaWebhookInvalida("header X-Webhook-Signature ausente");

  const partes: Record<string, string> = {};
  for (const pedaco of header.split(",")) {
    const [chave, ...resto] = pedaco.trim().split("=");
    if (chave && resto.length > 0) partes[chave] = resto.join("=");
  }

  const timestamp = partes.t;
  const assinatura = partes.v1;
  if (!timestamp || !assinatura) {
    throw new AssinaturaWebhookInvalida("header sem os campos t e v1");
  }

  // Sem a checagem de idade, uma requisição legítima capturada poderia ser
  // reenviada indefinidamente, já que a assinatura continuaria válida.
  const idadeSegundos = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(idadeSegundos) || idadeSegundos > TOLERANCIA_ASSINATURA_SEGUNDOS) {
    throw new AssinaturaWebhookInvalida("timestamp fora da janela aceita");
  }

  const esperado = createHmac("sha256", segredo).update(`${timestamp}.${corpoBruto}`).digest("hex");

  const recebidoBuf = Buffer.from(assinatura, "hex");
  const esperadoBuf = Buffer.from(esperado, "hex");
  // timingSafeEqual exige buffers do mesmo tamanho — compara antes de chamar.
  if (recebidoBuf.length !== esperadoBuf.length || !timingSafeEqual(recebidoBuf, esperadoBuf)) {
    throw new AssinaturaWebhookInvalida("hmac não confere");
  }
}
