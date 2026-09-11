import { NextResponse } from "next/server";
import { listarAvaliacoesAdmin } from "@/lib/db";

/**
 * Avaliações para o painel. Protegida pelo proxy.ts, que exige sessão admin em
 * /api/admin/*. As avaliações não têm mais nenhuma rota pública: quem escreveu
 * vê a sua na tela do próprio pedido, e o restante só aparece aqui.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const avaliacoes = await listarAvaliacoesAdmin();
    return NextResponse.json({ avaliacoes });
  } catch (err) {
    console.error("Falha ao listar avaliações:", err);
    return NextResponse.json({ error: "Não foi possível carregar." }, { status: 503 });
  }
}
