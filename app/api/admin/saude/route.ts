import { NextResponse } from "next/server";

/**
 * Diagnóstico de configuração do ambiente em produção.
 *
 * Existe porque variável de ambiente faltando não quebra nada visível: a loja
 * abre, o pedido é criado, ninguém percebe. Foi assim que o token da
 * Conversions API ficou ausente em produção sem sinal nenhum — as vendas
 * simplesmente não chegavam ao Meta. Esta rota responde "está configurado?"
 * sem precisar de acesso ao painel da hospedagem.
 *
 * Devolve SOMENTE booleanos. Nunca o valor de um segredo: o objetivo é saber
 * se está lá, não o que é. Protegida pelo proxy.ts, que exige sessão admin em
 * /api/admin/*.
 */
export const dynamic = "force-dynamic";

/**
 * Pergunta ao próprio Meta se o par pixel + token que ESTE ambiente carrega é
 * aceito. Manda um corpo vazio de propósito: nenhum evento é enviado, e a
 * resposta já separa os casos — "data is required" significa que autenticou,
 * e erro de OAuth significa credencial inválida para este pixel.
 *
 * Existe porque variável trocada pela metade é invisível: o site continua
 * reportando para um pixel que não recebe mais nada, sem erro em lugar nenhum.
 */
async function checarCredenciaisMeta(): Promise<{ ok: boolean; detalhe: string }> {
  const pixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID;
  const token = process.env.META_CONVERSIONS_API_TOKEN;
  if (!pixelId || !token) return { ok: false, detalhe: "pixel ou token ausente" };

  try {
    const res = await fetch(`https://graph.facebook.com/v21.0/${pixelId}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `access_token=${encodeURIComponent(token)}`,
      cache: "no-store",
    });
    const json = (await res.json()) as { error?: { code?: number; message?: string } };
    const msg = json.error?.message ?? "";
    if (msg.includes("data is required")) {
      return { ok: true, detalhe: "pixel e token aceitos pelo Meta" };
    }
    return { ok: false, detalhe: msg || `HTTP ${res.status}` };
  } catch (err) {
    return { ok: false, detalhe: err instanceof Error ? err.message : "falha de rede" };
  }
}

export async function GET() {
  const definida = (nome: string) => Boolean(process.env[nome]?.trim());

  const meta = await checarCredenciaisMeta();

  return NextResponse.json({
    banco: {
      DATABASE_URL: definida("DATABASE_URL"),
    },
    pagamento: {
      DOTFY_API_KEY: definida("DOTFY_API_KEY"),
      DOTFY_WEBHOOK_SECRET: definida("DOTFY_WEBHOOK_SECRET"),
      DOTFY_API_URL: definida("DOTFY_API_URL"),
    },
    meta: {
      // Valor, não booleano: o pixel ID é público (vai no HTML de toda página),
      // e saber QUAL está valendo é o que diagnostica uma troca que não pegou.
      NEXT_PUBLIC_META_PIXEL_ID: process.env.NEXT_PUBLIC_META_PIXEL_ID ?? null,
      // A que faltava: sem ela o Purchase server-side nunca sai.
      META_CONVERSIONS_API_TOKEN: definida("META_CONVERSIONS_API_TOKEN"),
      credenciaisAceitasPeloMeta: meta.ok,
      detalhe: meta.detalhe,
    },
    site: {
      NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL ?? null,
      NEXT_PUBLIC_WHATSAPP_SUPORTE: definida("NEXT_PUBLIC_WHATSAPP_SUPORTE"),
    },
    admin: {
      ADMIN_PASSWORD: definida("ADMIN_PASSWORD"),
      ADMIN_SESSION_SECRET: definida("ADMIN_SESSION_SECRET"),
    },
  });
}
