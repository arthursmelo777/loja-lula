import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getProductBySlug } from "@/lib/products";
import { ProductDetail } from "@/components/ProductDetail";

// Força renderização dinâmica (por requisição): esta página lê avaliações
// (nota média, lista, contagem) direto do Postgres via getRatingSummary/
// getReviewsForProduct. Com `revalidate` + `generateStaticParams`, o Next tenta
// pré-gerar cada página de produto estaticamente durante o `next build`, o que
// faz o build depender de conseguir conectar no banco a partir da máquina de
// build da Vercel — se a conexão falhar ou demorar, o build inteiro quebra com
// "Error occurred prerendering page". `force-dynamic` evita isso: a consulta só
// roda em runtime (a cada requisição), nunca durante o build.
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = getProductBySlug(slug);
  if (!product) return {};
  return {
    title: `${product.name} — VesteLula`,
    description: product.description,
  };
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = getProductBySlug(slug);
  if (!product) notFound();

  // As avaliações não aparecem aqui de propósito: ficam visíveis apenas no
  // painel admin e para quem as escreveu, na própria tela do pedido.
  return <ProductDetail product={product} />;
}
