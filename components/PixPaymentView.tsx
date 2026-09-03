"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { formatCents } from "@/lib/format";
import type { OrderStatus } from "@/types";

interface Props {
  orderId: number;
  total: number;
  qrCodeImage: string | null;
  qrCodeText: string | null;
  initialStatus: OrderStatus;
}

const POLL_INTERVAL_MS = 5000;
const STOP_STATUSES: OrderStatus[] = ["paid", "canceled", "refunded"];

export function PixPaymentView({ orderId, total, qrCodeImage, qrCodeText, initialStatus }: Props) {
  const router = useRouter();
  const [status, setStatus] = useState<OrderStatus>(initialStatus);
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (STOP_STATUSES.includes(status)) {
      if (status === "paid") {
        router.push(`/pedido/${orderId}/sucesso`);
      }
      return;
    }

    async function poll() {
      try {
        const res = await fetch(`/api/orders/${orderId}/status`, { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          if (data.status) setStatus(data.status);
        }
      } catch {
        // tenta de novo no próximo intervalo
      }
      timerRef.current = setTimeout(poll, POLL_INTERVAL_MS);
    }

    timerRef.current = setTimeout(poll, POLL_INTERVAL_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, orderId]);

  async function handleCopy() {
    if (!qrCodeText) return;
    try {
      await navigator.clipboard.writeText(qrCodeText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // clipboard indisponível — o campo de texto ainda pode ser selecionado manualmente
    }
  }

  return (
    <div className="mx-auto max-w-md px-5 py-12 text-center sm:px-8">
      <h1 className="font-display text-3xl">PAGAMENTO PIX</h1>
      <p className="mt-2 font-display text-4xl">{formatCents(total)}</p>

      <div className="mt-8 flex flex-col items-center gap-6 border border-ink/15 p-6">
        {qrCodeImage ? (
          <div className="relative h-56 w-56 bg-white p-2">
            <Image
              src={qrCodeImage.startsWith("data:") ? qrCodeImage : `data:image/png;base64,${qrCodeImage}`}
              alt="QR Code do PIX"
              fill
              sizes="224px"
              className="object-contain"
              unoptimized
            />
          </div>
        ) : (
          <div className="flex h-56 w-56 items-center justify-center border border-dashed border-ink/30 text-sm text-ink/50">
            QR Code indisponível
          </div>
        )}

        {qrCodeText && (
          <div className="w-full">
            <p className="mb-2 break-all border border-ink/15 bg-white p-3 text-left text-xs text-ink/70">
              {qrCodeText}
            </p>
            <button
              type="button"
              onClick={handleCopy}
              className="w-full bg-ink py-3.5 text-sm font-semibold uppercase tracking-wide text-cream transition-colors hover:bg-brand-red"
            >
              {copied ? "Código PIX copiado!" : "Copiar código PIX"}
            </button>
          </div>
        )}

        <div className="flex items-center gap-2 text-sm text-ink/60">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-red/60" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-brand-red" />
          </span>
          Aguardando seu pagamento...
        </div>

        <p className="text-xs text-ink/40">Pedido #{orderId}</p>
      </div>

      <p className="mt-6 text-sm text-ink/60">
        Após realizar o PIX, a confirmação acontece automaticamente nesta página.
      </p>
    </div>
  );
}
