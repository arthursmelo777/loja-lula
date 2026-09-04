import type { ReviewRecord } from "@/types";
import { StarRatingDisplay } from "./StarRating";

interface Props {
  average: number;
  count: number;
  reviews: ReviewRecord[];
}

export function ProductReviews({ average, count, reviews }: Props) {
  return (
    <section className="mt-16 border-t border-ink/10 pt-10">
      <div className="flex items-center gap-3">
        <h2 className="font-display text-2xl">AVALIAÇÕES</h2>
        {count > 0 && (
          <span className="flex items-center gap-2 text-sm text-ink/60">
            <StarRatingDisplay value={average} />
            {average.toFixed(1)} · {count} {count === 1 ? "avaliação" : "avaliações"}
          </span>
        )}
      </div>

      {reviews.length === 0 ? (
        <p className="mt-4 text-sm text-ink/50">
          Ainda não há avaliações para este produto. Seja o primeiro a comprar e avaliar!
        </p>
      ) : (
        <ul className="mt-6 flex flex-col divide-y divide-ink/10">
          {reviews.map((review) => (
            <li key={review.id} className="py-4">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-semibold">{review.customer_name}</span>
                <span className="text-xs text-ink/40">
                  {new Date(review.created_at).toLocaleDateString("pt-BR")}
                </span>
              </div>
              <StarRatingDisplay value={review.rating} className="mt-1" />
              {review.comment && <p className="mt-2 text-sm text-ink/70">{review.comment}</p>}
              <span className="mt-2 inline-block text-xs font-medium text-brand-red">
                Compra verificada
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
