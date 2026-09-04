import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getProductBySlug, listProducts } from "@/lib/products";
import { getRatingSummary, getReviewsForProduct } from "@/lib/db";
import { ProductDetail } from "@/components/ProductDetail";
import { ProductReviews } from "@/components/ProductReviews";

// Revalida a cada 60s: a página é estática (rápida) mas as avaliações
// (nota média, lista, contagem) não ficam congeladas no momento do build.
export const revalidate = 60;

export function generateStaticParams() {
  return listProducts().map((p) => ({ slug: p.slug }));
}

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
