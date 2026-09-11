import { NextResponse } from "next/server";
import { createHash } from "node:crypto";

/**
 * ROTA TEMPORÁRIA DE DIAGNÓSTICO — APAGAR DEPOIS DE USAR.
 *
 * Existe para responder uma pergunta que, de fora, é impossível: o login de
 * admin está falhando porque a senha enviada é diferente, ou porque a variável
 * ADMIN_PASSWORD não está chegando ao runtime? Os dois casos produzem a mesma
 * resposta "senha incorreta", e sem essa distinção não dá para consertar.
 *
 * Não devolve nenhum segredo: apenas se a variável existe, o tamanho dela e os
 * 8 primeiros caracteres hexadecimais do SHA-256. Isso é suficiente para
 * comparar com o valor esperado sem revelar o valor — e insuficiente para
 * reverter uma senha aleatória de 20 caracteres.
 *
 * Mesmo assim, é exposição desnecessária depois que cumprir o papel: assim que
 * o diagnóstico terminar, esta rota sai e a senha é trocada.
 */
export const dynamic = "force-dynamic";

function impressao(valor: string | undefined) {
  if (!valor) return { definida: false, tamanho: 0, hash8: null, terminaComEspaco: false };
  return {
    definida: true,
    tamanho: valor.length,
    hash8: createHash("sha256").update(valor).digest("hex").slice(0, 8),
    // Revela o problema clássico de colar em caixa de várias linhas.
    terminaComEspaco: valor !== valor.trim(),
  };
}

export async function GET() {
  return NextResponse.json({
    aviso: "rota temporaria de diagnostico — sera removida",
    ADMIN_PASSWORD: impressao(process.env.ADMIN_PASSWORD),
    ADMIN_SESSION_SECRET: impressao(process.env.ADMIN_SESSION_SECRET),
    META_CONVERSIONS_API_TOKEN: impressao(process.env.META_CONVERSIONS_API_TOKEN),
    NEXT_PUBLIC_META_PIXEL_ID: impressao(process.env.NEXT_PUBLIC_META_PIXEL_ID),
    DOTFY_API_KEY: impressao(process.env.DOTFY_API_KEY),
    DOTFY_WEBHOOK_SECRET: impressao(process.env.DOTFY_WEBHOOK_SECRET),
  });
}
