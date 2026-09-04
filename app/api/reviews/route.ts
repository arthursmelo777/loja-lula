import { NextRequest, NextResponse } from "next/server";
import { reviewRequestSchema } from "@/lib/validators";
import { getOrderById, getOrderItems, getReviewForOrderProduct, createReview } from "@/lib/db";
import { formatReviewerName } from "@/lib/format";

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const parsed = reviewRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados inválidos.", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { orderId, reviewToken, productId, rating, comment } = parsed.data;

  const order = await getOrderById(orderId);
  // O token só é revelado ao próprio comprador na tela de sucesso — impede que
  // alguém adivinhe um id de pedido sequencial e avalie em nome de outro cliente.
  if (!order || !order.review_token || order.review_token !== reviewToken) {
    return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });
  }

  if (order.payment_status !== "paid") {
    return NextResponse.json(
      { error: "Só é possível avaliar pedidos com pagamento confirmado." },
      { status: 400 }
    );
  }

  const items = await getOrderItems(order.id);
  const purchasedItem = items.find((i) => i.product_id === productId);
  if (!purchasedItem) {
    return NextResponse.json(
      { error: "Este produto não faz parte do seu pedido." },
      { status: 400 }
    );
  }

  const existing = await getReviewForOrderProduct(order.id, productId);
  if (existing) {
    return NextResponse.json({ error: "Você já avaliou este produto." }, { status: 409 });
  }

  const review = await createReview({
    orderId: order.id,
    productId,
    customerName: formatReviewerName(order.customer_name),
    rating,
    comment: comment ? comment : null,
  });

  return NextResponse.json({ review });
}
