import { NextRequest, NextResponse } from "next/server";
import { getOrderById, updateOrderStatus } from "@/lib/db";
import { getInvictusTransaction, normalizeStatus } from "@/lib/invictuspay";

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

  // Se ainda está pendente e temos o hash da transação, consulta a InvictusPay
  // para o caso do webhook ainda não ter chegado.
  if (order.payment_status === "pending" && order.transaction_hash) {
    try {
      const raw = (await getInvictusTransaction(order.transaction_hash)) as Record<string, unknown>;
      const data = (raw?.data ?? raw) as Record<string, unknown>;
      const rawStatus = typeof data?.status === "string" ? data.status : "pending";
      const status = normalizeStatus(rawStatus);
      if (status !== order.payment_status) {
        await updateOrderStatus(order.id, status);
        return NextResponse.json({ status });
      }
    } catch (err) {
      console.error("Falha ao consultar status na InvictusPay:", err);
      // segue com o status atual do banco — não bloqueia o polling do cliente
    }
  }

  return NextResponse.json({ status: order.payment_status });
}
