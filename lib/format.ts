/** Formata um valor em centavos como moeda brasileira, ex: 2990 -> "R$ 29,90" */
export function formatCents(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}
