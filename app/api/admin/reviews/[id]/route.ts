import { NextRequest, NextResponse } from "next/server";
import { definirAprovacaoAvaliacao } from "@/lib/db";

/**
 * Aprova ou oculta uma avaliação. Protegida pelo proxy.ts, que exige sessão
 * admin em /api/admin/*. Aprovada, ela passa a aparecer na página do produto;
 * oculta, some da loja mas continua aqui e na tela do pedido de quem escreveu.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const reviewId = Number(id);
  if (!Number.isInteger(reviewId) || reviewId <= 0) {
    return NextResponse.json({ error: "Avaliação inválida." }, { status: 400 });
  }

  let body: { aprovada?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Requisição inválida." }, { status: 400 });
  }

  try {
    await definirAprovacaoAvaliacao(reviewId, Boolean(body.aprovada));
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Falha ao mudar a aprovação da avaliação:", err);
    return NextResponse.json({ error: "Não foi possível salvar." }, { status: 500 });
  }
}
