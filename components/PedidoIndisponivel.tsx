"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * Aviso usado quando o pedido existe, mas não conseguimos lê-lo agora (banco
 * fora do ar, credencial inválida, rede instável).
 *
 * A regra aqui é nunca inventar: não mostramos valor, status nem código PIX
 * que não vieram do banco — dizer "pago" ou "pendente" sem ter lido o pedido
 * faria a loja mentir sobre uma cobrança. O que oferecemos é recarregar.
 */
export function PedidoIndisponivel({ orderId }: { orderId: number }) {
  const router = useRouter();
  const [tentando, setTentando] = useState(false);

  return (
    <div className="mx-auto max-w-md px-5 py-16 text-center sm:px-8">
      <h1 className="font-display text-3xl">NÃO CONSEGUIMOS CARREGAR SEU PEDIDO</h1>
      <p className="mt-4 text-sm text-ink/70">
        Isso costuma ser temporário. Seu pedido <strong>não foi perdido</strong> — guarde o número
        abaixo e tente carregar a página de novo em alguns segundos.
      </p>

      <p className="mt-6 border border-ink/15 py-3 font-display text-2xl">Pedido #{orderId}</p>

      <button
        type="button"
        disabled={tentando}
        onClick={() => {
          setTentando(true);
          router.refresh();
          // O refresh é assíncrono; liberamos o botão para uma nova tentativa.
          setTimeout(() => setTentando(false), 2000);
        }}
        className="mt-8 w-full bg-ink py-3.5 text-sm font-semibold uppercase tracking-wide text-cream transition-colors hover:bg-brand-red disabled:cursor-not-allowed disabled:opacity-60"
      >
        {tentando ? "Tentando..." : "Tentar novamente"}
      </button>

      <Link
        href="/"
        className="mt-3 inline-block w-full border border-ink py-3.5 text-sm font-semibold uppercase tracking-wide transition-colors hover:bg-ink hover:text-cream"
      >
        Voltar para a loja
      </Link>
    </div>
  );
}
