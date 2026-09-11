import { NextRequest, NextResponse } from "next/server";
import { getOrderByTransactionHash, updateOrderStatus } from "@/lib/db";
import {
  getProcessadora,
  AssinaturaWebhookInvalida,
  ProcessadoraNaoConfigurada,
} from "@/lib/pagamentos";
import { notifyOrderPaid } from "@/lib/order-tracking";

/**
 * Recebe as mudanças de status vindas da processadora de pagamento.
 *
 * A rota é neutra: quem sabe validar a assinatura e ler o formato do corpo é o
 * adaptador da processadora. Trocar de processadora não muda nada aqui — só o
 * endereço cadastrado no painel dela, que é este: /api/webhooks/pagamento
 *
 * Lemos o corpo com `text()`, nunca com `json()`: a assinatura é calculada
 * sobre os bytes exatos que chegaram, e parsear e reserializar mudaria o
 * resultado (ordem de chaves, espaços, escapes) — a validação passaria a
 * falhar mesmo com webhook legítimo.
 */
export async function POST(request: NextRequest) {
  const corpoBruto = await request.text();

  let processadora;
  try {
    processadora = getProcessadora();
  } catch (err) {
    if (err instanceof ProcessadoraNaoConfigurada) {
      // 200 de propósito: sem adaptador não há o que fazer, e devolver erro só
      // faria a processadora reenviar para sempre. O aviso no log é o sinal.
      console.warn("Webhook recebido, mas nenhuma processadora está configurada.");
      return NextResponse.json({ received: true, warning: "processadora não configurada" });
    }
    throw err;
  }

  let interpretado;
  try {
    interpretado = processadora.interpretarWebhook(corpoBruto, request.headers);
  } catch (err) {
    if (err instanceof AssinaturaWebhookInvalida) {
      // 401 e nada mais. Sem assinatura válida não confiamos no conteúdo, e
      // sem confiar no conteúdo não tocamos em pedido nenhum: aceitar isso
      // deixaria qualquer um marcar pedido como pago e ainda disparar um
      // evento de compra falso no Meta.
      console.warn("Webhook recusado:", err.message);
      return NextResponse.json({ error: "Assinatura inválida." }, { status: 401 });
    }
    throw err;
  }

  const { idTransacao, status, evento, pagador } = interpretado;
  console.log(`Webhook ${processadora.nome} recebido: evento=${evento} transacao=${idTransacao} status=${status}`);

  if (!idTransacao) {
    console.warn("Webhook autêntico, mas sem identificador de transação reconhecível.");
    return NextResponse.json({ received: true, warning: "transação não identificada" });
  }

  const order = await getOrderByTransactionHash(idTransacao);
  if (!order) {
    // Acontece de forma legítima: eventos de saque e de outras cobranças da
    // conta chegam aqui sem pedido correspondente.
    console.warn(`Webhook: nenhum pedido encontrado para a transação ${idTransacao}`);
    return NextResponse.json({ received: true, warning: "pedido não encontrado" });
  }

  // Sinal de fraude: quem pagou não é quem comprou. Não bloqueia o pedido —
  // apenas registra, para conferência antes do envio.
  if (status === "paid" && pagador?.documento) {
    const soDigitos = (v: string) => v.replace(/\D/g, "");
    if (soDigitos(pagador.documento) !== soDigitos(order.customer_document)) {
      console.warn(
        `ATENÇÃO pedido ${order.id}: CPF do pagador difere do CPF do pedido. ` +
          `Conferir antes de enviar.`
      );
    }
  }

  if (!status) {
    return NextResponse.json({ received: true, warning: "status não reconhecido" });
  }

  const { changedToPaid } = await updateOrderStatus(order.id, status);

  if (changedToPaid) {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? request.nextUrl.origin;
    await notifyOrderPaid(order.id, `${siteUrl}/pedido/${order.id}/sucesso`);
  }

  return NextResponse.json({ received: true });
}
