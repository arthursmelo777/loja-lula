import { NextRequest, NextResponse } from "next/server";
import { getOrderByTransactionHash, updateOrderStatus } from "@/lib/db";
import { getProcessadora, ProcessadoraNaoConfigurada } from "@/lib/pagamentos";
import { notifyOrderPaid } from "@/lib/order-tracking";

/**
 * Recebe as mudanças de status vindas da processadora de pagamento.
 *
 * A rota é neutra de propósito: quem sabe ler o formato do corpo é o adaptador
 * da processadora (`interpretarWebhook`), não esta rota. Trocar de processadora
 * não muda nada aqui — só o endereço que você cadastra no painel dela, que é
 * este: /api/webhooks/pagamento
 */
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  console.log("Webhook de pagamento recebido:", JSON.stringify(body));

  let processadora;
  try {
    processadora = getProcessadora();
  } catch (err) {
    if (err instanceof ProcessadoraNaoConfigurada) {
      // 200 de propósito: a processadora não deve ficar reenviando. O aviso no
      // log é o que importa — significa que chegou webhook sem adaptador ativo.
      console.warn("Webhook recebido, mas nenhuma processadora está configurada.");
      return NextResponse.json({ received: true, warning: "processadora não configurada" });
    }
    throw err;
  }

  const { idTransacao, status } = processadora.interpretarWebhook(body);

  if (!idTransacao) {
    // Responde 200 para não gerar retentativas infinitas, mas registra o problema.
    console.warn("Webhook sem identificador de transação reconhecível.");
    return NextResponse.json({ received: true, warning: "transação não identificada" });
  }

  const order = await getOrderByTransactionHash(idTransacao);
  if (!order) {
    console.warn(`Webhook: nenhum pedido encontrado para a transação ${idTransacao}`);
    return NextResponse.json({ received: true, warning: "pedido não encontrado" });
  }

  const { changedToPaid } = await updateOrderStatus(order.id, status ?? "pending");

  if (changedToPaid) {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? request.nextUrl.origin;
    await notifyOrderPaid(order.id, `${siteUrl}/pedido/${order.id}/sucesso`);
  }

  return NextResponse.json({ received: true });
}
