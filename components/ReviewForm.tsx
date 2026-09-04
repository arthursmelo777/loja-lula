"use client";

import { useState } from "react";
import { StarRatingInput } from "./StarRating";

interface CouponResult {
  code: string;
  discountPercent: number;
}

interface Props {
  orderId: number;
  reviewToken: string;
  productId: string;
  productName: string;
  alreadyReviewed: boolean;
  existingCoupon?: CouponResult | null;
}

export function ReviewForm({
  orderId,
  reviewToken,
  productId,
  productName,
  alreadyReviewed,
  existingCoupon,
}: Props) {
  const [done, setDone] = useState(alreadyReviewed);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [coupon, setCoupon] = useState<CouponResult | null>(existingCoupon ?? null);
  const [copied, setCopied] = useState(false);

  async function handleCopyCode() {
    if (!coupon) return;
    try {
      await navigator.clipboard.writeText(coupon.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard indisponível — o código ainda fica visível pra copiar manualmente
    }
  }

  if (done) {
    return (
      <div className="border border-ink/15 p-4 text-sm text-ink/60">
        <p>
          Obrigado por avaliar <strong className="text-ink">{productName}</strong>!
        </p>
        {coupon && (
          <div className="mt-3 border border-dashed border-brand-red bg-brand-red/5 p-3">
            <p className="text-xs text-ink/70">
              Você ganhou {coupon.discountPercent}% de desconto na próxima compra:
            </p>
            <div className="mt-1 flex items-center justify-between gap-2">
              <code className="font-display text-lg tracking-wide text-brand-red">{coupon.code}</code>
              <button
                type="button"
                onClick={handleCopyCode}
                className="shrink-0 bg-ink px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-cream hover:bg-brand-red"
              >
                {copied ? "Copiado!" : "Copiar"}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (rating === 0) {
      setError("Escolha de 1 a 5 estrelas.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, reviewToken, productId, rating, comment }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Não foi possível enviar sua avaliação.");
        setSubmitting(false);
        return;
      }
      if (data.coupon) setCoupon(data.coupon);
      setDone(true);
    } catch {
      setError("Erro de conexão. Tente novamente.");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="border border-ink/15 p-4">
      <p className="text-sm font-semibold">Avalie: {productName}</p>
      <div className="mt-2">
        <StarRatingInput value={rating} onChange={setRating} />
      </div>
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value.slice(0, 500))}
        placeholder="Conte como foi sua experiência (opcional)"
        rows={2}
        maxLength={500}
        className="input mt-3 resize-none"
      />
      {error && <p className="mt-2 text-xs text-brand-red">{error}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="mt-3 bg-ink px-6 py-2.5 text-xs font-semibold uppercase tracking-wide text-cream transition-colors hover:bg-brand-red disabled:opacity-60"
      >
        {submitting ? "Enviando…" : "Enviar avaliação"}
      </button>
    </form>
  );
}
