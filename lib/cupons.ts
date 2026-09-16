/**
 * Cupom de campanha usado na página de entrada /oferta.
 *
 * Precisa bater com a linha semeada em ensureSchema(): é o banco que aplica o
 * desconto no checkout, não esta constante. Aqui ficam apenas o código e o
 * percentual que a página mostra ao visitante — se os dois divergirem, a página
 * prometeria um desconto que o checkout não daria.
 */
export const CUPOM_CAMPANHA = {
  codigo: "BEMVINDO5",
  percentual: 5,
} as const;

const CHAVE_SESSAO = "lula_cupom_v1";

/**
 * Guarda o cupom que veio na URL (?cupom=...) para a sessão inteira.
 *
 * A página de entrada manda o visitante para a home, não direto para o
 * checkout — então sem persistir, o código se perderia na primeira navegação e
 * a promessa da presell morreria ali. Chame no cliente, em toda página.
 */
export function capturarCupomDaUrl(): void {
  if (typeof window === "undefined") return;
  const codigo = new URLSearchParams(window.location.search).get("cupom");
  if (!codigo) return;
  try {
    window.sessionStorage.setItem(CHAVE_SESSAO, codigo.trim().toUpperCase());
  } catch {
    // Modo privado ou storage bloqueado: a pessoa ainda pode colar o código à mão.
  }
}

/** Cupom capturado nesta sessão, se houver. */
export function getCupomSalvo(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage.getItem(CHAVE_SESSAO);
  } catch {
    return null;
  }
}
