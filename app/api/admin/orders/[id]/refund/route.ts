import { NextRequest, NextResponse } from "next/server";
import { getOrderById, updateOrderStatus } from "@/lib/db";
import { refundInvictusTransaction } from "@/lib/invictuspay";

export async function POST(
  request: NextRequest,
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

  if (order.payment_status !== "paid") {
    return NextResponse.json(
      { error: "Só é possível reembolsar pedidos com pagamento confirmado." },
      { status: 400 }
    );
  }

  if (!order.transaction_hash) {
    return NextResponse.json({ error: "Pedido sem transação associada." }, { status: 400 });
  }

  let body: { amount?: number } = {};
  try {
    body = await request.json();
  } catch {
    // corpo vazio é aceitável — reembolsa o total do pedido
  }

  const amount = typeof body.amount === "number" && body.amount > 0 ? body.amount : order.total;
  if (amount > order.total) {
    return NextResponse.json({ error: "Valor de reembolso maior que o total do pedido." }, { status: 400 });
  }

  try {
    await refundInvictusTransaction(order.transaction_hash, amount);
    await updateOrderStatus(order.id, "refunded");
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Falha ao reembolsar na InvictusPay:", err);
    return NextResponse.json({ error: "Falha ao processar reembolso na InvictusPay." }, { status: 502 });
  }
}
