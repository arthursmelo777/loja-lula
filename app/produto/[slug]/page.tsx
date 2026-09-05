import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getProductBySlug } from "@/lib/products";
import { getRatingSummary, getReviewsForProduct } from "@/lib/db";
import { ProductDetail } from "@/components/ProductDetail";
import { ProductReviews } from "@/components/ProductReviews";

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

  const [summary, reviews] = await Promise.all([
    getRatingSummary(product.id),
    getReviewsForProduct(product.id),
  ]);

  return (
    <>
      <ProductDetail product={product} />
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <ProductReviews average={summary.average} count={summary.count} reviews={reviews} />
      </div>
    </>
  );
}
