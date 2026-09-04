import { NextRequest, NextResponse } from "next/server";
import { getOrderByTransactionHash, updateOrderStatus } from "@/lib/db";
import { normalizeStatus } from "@/lib/invictuspay";
import { notifyOrderPaid } from "@/lib/order-tracking";

/**
 * Confirmado com um payload real de criação de transação (a InvictusPay não
 * envolve a resposta em `data`/`transaction`, os campos ficam no nível raiz):
 * `hash` para o id da transação e `payment_status` para o status
 * (ex: "waiting_payment", "paid") — não `status`. Mantemos os fallbacks
 * antigos por segurança, já que o formato do webhook em si ainda não foi
 * confirmado (pode diferir da resposta de criação).
 */
function extractHashAndStatus(body: Record<string, unknown>): { hash: string | null; status: string | null } {
  const data = (body.data ?? body) as Record<string, unknown>;
  const transaction = (data.transaction ?? data) as Record<string, unknown>;

  const hash =
    (transaction.hash as string | undefined) ??
    (transaction.transaction_hash as string | undefined) ??
    (data.hash as string | undefined) ??
    null;

  const status =
    (transaction.payment_status as string | undefined) ??
    (data.payment_status as string | undefined) ??
    (body.payment_status as string | undefined) ??
    (transaction.status as string | undefined) ??
    (data.status as string | undefined) ??
    (body.status as string | undefined) ??
    null;

  return { hash: hash ?? null, status: status ?? null };
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  console.log("Webhook InvictusPay recebido:", JSON.stringify(body));

  const { hash, status } = extractHashAndStatus((body ?? {}) as Record<string, unknown>);

  if (!hash) {
    // Responde 200 para não gerar retentativas infinitas do gateway, mas registra o problema.
    console.warn("Webhook InvictusPay sem hash de transação reconhecível.");
    return NextResponse.json({ received: true, warning: "hash não encontrado" });
  }

  const order = await getOrderByTransactionHash(hash);
  if (!order) {
    console.warn(`Webhook InvictusPay: nenhum pedido encontrado para hash ${hash}`);
    return NextResponse.json({ received: true, warning: "pedido não encontrado" });
  }

  const normalizedStatus = normalizeStatus(status ?? "pending");
  const { changedToPaid } = await updateOrderStatus(order.id, normalizedStatus);

  if (changedToPaid) {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? request.nextUrl.origin;
    await notifyOrderPaid(order.id, `${siteUrl}/pedido/${order.id}/sucesso`);
  }

  return NextResponse.json({ received: true });
}
