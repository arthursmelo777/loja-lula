import { NextRequest, NextResponse } from "next/server";
import { getOrderById, getOrderItems, definirRastreio, definirEntregue } from "@/lib/db";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const orderId = Number(id);
  if (!Number.isFinite(orderId)) {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }

  const order = await getOrderById(orderId);
  if (!order) {
    return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });
  }
  const items = await getOrderItems(orderId);

  return NextResponse.json({ order, items });
}

/**
 * Atualiza o rastreio do pedido. Protegido pelo proxy.ts, que exige sessão
 * admin em /api/admin/*.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const orderId = Number(id);
  if (!Number.isInteger(orderId) || orderId <= 0) {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }

  let body: { trackingCode?: unknown; carrier?: unknown; entregue?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Requisição inválida." }, { status: 400 });
  }

  try {
    if (body.trackingCode !== undefined || body.carrier !== undefined) {
      const codigo = String(body.trackingCode ?? "").trim();
      const transportadora = String(body.carrier ?? "").trim();
      await definirRastreio(orderId, codigo || null, transportadora || null);
    }
    if (body.entregue !== undefined) {
      await definirEntregue(orderId, Boolean(body.entregue));
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Falha ao atualizar o rastreio:", err);
    return NextResponse.json({ error: "Não foi possível salvar." }, { status: 500 });
  }
}
