import { NextRequest, NextResponse } from "next/server";
import { getOrderById, updateOrderStatus } from "@/lib/db";
import { getInvictusTransaction, normalizeStatus } from "@/lib/invictuspay";
import { notifyOrderPaid } from "@/lib/order-tracking";

export async function GET(
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

  // Se ainda está pendente e temos o hash da transação, consulta a InvictusPay
  // para o caso do webhook ainda não ter chegado.
  if (order.payment_status === "pending" && order.transaction_hash) {
    try {
      const raw = (await getInvictusTransaction(order.transaction_hash)) as Record<string, unknown>;
      const data = (raw?.data ?? raw) as Record<string, unknown>;
      // A InvictusPay devolve o status em `payment_status` (ex: "waiting_payment",
      // "paid"), não em `status` — confirmado no payload real da API.
      const rawStatus =
        typeof data?.payment_status === "string"
          ? data.payment_status
          : typeof data?.status === "string"
            ? data.status
            : "pending";
      const status = normalizeStatus(rawStatus);
      if (status !== order.payment_status) {
        const { changedToPaid } = await updateOrderStatus(order.id, status);
        if (changedToPaid) {
          const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? request.nextUrl.origin;
          await notifyOrderPaid(order.id, `${siteUrl}/pedido/${order.id}/sucesso`);
        }
        return NextResponse.json({ status });
      }
    } catch (err) {
      console.error("Falha ao consultar status na InvictusPay:", err);
      // segue com o status atual do banco — não bloqueia o polling do cliente
    }
  }

  return NextResponse.json({ status: order.payment_status });
}
