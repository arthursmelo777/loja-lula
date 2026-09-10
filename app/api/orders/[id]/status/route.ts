import { NextRequest, NextResponse } from "next/server";
import { getOrderById, updateOrderStatus } from "@/lib/db";
import { getProcessadora, ProcessadoraNaoConfigurada } from "@/lib/pagamentos";
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

  // Se ainda está pendente e temos o id da transação, consulta a processadora
  // para o caso do webhook ainda não ter chegado.
  if (order.payment_status === "pending" && order.transaction_hash) {
    try {
      const { status } = await getProcessadora().consultarTransacao(order.transaction_hash);
      if (status !== order.payment_status) {
        const { changedToPaid } = await updateOrderStatus(order.id, status);
        if (changedToPaid) {
          const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? request.nextUrl.origin;
          await notifyOrderPaid(order.id, `${siteUrl}/pedido/${order.id}/sucesso`);
        }
        return NextResponse.json({ status });
      }
    } catch (err) {
      // Sem processadora configurada, ou consulta falhou: seguimos com o status
      // do banco. O polling do comprador nunca deve quebrar por causa disso.
      if (!(err instanceof ProcessadoraNaoConfigurada)) {
        console.error("Falha ao consultar o status na processadora:", err);
      }
    }
  }

  return NextResponse.json({ status: order.payment_status });
}
