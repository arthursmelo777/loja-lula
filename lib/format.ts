/** Formata um valor em centavos como moeda brasileira, ex: 2990 -> "R$ 29,90" */
export function formatCents(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

/**
 * Formata o nome de um cliente para exibição pública (avaliações), mostrando
 * apenas o primeiro nome e a inicial do último sobrenome — protege a
 * privacidade de quem compra, já que o nome completo fica só no admin.
 * Ex: "Maria da Silva Santos" -> "Maria S."
 */
export function formatReviewerName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "Cliente";
  if (parts.length === 1) return parts[0];
  const first = parts[0];
  const lastInitial = parts[parts.length - 1][0];
  return `${first} ${lastInitial}.`;
}
