"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { formatCents } from "@/lib/format";
import type { OrderRecord, OrderItemRecord } from "@/types";

export default function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [order, setOrder] = useState<OrderRecord | null>(null);
  const [items, setItems] = useState<OrderItemRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refunding, setRefunding] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/orders/${id}`, { cache: "no-store" });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setOrder(data.order);
      setItems(data.items ?? []);
    } catch {
      setError("Pedido não encontrado.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carrega o pedido ao montar/trocar o id
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function handleRefund() {
    if (!order) return;
    if (!confirm(`Confirmar reembolso total de ${formatCents(order.total)}?`)) return;
    setRefunding(true);
    try {
      const res = await fetch(`/api/admin/orders/${id}/refund`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "Falha ao reembolsar.");
      } else {
        await load();
      }
    } finally {
      setRefunding(false);
    }
  }

  if (loading) return <p className="p-10 text-sm text-ink/60">Carregando…</p>;
  if (error || !order) return <p className="p-10 text-sm text-brand-red">{error}</p>;

  return (
    <div className="mx-auto max-w-3xl px-5 py-10 sm:px-8">
      <Link href="/admin" className="text-sm text-ink/50 underline underline-offset-2">
        ← Voltar aos pedidos
      </Link>

      <div className="mt-4 flex items-center justify-between">
        <h1 className="font-display text-3xl">PEDIDO #{order.id}</h1>
        <span className="px-3 py-1 text-xs font-semibold uppercase bg-ink/5">{order.payment_status}</span>
      </div>

      <div className="mt-8 grid gap-6 sm:grid-cols-2">
        <div className="border border-ink/15 p-6">
          <h2 className="mb-3 font-display text-lg">CLIENTE</h2>
          <p className="text-sm">{order.customer_name}</p>
          <p className="text-sm text-ink/60">{order.customer_email}</p>
          <p className="text-sm text-ink/60">{order.customer_phone}</p>
          <p className="text-sm text-ink/60">CPF {order.customer_document}</p>
        </div>
        <div className="border border-ink/15 p-6">
          <h2 className="mb-3 font-display text-lg">ENTREGA</h2>
          <p className="text-sm">
            {order.street}, {order.number} {order.complement}
          </p>
          <p className="text-sm text-ink/60">
            {order.neighborhood} — {order.city}/{order.state}
          </p>
          <p className="text-sm text-ink/60">CEP {order.zip_code}</p>
        </div>
      </div>

      <div className="mt-6 border border-ink/15 p-6">
        <h2 className="mb-3 font-display text-lg">ITENS</h2>
        <ul className="flex flex-col divide-y divide-ink/10">
          {items.map((item) => (
            <li key={item.id} className="flex justify-between py-2 text-sm">
              <span>
                {item.product_name}
                {item.variant ? ` — ${item.variant}` : ""} · {item.quantity}x
              </span>
              <span className="font-medium">{formatCents(item.total)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex justify-between border-t border-ink/10 pt-3 font-display text-lg">
          <span>TOTAL</span>
          <span>{formatCents(order.total)}</span>
        </div>
      </div>

      <div className="mt-6 border border-ink/15 p-6 text-sm text-ink/60">
        <h2 className="mb-2 font-display text-lg text-ink">PAGAMENTO</h2>
        <p>Hash da transação: {order.transaction_hash || "—"}</p>
        <p>Método: {order.payment_method}</p>
        {(order.utm_source || order.utm_medium || order.utm_campaign) && (
          <p className="mt-2">
            UTM: {order.utm_source} / {order.utm_medium} / {order.utm_campaign}
          </p>
        )}
      </div>

      {order.payment_status === "paid" && (
        <button
          onClick={handleRefund}
          disabled={refunding}
          className="mt-6 border border-brand-red px-6 py-3 text-sm font-semibold uppercase tracking-wide text-brand-red transition-colors hover:bg-brand-red hover:text-white disabled:opacity-60"
        >
          {refunding ? "Processando…" : "Reembolsar pedido"}
        </button>
      )}
    </div>
  );
}
