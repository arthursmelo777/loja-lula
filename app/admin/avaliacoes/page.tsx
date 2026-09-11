"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Avaliacao {
  id: number;
  order_id: number;
  product_id: string;
  product_name: string | null;
  customer_name: string;
  rating: number;
  comment: string | null;
  created_at: string;
  approved: boolean;
}

/**
 * Avaliações recebidas — visíveis somente aqui.
 *
 * Elas saíram das páginas públicas: não aparecem na vitrine, na página de
 * produto nem em aviso flutuante. Quem escreveu continua vendo a própria
 * avaliação na tela do seu pedido.
 */
export default function AdminAvaliacoesPage() {
  const [avaliacoes, setAvaliacoes] = useState<Avaliacao[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState<number | null>(null);

  async function carregar() {
    try {
      const res = await fetch("/api/admin/reviews", { cache: "no-store" });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setAvaliacoes(data.avaliacoes ?? []);
    } catch {
      setErro("Não foi possível carregar as avaliações.");
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carrega a lista ao montar
    carregar();
  }, []);

  async function alternarAprovacao(id: number, aprovada: boolean) {
    setSalvando(id);
    try {
      const res = await fetch(`/api/admin/reviews/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aprovada }),
      });
      if (!res.ok) {
        alert("Não foi possível salvar.");
        return;
      }
      await carregar();
    } finally {
      setSalvando(null);
    }
  }

  const media =
    avaliacoes.length > 0
      ? avaliacoes.reduce((soma, a) => soma + a.rating, 0) / avaliacoes.length
      : 0;

  return (
    <div className="mx-auto max-w-3xl px-5 py-10 sm:px-8">
      <Link href="/admin" className="text-sm text-ink/50 underline underline-offset-2">
        ← Voltar aos pedidos
      </Link>

      <h1 className="mt-4 font-display text-3xl">AVALIAÇÕES</h1>
      <p className="mt-1 text-sm text-ink/60">
        Toda avaliação chega oculta. Aprove para que ela apareça na página do
        produto; o resto continua visível apenas aqui e para quem escreveu.
      </p>

      {carregando && <p className="mt-8 text-sm text-ink/60">Carregando…</p>}
      {erro && <p className="mt-8 text-sm text-brand-red">{erro}</p>}

      {!carregando && !erro && (
        <>
          <div className="mt-6 flex gap-8 border border-ink/15 p-6">
            <div>
              <p className="text-xs uppercase tracking-wide text-ink/50">Total</p>
              <p className="font-display text-3xl">{avaliacoes.length}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-ink/50">Média</p>
              <p className="font-display text-3xl">
                {avaliacoes.length > 0 ? media.toFixed(1) : "—"}
              </p>
            </div>
          </div>

          {avaliacoes.length === 0 ? (
            <p className="mt-8 border border-dashed border-ink/25 p-8 text-center text-sm text-ink/50">
              Nenhuma avaliação recebida ainda.
            </p>
          ) : (
            <ul className="mt-6 flex flex-col gap-4">
              {avaliacoes.map((a) => (
                <li key={a.id} className="border border-ink/15 p-5">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <div>
                      <p className="font-semibold">{a.customer_name}</p>
                      <p className="text-xs text-ink/50">
                        {a.product_name ?? a.product_id} ·{" "}
                        <Link
                          href={`/admin/pedidos/${a.order_id}`}
                          className="underline underline-offset-2"
                        >
                          pedido #{a.order_id}
                        </Link>
                      </p>
                    </div>
                    <span className="text-brand-red" aria-label={`${a.rating} de 5`}>
                      {"★".repeat(a.rating)}
                      <span className="text-ink/20">{"★".repeat(5 - a.rating)}</span>
                    </span>
                  </div>
                  {a.comment && <p className="mt-3 text-sm text-ink/80">{a.comment}</p>}
                  <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-ink/10 pt-3">
                    <span
                      className={`px-2 py-1 text-[10px] font-semibold uppercase tracking-wide ${
                        a.approved ? "bg-brand-red text-white" : "bg-ink/10 text-ink/60"
                      }`}
                    >
                      {a.approved ? "Aparece na loja" : "Oculta"}
                    </span>
                    <button
                      type="button"
                      disabled={salvando === a.id}
                      onClick={() => alternarAprovacao(a.id, !a.approved)}
                      className="border border-ink px-4 py-2 text-xs font-semibold uppercase tracking-wide transition-colors hover:bg-ink hover:text-cream disabled:opacity-50"
                    >
                      {salvando === a.id ? "Salvando…" : a.approved ? "Ocultar" : "Aprovar"}
                    </button>
                    <span className="ml-auto text-xs text-ink/40">
                      {new Date(a.created_at).toLocaleString("pt-BR")}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
