import { NextRequest, NextResponse } from "next/server";
import { getRecentReviews } from "@/lib/db";
import { getProductById } from "@/lib/products";

/**
 * Usada pelo aviso de prova social em tempo real: devolve as avaliações mais
 * recentes de toda a loja (todas reais, vindas de compradores verificados).
 * `after` filtra para trazer só avaliações mais novas que o id informado.
 */
export async function GET(request: NextRequest) {
  const afterParam = request.nextUrl.searchParams.get("after");
  const after = afterParam ? Number(afterParam) : null;

  const reviews = await getRecentReviews(10);
  const filtered = after && Number.isFinite(after) ? reviews.filter((r) => r.id > after) : reviews;

  const payload = filtered.map((r) => ({
    id: r.id,
    productId: r.product_id,
    productName: getProductById(r.product_id)?.name ?? "produto",
    customerName: r.customer_name,
    rating: r.rating,
    createdAt: r.created_at,
  }));

  return NextResponse.json({ reviews: payload });
}
