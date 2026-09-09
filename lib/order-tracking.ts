import "server-only";
import { getOrderById, getOrderItems } from "./db";
import { sendMetaPurchaseEvent } from "./meta-conversions";

/**
 * Dispara o evento Purchase pra Conversions API do Meta quando um pedido é
 * confirmado como pago (webhook ou polling de status). Chame só quando o
 * status realmente acabou de virar "paid" (evita reenviar em cada poll).
 */
export async function notifyOrderPaid(orderId: number, sourceUrl: string): Promise<void> {
  try {
    const order = await getOrderById(orderId);
    if (!order) return;
    const items = await getOrderItems(orderId);
    await sendMetaPurchaseEvent({
      eventId: `order-${orderId}`,
      value: order.total / 100,
      currency: "BRL",
      email: order.customer_email,
      phone: order.customer_phone,
      contentIds: items.map((i) => i.product_id),
      sourceUrl,
      fbp: order.meta_fbp,
      fbc: order.meta_fbc,
      clientIp: order.client_ip,
      userAgent: order.client_user_agent,
    });
  } catch (err) {
    console.error("Falha ao notificar pedido pago pra Meta Conversions API:", err);
  }
}
