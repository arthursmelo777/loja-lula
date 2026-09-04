import { notFound } from "next/navigation";
import Link from "next/link";
import { getOrderById, getOrderItems, getReviewForOrderProduct } from "@/lib/db";
import { formatCents } from "@/lib/format";
import { ReviewForm } from "@/components/ReviewForm";

export const dynamic = "force-dynamic";

export default async function PedidoSucessoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const orderId = Number(id);
  if (!Number.isFinite(orderId)) notFound();

  const order = await getOrderById(orderId);
  if (!order) notFound();

  const items = await getOrderItems(order.id);

  // Um formulário de avaliação por produto único do pedido (não por linha/tamanho).
  const uniqueProducts = Array.from(
    new Map(items.map((i) => [i.product_id, i.product_name])).entries()
  );
  const reviewables =
    order.payment_status === "paid" && order.review_token
      ? await Promise.all(
          uniqueProducts.map(async ([productId, productName]) => ({
            productId,
            productName,
            alreadyReviewed: Boolean(await getReviewForOrderProduct(order.id, productId)),
          }))
        )
      : [];

  return (
    <div className="mx-auto max-w-2xl px-5 py-14 sm:px-8">
      <div className="flex flex-col items-center text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-red text-white">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M5 13l4 4L19 7"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <h1 className="mt-6 font-display text-3xl sm:text-4xl">PAGAMENTO CONFIRMADO!</h1>
        <p className="mt-2 max-w-sm text-ink/60">
          Recebemos seu pagamento. Seu pedido agora está sendo preparado.
        </p>
      </div>

      <div className="mt-10 border border-ink/15 p-6">
        <div className="flex items-center justify-between hairline pb-4">
          <span className="text-sm text-ink/60">Pedido</span>
          <span className="font-semibold">#{order.id}</span>
        </div>

        <ul className="flex flex-col gap-3 py-4 hairline">
          {items.map((item) => (
            <li key={item.id} className="flex justify-between text-sm">
              <span>
                {item.product_name}
                {item.variant ? ` — Tamanho ${item.variant}` : ""}
                <span className="text-ink/50"> · {item.quantity}x</span>
                {item.custom_name && (
                  <span className="block text-xs text-ink/50">Estampa: &ldquo;{item.custom_name}&rdquo;</span>
                )}
              </span>
              <span className="font-medium">{formatCents(item.total)}</span>
            </li>
          ))}
        </ul>

        <div className="flex items-center justify-between pt-4 font-display text-xl">
          <span>TOTAL</span>
          <span>{formatCents(order.total)}</span>
        </div>
      </div>

      <div className="mt-8 border border-ink/15 p-6 text-sm">
        <h2 className="mb-3 font-display text-lg">ENTREGA</h2>
        <p>{order.customer_name}</p>
        <p className="text-ink/60">
          {order.street}, {order.number}
          {order.complement ? ` — ${order.complement}` : ""}
        </p>
        <p className="text-ink/60">
          {order.neighborhood} — {order.city}/{order.state}
        </p>
        <p className="text-ink/60">CEP {order.zip_code}</p>
      </div>

      {reviewables.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-3 font-display text-xl">O QUE VOCÊ ACHOU?</h2>
          <div className="flex flex-col gap-4">
            {reviewables.map((r) => (
              <ReviewForm
                key={r.productId}
                orderId={order.id}
                reviewToken={order.review_token as string}
                productId={r.productId}
                productName={r.productName}
                alreadyReviewed={r.alreadyReviewed}
              />
            ))}
          </div>
        </div>
      )}

      <Link
        href="/"
        className="mt-8 block w-full bg-ink py-4 text-center text-sm font-semibold uppercase tracking-wide text-cream transition-colors hover:bg-brand-red"
      >
        Voltar à loja
      </Link>
    </div>
  );
}
