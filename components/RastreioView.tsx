"use client";

import { useState } from "react";
import Link from "next/link";
import { formatCents } from "@/lib/format";
import { maskCPF } from "@/lib/masks";

interface PedidoRastreio {
  id: number;
  status: "pending" | "paid" | "canceled" | "refunded";
  total: number;
  createdAt: string;
  trackingCode: string | null;
  carrier: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  cidade: string;
  estado: string;
  primeiroNome: string;
  itens: Array<{ nome: string; variante: string | null; quantidade: number }>;
}

/** Etapas na ordem em que acontecem. `alcancada` é calculada a partir do pedido. */
function montarEtapas(p: PedidoRastreio) {
  const pago = p.status === "paid";
  const enviado = Boolean(p.shippedAt);
  const entregue = Boolean(p.deliveredAt);
  return [
    {
      titulo: "Pedido recebido",
      detalhe: formatarData(p.createdAt),
      alcancada: true,
    },
    {
      titulo: "Pagamento confirmado",
      detalhe: pago ? "Recebemos seu PIX" : "Aguardando o pagamento",
      alcancada: pago,
    },
    {
      titulo: "Em preparação",
      detalhe: pago && !enviado ? "Separando e embalando seu pedido" : "",
      alcancada: pago,
    },
    {
      titulo: "Enviado",
      detalhe: enviado ? formatarData(p.shippedAt) : "",
      alcancada: enviado,
    },
    {
      titulo: "Entregue",
      detalhe: entregue ? formatarData(p.deliveredAt) : "",
      alcancada: entregue,
    },
  ];
}

function formatarData(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
}

export function RastreioView({ whatsapp }: { whatsapp: string | null }) {
  const [pedidoInput, setPedidoInput] = useState("");
  const [documento, setDocumento] = useState("");
  const [pedido, setPedido] = useState<PedidoRastreio | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [copiado, setCopiado] = useState(false);

  async function consultar(e: React.FormEvent) {
    e.preventDefault();
    setBuscando(true);
    setErro(null);
    setPedido(null);
    try {
      const res = await fetch("/api/rastreio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pedido: pedidoInput, documento }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErro(data.error ?? "Não foi possível consultar.");
        return;
      }
      setPedido(data.pedido);
    } catch {
      setErro("Falha de conexão. Verifique sua internet e tente de novo.");
    } finally {
      setBuscando(false);
    }
  }

  async function copiarCodigo() {
    if (!pedido?.trackingCode) return;
    try {
      await navigator.clipboard.writeText(pedido.trackingCode);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      // Sem clipboard (contexto não seguro): o código fica visível para copiar à mão.
    }
  }

  const linkWhatsapp = whatsapp
    ? `https://wa.me/${whatsapp}?text=${encodeURIComponent(
        pedido ? `Olá! Preciso de ajuda com o pedido #${pedido.id}.` : "Olá! Preciso de ajuda com meu pedido."
      )}`
    : null;

  return (
    <div className="mx-auto max-w-2xl px-5 py-12 sm:px-8">
      <h1 className="font-display text-4xl sm:text-5xl">RASTREAR PEDIDO</h1>
      <p className="mt-3 text-sm text-ink/60">
        Informe o número do pedido e o CPF usado na compra para ver o andamento da entrega.
      </p>

      <form onSubmit={consultar} className="mt-8 flex flex-col gap-4 border border-ink/15 p-6">
        <div>
          <label htmlFor="pedido" className="mb-1 block text-xs font-semibold uppercase tracking-wide">
            Número do pedido
          </label>
          <input
            id="pedido"
            inputMode="numeric"
            required
            value={pedidoInput}
            onChange={(e) => setPedidoInput(e.target.value.replace(/\D/g, ""))}
            placeholder="Ex.: 24"
            className="w-full border border-ink/20 bg-white px-3 py-3 text-base outline-none focus:border-ink"
          />
        </div>

        <div>
          <label htmlFor="documento" className="mb-1 block text-xs font-semibold uppercase tracking-wide">
            CPF da compra
          </label>
          <input
            id="documento"
            inputMode="numeric"
            required
            value={documento}
            onChange={(e) => setDocumento(maskCPF(e.target.value))}
            placeholder="000.000.000-00"
            className="w-full border border-ink/20 bg-white px-3 py-3 text-base outline-none focus:border-ink"
          />
        </div>

        <button
          type="submit"
          disabled={buscando}
          className="bg-ink py-3.5 text-sm font-semibold uppercase tracking-wide text-cream transition-colors hover:bg-brand-red disabled:opacity-60"
        >
          {buscando ? "Consultando…" : "Consultar pedido"}
        </button>

        {erro && <p className="text-sm text-brand-red">{erro}</p>}
      </form>

      {pedido && (
        <div className="mt-10">
          <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-ink/15 pb-4">
            <div>
              <h2 className="font-display text-2xl">PEDIDO #{pedido.id}</h2>
              <p className="text-sm text-ink/60">
                Olá, {pedido.primeiroNome} · {pedido.cidade}/{pedido.estado}
              </p>
            </div>
            <span className="font-display text-xl">{formatCents(pedido.total)}</span>
          </div>

          {pedido.status === "canceled" && (
            <p className="mt-6 border border-brand-red/40 bg-brand-red/5 p-4 text-sm text-brand-red">
              Este pedido foi cancelado porque o pagamento não foi concluído. Se você pagou e vê esta
              mensagem, fale com a gente.
            </p>
          )}

          {/* Linha do tempo */}
          <ol className="mt-8 flex flex-col">
            {montarEtapas(pedido).map((etapa, i, todas) => (
              <li key={etapa.titulo} className="flex gap-4">
                <div className="flex flex-col items-center">
                  <span
                    aria-hidden
                    className={`mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                      etapa.alcancada ? "border-brand-red bg-brand-red" : "border-ink/25 bg-cream"
                    }`}
                  >
                    {etapa.alcancada && (
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" aria-hidden>
                        <path
                          d="M5 13l4 4L19 7"
                          stroke="white"
                          strokeWidth="3.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                  </span>
                  {i < todas.length - 1 && (
                    <span
                      aria-hidden
                      className={`w-0.5 flex-1 ${etapa.alcancada ? "bg-brand-red" : "bg-ink/15"}`}
                    />
                  )}
                </div>
                <div className={`pb-8 ${etapa.alcancada ? "" : "opacity-45"}`}>
                  <p className="font-semibold leading-5">{etapa.titulo}</p>
                  {etapa.detalhe && <p className="mt-0.5 text-sm text-ink/60">{etapa.detalhe}</p>}
                </div>
              </li>
            ))}
          </ol>

          {/* Código de rastreio */}
          {pedido.trackingCode ? (
            <div className="border border-ink/15 p-6">
              <h3 className="font-display text-lg">CÓDIGO DE RASTREIO</h3>
              {pedido.carrier && <p className="text-sm text-ink/60">{pedido.carrier}</p>}
              <p className="mt-3 break-all border border-ink/15 bg-white p-3 font-mono text-sm">
                {pedido.trackingCode}
              </p>
              <button
                type="button"
                onClick={copiarCodigo}
                className="mt-3 w-full border border-ink py-3 text-xs font-semibold uppercase tracking-wide transition-colors hover:bg-ink hover:text-cream"
              >
                {copiado ? "Código copiado!" : "Copiar código"}
              </button>
              <p className="mt-3 text-xs text-ink/50">
                Pode levar até 24h para o código aparecer no site da transportadora.
              </p>
            </div>
          ) : (
            pedido.status === "paid" && (
              <div className="border border-dashed border-ink/25 p-6 text-sm text-ink/60">
                Seu pedido está sendo preparado. Assim que for postado, o código de rastreio aparece
                aqui.
              </div>
            )
          )}

          {/* Itens */}
          <div className="mt-6 border border-ink/15 p-6">
            <h3 className="mb-3 font-display text-lg">ITENS</h3>
            <ul className="flex flex-col gap-2">
              {pedido.itens.map((item, i) => (
                <li key={i} className="text-sm">
                  {item.nome}
                  {item.variante ? ` — ${item.variante}` : ""}
                  <span className="text-ink/50"> · {item.quantidade}x</span>
                </li>
              ))}
            </ul>
          </div>

          {pedido.status === "pending" && (
            <Link
              href={`/pedido/${pedido.id}/pix`}
              className="mt-6 block w-full bg-ink py-4 text-center text-sm font-semibold uppercase tracking-wide text-cream transition-colors hover:bg-brand-red"
            >
              Pagar com PIX
            </Link>
          )}
        </div>
      )}

      {/* Suporte — some sozinho se o WhatsApp não estiver configurado. */}
      {linkWhatsapp && (
        <div className="mt-10 border border-ink/15 p-6 text-center">
          <h3 className="font-display text-lg">PRECISA DE AJUDA?</h3>
          <p className="mt-1 text-sm text-ink/60">
            Fale com a gente no WhatsApp. Respondemos em horário comercial.
          </p>
          <a
            href={linkWhatsapp}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex w-full items-center justify-center gap-2 bg-[#25D366] py-3.5 text-sm font-semibold uppercase tracking-wide text-white transition-opacity hover:opacity-90"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M17.47 14.38c-.3-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.64.07-.3-.15-1.25-.46-2.38-1.47-.88-.78-1.47-1.75-1.64-2.05-.17-.3-.02-.46.13-.6.13-.14.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.6-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.01-1.04 2.48s1.07 2.87 1.22 3.07c.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.69.63.71.22 1.36.19 1.87.12.57-.09 1.75-.72 2-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35z" />
              <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.86 9.86 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91S17.5 2 12.04 2zm0 18.02h-.01a8.2 8.2 0 0 1-4.18-1.15l-.3-.18-3.11.82.83-3.04-.2-.31a8.18 8.18 0 0 1-1.26-4.37c0-4.54 3.7-8.23 8.24-8.23 2.2 0 4.27.86 5.82 2.42a8.18 8.18 0 0 1 2.41 5.82c0 4.54-3.7 8.23-8.24 8.23z" />
            </svg>
            Falar no WhatsApp
          </a>
        </div>
      )}
    </div>
  );
}
