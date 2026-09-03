"use client";

import Image from "next/image";
import Link from "next/link";
import { useCart } from "./CartProvider";
import { PRODUCTS } from "@/lib/products";
import { formatCents } from "@/lib/format";

export function CartDrawer() {
  const { items, isDrawerOpen, closeDrawer, setQuantity, removeItem, subtotal } = useCart();

  if (!isDrawerOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        aria-label="Fechar carrinho"
        onClick={closeDrawer}
        className="absolute inset-0 bg-ink/50"
      />
      <div className="relative flex h-full w-full max-w-md flex-col bg-cream shadow-xl">
        <div className="flex items-center justify-between px-6 py-5 hairline">
          <h2 className="font-display text-2xl">SEU CARRINHO</h2>
          <button
            onClick={closeDrawer}
            aria-label="Fechar"
            className="flex h-9 w-9 items-center justify-center border border-ink"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M5 5l14 14M19 5L5 19"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {items.length === 0 ? (
            <p className="mt-10 text-center text-sm text-ink/60">Seu carrinho está vazio.</p>
          ) : (
            <ul className="flex flex-col gap-5">
              {items.map((item) => {
                const product = PRODUCTS[item.productId];
                if (!product) return null;
                return (
                  <li key={`${item.productId}-${item.size}`} className="flex gap-4">
                    <div className="relative h-20 w-20 shrink-0 overflow-hidden bg-cream-dark">
                      <Image
                        src={product.images.front}
                        alt={product.name}
                        fill
                        sizes="80px"
                        className="object-cover"
                      />
                    </div>
                    <div className="flex flex-1 flex-col gap-1">
                      <span className="text-sm font-semibold leading-tight">{product.name}</span>
                      {item.size && <span className="text-xs text-ink/60">Tamanho {item.size}</span>}
                      <div className="mt-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0">
                        <div className="flex items-center w-fit border border-ink">
                          <button
                            type="button"
                            className="h-10 w-10 sm:h-8 sm:w-8 text-base"
                            aria-label="Diminuir quantidade"
                            onClick={() => setQuantity(item.productId, item.size, item.quantity - 1)}
                          >
                            −
                          </button>
                          <span className="w-10 sm:w-8 text-center text-sm">{item.quantity}</span>
                          <button
                            type="button"
                            className="h-10 w-10 sm:h-8 sm:w-8 text-base"
                            aria-label="Aumentar quantidade"
                            onClick={() => setQuantity(item.productId, item.size, item.quantity + 1)}
                          >
                            +
                          </button>
                        </div>
                        <span className="text-base sm:text-sm font-semibold">
                          {formatCents(product.price * item.quantity)}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeItem(item.productId, item.size)}
                        className="mt-1 self-start text-xs text-ink/50 underline underline-offset-2"
                      >
                        Remover
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="hairline space-y-4 px-6 py-5">
          <div className="flex items-center justify-between font-display text-xl">
            <span>SUBTOTAL</span>
            <span>{formatCents(subtotal)}</span>
          </div>
          <Link
            href="/carrinho"
            onClick={closeDrawer}
            className="block w-full bg-ink py-4 text-center text-sm font-semibold uppercase tracking-wide text-cream transition-colors hover:bg-brand-red"
          >
            Ver carrinho
          </Link>
        </div>
      </div>
    </div>
  );
}
