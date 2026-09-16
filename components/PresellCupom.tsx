"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Página de entrada de campanha: revela um cupom e leva à loja.
 *
 * O cupom é real — existe no banco, vale para qualquer pessoa e aplica o
 * desconto de verdade no checkout. Nada aqui promete o que a loja não cumpre.
 *
 * Os parâmetros de campanha (utm_*, src) que chegam nesta página são repassados
 * no redirecionamento: sem isso, toda venda vinda do anúncio apareceria como
 * tráfego direto, porque esta página seria a "origem" em vez do anúncio.
 */
export function PresellCupom({ codigo, percentual }: { codigo: string; percentual: number }) {
  const router = useRouter();
  const [copiado, setCopiado] = useState(false);
  const [indoParaLoja, setIndoParaLoja] = useState(false);

  /**
   * Preserva utm_source, utm_campaign, src etc. na ida para a loja. Sem isso,
   * toda venda vinda do anúncio apareceria como tráfego direto — esta página
   * viraria a "origem" no lugar do anúncio.
   */
  function montarDestino(): string {
    if (typeof window === "undefined") return "/";
    const atual = new URLSearchParams(window.location.search);
    atual.set("cupom", codigo);
    return `/?${atual.toString()}`;
  }

  async function resgatar() {
    let deuCerto = false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(codigo);
        deuCerto = true;
      }
    } catch {
      // Sem clipboard (contexto não seguro, navegador in-app): seguimos para o
      // fallback abaixo, e o código continua visível na tela para copiar à mão.
    }

    if (!deuCerto) {
      try {
        const campo = document.createElement("textarea");
        campo.value = codigo;
        campo.style.position = "fixed";
        campo.style.opacity = "0";
        document.body.appendChild(campo);
        campo.select();
        document.execCommand("copy");
        document.body.removeChild(campo);
      } catch {
        // Nada a fazer: o código está na tela e pode ser copiado manualmente.
      }
    }

    setCopiado(true);
    setIndoParaLoja(true);
    // Um respiro para a pessoa ver o "copiado" antes da troca de página.
    const destino = montarDestino();
    setTimeout(() => router.push(destino), 1200);
  }

  return (
    <div className="mx-auto flex min-h-[80vh] max-w-lg flex-col items-center justify-center px-5 py-12 text-center sm:px-8">
      <span className="text-5xl" aria-hidden>
        🎁
      </span>

      <h1 className="mt-6 font-display text-4xl leading-tight sm:text-5xl">
        VOCÊ GANHOU UM
        <br />
        CUPOM DE DESCONTO
      </h1>

      <p className="mt-4 text-base text-ink/70">
        {percentual}% de desconto em qualquer camiseta ou boné da loja. É só resgatar e usar no
        checkout.
      </p>

      <div className="mt-8 w-full border-2 border-dashed border-brand-red bg-white/60 px-6 py-7">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink/50">Seu cupom</p>
        <p className="mt-2 select-all font-display text-4xl tracking-wider text-brand-red">
          {codigo}
        </p>
        <p className="mt-2 text-xs text-ink/50">{percentual}% de desconto</p>
      </div>

      <button
        type="button"
        onClick={resgatar}
        disabled={indoParaLoja}
        className="mt-6 w-full bg-brand-red px-6 py-5 text-base font-bold uppercase tracking-wide text-white shadow-[6px_6px_0_0_rgba(10,10,10,0.9)] transition-colors hover:bg-brand-red-dark disabled:opacity-80"
      >
        {copiado ? "✓ Copiado! Indo para a loja…" : "Resgatar cupom"}
      </button>

      <p aria-live="polite" className="sr-only">
        {copiado ? "Cupom copiado" : ""}
      </p>

      <p className="mt-4 text-xs text-ink/50">
        Válido para todo o site · Pagamento via PIX · Envio para todo o Brasil
      </p>
    </div>
  );
}
