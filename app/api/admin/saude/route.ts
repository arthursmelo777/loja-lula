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

export async function GET() {
  const definida = (nome: string) => Boolean(process.env[nome]?.trim());

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
      NEXT_PUBLIC_META_PIXEL_ID: definida("NEXT_PUBLIC_META_PIXEL_ID"),
      // A que faltava: sem ela o Purchase server-side nunca sai.
      META_CONVERSIONS_API_TOKEN: definida("META_CONVERSIONS_API_TOKEN"),
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
