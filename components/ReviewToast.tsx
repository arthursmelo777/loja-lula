"use client";

import { useEffect, useRef, useState } from "react";
import { StarRatingDisplay } from "./StarRating";

interface RecentReview {
  id: number;
  productId: string;
  productName: string;
  customerName: string;
  rating: number;
  createdAt: string;
}

const POLL_INTERVAL_MS = 20000;
const VISIBLE_MS = 5500;

/**
 * Mostra um aviso discreto quando uma avaliação real e nova chega na loja
 * (ex: "Maria S. avaliou Camiseta Lula Preta ★★★★★"). Nunca inventa dados —
 * só reage a avaliações reais feitas por compradores verificados. Não mostra
 * o histórico ao carregar a página, só o que chegar depois disso.
 */
export function ReviewToast() {
  const [current, setCurrent] = useState<RecentReview | null>(null);
  const lastSeenId = useRef<number | null>(null);
  const queue = useRef<RecentReview[]>([]);
  const showingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function showNext() {
    const next = queue.current.shift();
    if (!next) {
      setCurrent(null);
      return;
    }
    setCurrent(next);
    showingTimer.current = setTimeout(showNext, VISIBLE_MS);
  }

  useEffect(() => {
    let cancelled = false;
    let pollTimer: ReturnType<typeof setTimeout> | null = null;

    async function poll() {
      try {
        const url =
          lastSeenId.current === null
            ? "/api/reviews/recent"
            : `/api/reviews/recent?after=${lastSeenId.current}`;
        const res = await fetch(url, { cache: "no-store" });
        if (res.ok && !cancelled) {
          const data = await res.json();
          const reviews: RecentReview[] = data.reviews ?? [];
          if (lastSeenId.current === null) {
            // Primeira carga: só define a referência, não enfileira nada
            // (evita mostrar avaliações antigas como se fossem novas).
            if (reviews.length > 0) lastSeenId.current = Math.max(...reviews.map((r) => r.id));
            else lastSeenId.current = 0;
          } else if (reviews.length > 0) {
            queue.current.push(...reviews.slice().reverse());
            lastSeenId.current = Math.max(lastSeenId.current, ...reviews.map((r) => r.id));
            if (!showingTimer.current) showNext();
          }
        }
      } catch {
        // tenta de novo no próximo ciclo
      }
      pollTimer = setTimeout(poll, POLL_INTERVAL_MS);
    }

    poll();
    return () => {
      cancelled = true;
      if (pollTimer) clearTimeout(pollTimer);
      if (showingTimer.current) clearTimeout(showingTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!current) return null;

  return (
    <div
      role="status"
      className="fixed bottom-24 left-4 right-4 z-40 flex items-center gap-3 border border-ink/15 bg-cream p-3 pr-4 shadow-lg animate-[fadeIn_0.2s_ease-out] sm:bottom-5 sm:left-5 sm:right-auto sm:max-w-xs"
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-red/10 text-brand-red font-display text-sm">
        {current.customerName.charAt(0).toUpperCase()}
      </div>
      <div className="text-xs leading-snug">
        <p>
          <span className="font-semibold">{current.customerName}</span> avaliou{" "}
          <span className="font-semibold">{current.productName}</span>
        </p>
        <StarRatingDisplay value={current.rating} className="mt-1" />
      </div>
    </div>
  );
}
