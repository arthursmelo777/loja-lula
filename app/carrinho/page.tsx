"use client";

import Image from "next/image";
import Link from "next/link";
import { useCart } from "@/components/CartProvider";
import { PRODUCTS } from "@/lib/products";
import { formatCents } from "@/lib/format";

export default function CarrinhoPage() {
  const { items, setQuantity, removeItem, subtotal } = useCart();

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-6xl px-5 py-20 text-center sm:px-8">
        <h1 className="font-display text-3xl">SEU CARRINHO ESTÁ VAZIO</h1>
        <p className="mt-3 text-ink/60">Adicione produtos para continuar.</p>
        <Link
          href="/#camisetas"
          className="mt-8 inline-block bg-ink px-8 py-4 text-sm font-semibold uppercase tracking-wide text-cream transition-colors hover:bg-brand-red"
        >
          Ver produtos
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
      <h1 className="font-display text-3xl sm:text-4xl">SEU CARRINHO</h1>

      <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_360px]">
        <ul className="flex flex-col divide-y divide-ink/10 border-y border-ink/10">
          {items.map((item) => {
            const product = PRODUCTS[item.productId];
            if (!product) return null;
            const lineTotal = product.price * item.quantity;
            return (
              <li key={`${item.productId}-${item.size}`} className="flex gap-4 py-5 sm:gap-6">
                <div className="relative h-24 w-24 shrink-0 overflow-hidden bg-cream-dark sm:h-28 sm:w-28">
                  <Image
                    src={product.images.front}
                    alt={product.name}
                    fill
                    sizes="112px"
                    className="object-cover"
                  />
                </div>
                <div className="flex flex-1 flex-col justify-between">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h2 className="font-semibold leading-tight">{product.name}</h2>
                      {item.size && <p className="mt-1 text-sm text-ink/60">Tamanho {item.size}</p>}
                      <p className="mt-1 text-sm text-ink/60">
                        {formatCents(product.price)} / unidade
                      </p>
                    </div>
                    <span className="font-semibold">{formatCents(lineTotal)}</span>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <div className="flex items-center border border-ink">
                      <button
                        type="button"
                        className="h-9 w-9 text-sm"
                        aria-label="Diminuir quantidade"
                        onClick={() => setQuantity(item.productId, item.size, item.quantity - 1)}
                      >
                        −
                      </button>
                      <span className="w-9 text-center text-sm">{item.quantity}</span>
                      <button
                        type="button"
                        className="h-9 w-9 text-sm"
                        aria-label="Aumentar quantidade"
                        onClick={() => setQuantity(item.productId, item.size, item.quantity + 1)}
                      >
                        +
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeItem(item.productId, item.size)}
                      className="text-xs text-ink/50 underline underline-offset-2"
                    >
                      Remover
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>

        <div className="h-fit border border-ink/15 p-6">
          <h2 className="font-display text-xl">RESUMO</h2>
          <div className="mt-4 flex items-center justify-between text-sm">
            <span className="text-ink/60">Subtotal</span>
            <span className="font-semibold">{formatCents(subtotal)}</span>
          </div>
          <div className="mt-2 flex items-center justify-between font-display text-xl">
            <span>TOTAL</span>
            <span>{formatCents(subtotal)}</span>
          </div>
          <Link
            href="/checkout"
            className="mt-6 block w-full bg-brand-red py-4 text-center text-sm font-semibold uppercase tracking-wide text-white transition-colors hover:bg-brand-red-dark"
          >
            Finalizar compra
          </Link>
        </div>
      </div>
    </div>
  );
}
