"use client";

import { useState } from "react";

function Star({ filled }: { filled: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 2.5l2.9 6.05 6.6.87-4.86 4.55 1.28 6.6L12 17.6l-5.92 3.07 1.28-6.6L2.5 9.42l6.6-.87L12 2.5z"
        fill={filled ? "var(--color-red)" : "none"}
        stroke={filled ? "var(--color-red)" : "currentColor"}
        strokeOpacity={filled ? 1 : 0.35}
        strokeWidth="1.5"
      />
    </svg>
  );
}

/** Exibição somente-leitura de uma nota (arredondada para a estrela mais próxima). */
export function StarRatingDisplay({ value, className }: { value: number; className?: string }) {
  const rounded = Math.round(value);
  return (
    <div className={`flex items-center gap-0.5 ${className ?? ""}`} aria-hidden="true">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} filled={i <= rounded} />
      ))}
    </div>
  );
}

/** Seletor de 1 a 5 estrelas, controlado externamente. */
export function StarRatingInput({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const active = hover ?? value;

  return (
    <div role="radiogroup" aria-label="Sua nota" className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((i) => (
        <button
          key={i}
          type="button"
          role="radio"
          aria-checked={value === i}
          aria-label={`${i} estrela${i > 1 ? "s" : ""}`}
          className="p-1"
          onMouseEnter={() => setHover(i)}
          onMouseLeave={() => setHover(null)}
          onClick={() => onChange(i)}
        >
          <span className="block scale-125">
            <Star filled={i <= active} />
          </span>
        </button>
      ))}
    </div>
  );
}
