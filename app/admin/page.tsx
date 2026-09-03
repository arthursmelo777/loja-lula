"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { formatCents } from "@/lib/format";
import type { OrderRecord, OrderStatus } from "@/types";

const FILTERS: Array<{ value: OrderStatus | "all"; label: string }> = [
  { value: "all", label: "Todos" },
  { value: "pending", label: "Aguardando pagamento" },
  { value: "paid", label: "Pagos" },
  { value: "canceled", label: "Cancelados" },
  { value: "refunded", label: "Reembolsados" },
];

const STATUS_LABEL: Record<OrderStatus, string> = {
  pending: "Aguardando",
  paid: "Pago",
  canceled: "Cancelado",
  refunded: "Reembolsado",
};

export default function AdminOrdersPage() {
  const router = useRouter();
  const [filter, setFilter] = useState<OrderStatus | "all">("all");
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (currentFilter: OrderStatus | "all") => {
    setLoading(true);
    setError(null);
    try {
      const qs = currentFilter === "all" ? "" : `?status=${currentFilter}`;
      const res = await fetch(`/api/admin/orders${qs}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Falha ao carregar pedidos.");
      const data = await res.json();
      setOrders(data.orders ?? []);
    } catch {
      setError("Não foi possível carregar os pedidos.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carrega os pedidos ao trocar o filtro
    load(filter);
  }, [filter, load]);

  async function handleLogout() {
    await fetch("/api/admin/login", { method: "DELETE" });
    router.push("/admin/login");
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-6xl px-5 py-10 sm:px-8">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl sm:text-4xl">PEDIDOS</h1>
        <button onClick={handleLogout} className="text-sm text-ink/50 underline underline-offset-2">
          Sair
        </button>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`border px-4 py-2 text-xs font-semibold uppercase tracking-wide ${
              filter === f.value ? "border-ink bg-ink text-cream" : "border-ink/20"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="mt-6 overflow-x-auto border border-ink/15">
        {loading ? (
          <p className="p-6 text-sm text-ink/60">Carregando pedidos…</p>
        ) : error ? (
          <p className="p-6 text-sm text-brand-red">{error}</p>
        ) : orders.length === 0 ? (
          <p className="p-6 text-sm text-ink/60">Nenhum pedido encontrado.</p>
        ) : (
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="hairline bg-cream-dark/60">
              <tr>
                <th className="px-4 py-3 font-semibold">Pedido</th>
                <th className="px-4 py-3 font-semibold">Cliente</th>
                <th className="px-4 py-3 font-semibold">Valor</th>
                <th className="px-4 py-3 font-semibold">Pagamento</th>
                <th className="px-4 py-3 font-semibold">Data</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id} className="hairline hover:bg-cream-dark/40">
                  <td className="px-4 py-3">
                    <Link href={`/admin/pedidos/${order.id}`} className="font-semibold underline underline-offset-2">
                      #{order.id}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <div>{order.customer_name}</div>
                    <div className="text-xs text-ink/50">{order.customer_email}</div>
                  </td>
                  <td className="px-4 py-3 font-medium">{formatCents(order.total)}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-1 text-xs font-semibold uppercase ${
                        order.payment_status === "paid"
                          ? "bg-black/5 text-ink"
                          : order.payment_status === "pending"
                            ? "bg-brand-red/10 text-brand-red"
                            : "bg-ink/5 text-ink/50"
                      }`}
                    >
                      {STATUS_LABEL[order.payment_status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-ink/60">
                    {new Date(order.created_at).toLocaleString("pt-BR")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
