"use client";

import Image from "next/image";
import Link from "next/link";
import type { Product } from "@/types";
import { formatCents } from "@/lib/format";
import { useCart } from "./CartProvider";

export function ProductCard({ product }: { product: Product }) {
  const { addItem } = useCart();
  const needsSize = product.sizes !== null;

  return (
    <div className="group flex flex-col border border-ink/15">
      <Link href={`/produto/${product.slug}`} className="relative block aspect-square overflow-hidden bg-cream-dark">
        <Image
          src={product.images.front}
          alt={product.name}
          fill
          sizes="(max-width: 640px) 50vw, 25vw"
          className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
        />
      </Link>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div>
          <h3 className="font-display text-lg leading-tight">{product.name}</h3>
          <p className="mt-1 text-base font-semibold">{formatCents(product.price)}</p>
        </div>
        <div className="mt-auto flex flex-col sm:flex-row gap-2">
          <Link
            href={`/produto/${product.slug}`}
            className="flex-1 border border-ink py-3 sm:py-2.5 text-center text-xs font-semibold uppercase tracking-wide transition-colors hover:bg-ink hover:text-cream"
          >
            Ver produto
          </Link>
          {needsSize ? (
            <Link
              href={`/produto/${product.slug}#tamanho`}
              className="flex-1 bg-ink py-3 sm:py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-cream transition-colors hover:bg-brand-red"
            >
              Adicionar
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => addItem(product.id, null, 1)}
              className="flex-1 bg-ink py-3 sm:py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-cream transition-colors hover:bg-brand-red"
            >
              Adicionar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
