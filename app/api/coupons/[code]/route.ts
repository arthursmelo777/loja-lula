import { NextRequest, NextResponse } from "next/server";
import { findValidCoupon } from "@/lib/db";

/** Só consulta — não resgata o cupom. Usado pelo checkout para mostrar o desconto antes de enviar o pedido. */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const coupon = await findValidCoupon(code);
  if (!coupon) {
    return NextResponse.json({ valid: false }, { status: 404 });
  }
  return NextResponse.json({ valid: true, discountPercent: coupon.discount_percent });
}
