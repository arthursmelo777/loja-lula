import { NextRequest, NextResponse } from "next/server";
import { listOrders } from "@/lib/db";
import type { OrderStatus } from "@/types";

const VALID_STATUSES: OrderStatus[] = ["pending", "paid", "canceled", "refunded"];

export async function GET(request: NextRequest) {
  const statusParam = request.nextUrl.searchParams.get("status");
  const filter =
    statusParam && VALID_STATUSES.includes(statusParam as OrderStatus)
      ? (statusParam as OrderStatus)
      : undefined;

  try {
    const orders = await listOrders(filter);
    return NextResponse.json({ orders });
  } catch (err) {
    console.error("Falha ao listar pedidos:", err);
    return NextResponse.json({ error: "Falha ao carregar pedidos." }, { status: 500 });
  }
}
