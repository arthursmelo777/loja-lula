import "server-only";
import type { OrderStatus, UtmData } from "@/types";

/**
 * Encaixe da processadora de pagamento.
 *
 * A loja não fala com nenhuma processadora específica: ela fala com esta
 * interface. Trocar de processadora é implementar `ProcessadoraPagamento` num
 * arquivo novo e apontar `getProcessadora()` para ele — nenhuma rota, página
 * ou tabela precisa mudar.
 *
 * Nada aqui pode ser específico de um fornecedor. Conceitos como "offer_hash"
 * ou "product_hash" pertencem ao adaptador de cada processadora, nunca a este
 * arquivo nem ao resto da loja.
 */

/** Item do carrinho, do jeito que a LOJA enxerga — sem vocabulário de gateway. */
export interface ItemCobranca {
  productId: string;
  category: "camiseta" | "bone";
  /** Nome já montado para o comprador ver na fatura (inclui tamanho/estampa). */
  titulo: string;
  /** Preço unitário em centavos. */
  precoUnitario: number;
  quantidade: number;
}

export interface ClienteCobranca {
  nome: string;
  email: string;
  telefone: string;
  documento: string;
  rua: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  estado: string;
  cep: string;
}

export interface DadosCobrancaPix {
  /** Total em centavos. Sempre recalculado no servidor, nunca vindo do cliente. */
  valor: number;
  cliente: ClienteCobranca;
  itens: ItemCobranca[];
  /** URL que a processadora deve chamar quando o pagamento mudar de status. */
  urlWebhook: string;
  tracking: UtmData;
}

export interface CobrancaPix {
  /** Identificador da transação na processadora. Guardado em orders.transaction_hash. */
  idTransacao: string;
  /** Imagem pronta do QR Code, se a processadora devolver uma. */
  qrCodeImagem: string | null;
  /** Código "copia e cola" (payload EMV). */
  qrCodeTexto: string | null;
  status: OrderStatus;
  /** Resposta crua, guardada para diagnóstico. */
  raw: unknown;
}

export interface ProcessadoraPagamento {
  /** Nome legível, usado em mensagens de erro e log. */
  readonly nome: string;
  criarCobrancaPix(dados: DadosCobrancaPix): Promise<CobrancaPix>;
  consultarTransacao(idTransacao: string): Promise<{ status: OrderStatus; raw: unknown }>;
  reembolsar(idTransacao: string, valor: number): Promise<void>;
  /** Lê o corpo de um webhook e diz de qual transação e status ele fala. */
  interpretarWebhook(corpo: unknown): { idTransacao: string | null; status: OrderStatus | null };
}

/**
 * Erro de configuração: nenhuma processadora está ligada.
 *
 * É um erro distinto de propósito — as rotas conseguem diferenciar "a
 * processadora recusou a cobrança" de "não existe processadora nenhuma" e
 * mostrar a mensagem certa em vez de um 502 genérico.
 */
export class ProcessadoraNaoConfigurada extends Error {
  constructor() {
    super(
      "Nenhuma processadora de pagamento está configurada. Implemente ProcessadoraPagamento " +
        "num adaptador (ex.: lib/processadoras/<nome>.ts) e registre-o em getProcessadora(), " +
        "em lib/pagamentos.ts."
    );
    this.name = "ProcessadoraNaoConfigurada";
  }
}

/**
 * Devolve a processadora ativa.
 *
 * A integração anterior (InvictusPay) foi removida. Enquanto nenhuma nova for
 * registrada aqui, os pedidos continuam sendo criados e gravados no banco — o
 * que falha, com mensagem explícita, é só a geração da cobrança. Assim nada de
 * histórico se perde na troca, e a loja segue navegável.
 */
export function getProcessadora(): ProcessadoraPagamento {
  throw new ProcessadoraNaoConfigurada();
}

/**
 * Converte o status que a processadora usa para o vocabulário da loja.
 * Fica aqui, e não no adaptador, porque os nomes abaixo se repetem entre
 * praticamente todas as processadoras brasileiras.
 */
export function normalizeStatus(rawStatus: string): OrderStatus {
  const s = rawStatus.toLowerCase();
  if (["paid", "approved", "completed", "confirmed", "succeeded", "received"].includes(s)) {
    return "paid";
  }
  if (["refused", "canceled", "cancelled", "chargeback", "expired", "failed"].includes(s)) {
    return "canceled";
  }
  if (["refunded", "reversed"].includes(s)) return "refunded";
  // "waiting_payment", "pending", "processing" e afins caem aqui.
  return "pending";
}
