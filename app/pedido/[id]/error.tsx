"use client";

import { useEffect } from "react";
import Link from "next/link";

/**
 * Tela de recuperação das páginas de pedido (PIX e sucesso).
 *
 * Diferente da vitrine, aqui NÃO dá para simplesmente ignorar uma falha de
 * banco e seguir: sem o pedido não existe valor, nem código PIX, nem status de
 * pagamento — mostrar a página "meio pronta" faria a loja mentir sobre uma
 * cobrança. O que dá para evitar é a tela branca de erro do runtime logo depois
 * de o comprador ter pago: aqui ele vê o que aconteceu e consegue tentar de
 * novo sem perder o link do pedido.
 */
export default function PedidoError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error("Falha ao carregar a página do pedido:", error);
  }, [error]);

  return (
    <div className="mx-auto max-w-md px-5 py-16 text-center sm:px-8">
      <h1 className="font-display text-3xl">NÃO CONSEGUIMOS CARREGAR SEU PEDIDO</h1>
      <p className="mt-4 text-sm text-ink/70">
        Isso costuma ser temporário. Seu pedido e seu pagamento não foram perdidos — tente carregar
        a página de novo em alguns segundos.
      </p>

      <button
        type="button"
        onClick={() => retry()}
        className="mt-8 w-full bg-ink py-3.5 text-sm font-semibold uppercase tracking-wide text-cream transition-colors hover:bg-brand-red"
      >
        Tentar novamente
      </button>

      <Link
        href="/"
        className="mt-3 inline-block w-full border border-ink py-3.5 text-sm font-semibold uppercase tracking-wide transition-colors hover:bg-ink hover:text-cream"
      >
        Voltar para a loja
      </Link>

      {error.digest && <p className="mt-6 text-xs text-ink/40">Código do erro: {error.digest}</p>}
    </div>
  );
}
