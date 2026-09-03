"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import type { Product, ShirtSize } from "@/types";
import { formatCents } from "@/lib/format";
import { useCart } from "./CartProvider";

export function ProductDetail({ product }: { product: Product }) {
  const { addItem } = useCart();
  const router = useRouter();
  const [size, setSize] = useState<ShirtSize | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [activeImage, setActiveImage] = useState<"front" | "back">("front");
  const [sizeError, setSizeError] = useState(false);

  const images = useMemo(() => {
    const list: Array<{ key: "front" | "back"; src: string; label: string }> = [
      { key: "front", src: product.images.front, label: "Frente" },
    ];
    if (product.images.back) {
      list.push({ key: "back", src: product.images.back, label: "Costas" });
    }
    return list;
  }, [product]);

  const needsSize = product.sizes !== null;

  function validateSize(): boolean {
    if (needsSize && !size) {
      setSizeError(true);
      return false;
    }
    setSizeError(false);
    return true;
  }

  function handleAddToCart() {
    if (!validateSize()) return;
    addItem(product.id, size, quantity);
  }

  function handleBuyNow() {
    if (!validateSize()) return;
    addItem(product.id, size, quantity);
    router.push("/carrinho");
  }

  return (
    <div className="mx-auto max-w-6xl px-5 py-10 pb-32 sm:px-8 sm:py-14 sm:pb-14">
      <div className="grid gap-10 md:grid-cols-2 md:gap-16">
        {/* GALERIA */}
        <div>
          <div className="relative aspect-square w-full overflow-hidden bg-cream-dark">
            <Image
              src={images.find((i) => i.key === activeImage)?.src ?? product.images.front}
              alt={`${product.name} — ${activeImage === "front" ? "frente" : "costas"}`}
              fill
              sizes="(max-width: 768px) 100vw, 50vw"
              className="object-cover"
              priority
            />
          </div>
          {images.length > 1 && (
            <div className="mt-4 flex gap-3">
              {images.map((img) => (
                <button
                  key={img.key}
                  type="button"
                  onClick={() => setActiveImage(img.key)}
                  className={`relative h-20 w-20 overflow-hidden border ${
                    activeImage === img.key ? "border-ink" : "border-ink/20"
                  }`}
                  aria-label={`Ver ${img.label}`}
                  aria-pressed={activeImage === img.key}
                >
                  <Image src={img.src} alt={img.label} fill sizes="80px" className="object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* INFO */}
        <div>
          <h1 className="font-display text-3xl sm:text-4xl">{product.name}</h1>
          <p className="mt-2 text-2xl font-semibold">{formatCents(product.price)}</p>
          <p className="mt-5 max-w-md text-sm leading-relaxed text-ink/70">{product.description}</p>

          {needsSize && product.sizes && (
            <div id="tamanho" className="mt-8 scroll-mt-24">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-semibold">Selecione o tamanho</span>
                {sizeError && <span className="text-xs text-brand-red">Escolha um tamanho</span>}
              </div>
              <div className="flex flex-wrap gap-2">
                {product.sizes.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => {
                      setSize(s);
                      setSizeError(false);
                    }}
                    aria-pressed={size === s}
                    className={`h-12 w-16 sm:h-11 sm:w-14 border text-base sm:text-sm font-semibold transition-colors ${
                      size === s
                        ? "border-ink bg-ink text-cream"
                        : "border-ink/30 hover:border-ink"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="mt-8">
            <span className="mb-2 block text-sm font-semibold">Quantidade</span>
            <div className="flex w-fit items-center border border-ink">
              <button
                type="button"
                className="h-12 w-12 sm:h-11 sm:w-11 text-xl sm:text-lg"
                aria-label="Diminuir quantidade"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              >
                −
              </button>
              <span className="w-12 sm:w-10 text-center text-base sm:text-sm font-semibold">{quantity}</span>
              <button
                type="button"
                className="h-12 w-12 sm:h-11 sm:w-11 text-xl sm:text-lg"
                aria-label="Aumentar quantidade"
                onClick={() => setQuantity((q) => Math.min(10, q + 1))}
              >
                +
              </button>
            </div>
          </div>

          <div className="fixed bottom-0 left-0 right-0 z-30 flex flex-col gap-3 border-t border-ink/10 bg-cream p-5 sm:static sm:flex-row sm:border-t-0 sm:bg-transparent sm:p-0 sm:mt-8">
            <button
              type="button"
              onClick={handleBuyNow}
              className="flex-1 bg-brand-red py-4 text-sm font-semibold uppercase tracking-wide text-white transition-colors hover:bg-brand-red-dark"
            >
              Comprar agora
            </button>
            <button
              type="button"
              onClick={handleAddToCart}
              className="flex-1 border border-ink py-4 text-sm font-semibold uppercase tracking-wide transition-colors hover:bg-ink hover:text-cream bg-cream sm:bg-transparent"
            >
              Adicionar ao carrinho
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
