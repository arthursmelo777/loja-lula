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

export function PixPaymentView({
  orderId,
  total,
  qrCodeImage: qrCodeImageInicial,
  qrCodeText: qrCodeTextInicial,
  initialStatus,
}: Props) {
  const router = useRouter();
  const [status, setStatus] = useState<OrderStatus>(initialStatus);
  const [copied, setCopied] = useState(false);
  const [erroCopia, setErroCopia] = useState(false);
  const [qrCodeImage, setQrCodeImage] = useState(qrCodeImageInicial);
  const [qrCodeText, setQrCodeText] = useState(qrCodeTextInicial);
  const [gerando, setGerando] = useState(false);
  const [erroGeracao, setErroGeracao] = useState<string | null>(null);
  const codigoRef = useRef<HTMLTextAreaElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * Refaz a cobrança quando o pedido existe mas ficou sem código PIX — o que
   * acontece se a chamada ao gateway falhou lá no checkout. Sem isto a tela
   * fica presa em "QR Code indisponível" e o pedido morre aqui.
   */
  async function gerarPix() {
    setGerando(true);
    setErroGeracao(null);
    try {
      const res = await fetch(`/api/orders/${orderId}/pix`, { method: "POST", cache: "no-store" });
      const data = await res.json();
      if (!res.ok) {
        setErroGeracao(data.error ?? "Não foi possível gerar o PIX. Tente novamente.");
        return;
      }
      setQrCodeText(data.qrCodeText ?? null);
      setQrCodeImage(data.qrCodeImage ?? null);
    } catch {
      setErroGeracao("Falha de conexão. Verifique sua internet e tente novamente.");
    } finally {
      setGerando(false);
    }
  }

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
    setErroCopia(false);

    // `navigator.clipboard` só existe em contexto seguro (HTTPS ou localhost).
    // Num acesso por http:// ou IP da rede — e em navegadores in-app, comuns
    // em tráfego de anúncio — ele é `undefined` e o botão não fazia nada, sem
    // aviso nenhum: o comprador clicava, nada acontecia, e não tinha como
    // levar o código para o app do banco. O fallback abaixo seleciona o texto
    // e usa `execCommand`, que funciona sem contexto seguro.
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(qrCodeText);
      } else if (!copiarComFallback()) {
        throw new Error("execCommand indisponível");
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      if (copiarComFallback()) {
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      } else {
        // Última linha de defesa: deixamos o código selecionado na tela e
        // avisamos, para o comprador copiar manualmente.
        codigoRef.current?.select();
        setErroCopia(true);
      }
    }
  }

  function copiarComFallback(): boolean {
    const campo = codigoRef.current;
    if (!campo) return false;
    campo.focus();
    campo.select();
    campo.setSelectionRange(0, campo.value.length); // iOS ignora select() sozinho
    try {
      return document.execCommand("copy");
    } catch {
      return false;
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
          <div className="flex h-56 w-56 flex-col items-center justify-center gap-3 border border-dashed border-ink/30 px-4 text-center text-sm text-ink/50">
            {gerando ? "Gerando seu PIX..." : "QR Code ainda não gerado"}
          </div>
        )}

        {qrCodeText ? (
          <div className="w-full">
            {/* Campo real (não um <p>): permite selecionar e copiar na mão
                quando a API de clipboard não está disponível. */}
            <textarea
              ref={codigoRef}
              readOnly
              value={qrCodeText}
              rows={3}
              aria-label="Código PIX copia e cola"
              onFocus={(e) => e.currentTarget.select()}
              className="mb-2 w-full resize-none break-all border border-ink/15 bg-white p-3 text-left font-mono text-xs text-ink/70"
            />
            <button
              type="button"
              onClick={handleCopy}
              className="w-full bg-ink py-3.5 text-sm font-semibold uppercase tracking-wide text-cream transition-colors hover:bg-brand-red"
            >
              {copied ? "Código PIX copiado!" : "Copiar código PIX"}
            </button>
            {erroCopia && (
              <p className="mt-2 text-xs text-brand-red">
                Não foi possível copiar automaticamente. O código está selecionado acima — copie com
                o toque longo ou Ctrl+C.
              </p>
            )}
          </div>
        ) : (
          <div className="w-full">
            <button
              type="button"
              onClick={gerarPix}
              disabled={gerando}
              className="w-full bg-ink py-3.5 text-sm font-semibold uppercase tracking-wide text-cream transition-colors hover:bg-brand-red disabled:cursor-not-allowed disabled:opacity-60"
            >
              {gerando ? "Gerando..." : "Gerar código PIX"}
            </button>
            {erroGeracao && <p className="mt-2 text-xs text-brand-red">{erroGeracao}</p>}
          </div>
        )}

        {/* Só faz sentido dizer que estamos esperando o pagamento quando o
            comprador realmente tem um código para pagar. */}
        {qrCodeText && (
          <div className="flex items-center gap-2 text-sm text-ink/60">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-red/60" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-brand-red" />
            </span>
            Aguardando seu pagamento...
          </div>
        )}

        <p className="text-xs text-ink/40">Pedido #{orderId}</p>
      </div>

      <p className="mt-6 text-sm text-ink/60">
        Após realizar o PIX, a confirmação acontece automaticamente nesta página.
      </p>
    </div>
  );
}
