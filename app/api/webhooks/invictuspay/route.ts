import { NextRequest, NextResponse } from "next/server";
import { getOrderByTransactionHash, updateOrderStatus } from "@/lib/db";
import { normalizeStatus } from "@/lib/invictuspay";

/**
 * A documentação fornecida não detalha o formato exato do payload do webhook,
 * então esta rota tenta reconhecer os campos mais comuns (hash/transaction_hash
 * e status em diferentes profundidades) sem inventar nomes que não existam.
 * Ajuste os caminhos abaixo assim que você receber um payload real da InvictusPay.
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
  await updateOrderStatus(order.id, normalizedStatus);

  return NextResponse.json({ received: true });
}
