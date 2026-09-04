import { NextRequest, NextResponse } from "next/server";
import { checkoutRequestSchema, isValidCPF } from "@/lib/validators";
import { priceCart } from "@/lib/pricing";
import { createOrder, attachTransaction } from "@/lib/db";
import { createPixTransaction, normalizeInvictusPixResponse } from "@/lib/invictuspay";

// Um product_hash por categoria, conforme fornecido pela InvictusPay.
function getProductHash(category: "camiseta" | "bone"): string {
  const hash =
    category === "camiseta"
      ? process.env.INVICTUSPAY_PRODUCT_HASH_SHIRT
      : process.env.INVICTUSPAY_PRODUCT_HASH_CAP;
  if (!hash) {
    throw new Error(
      `Variável de ambiente ausente: ${
        category === "camiseta" ? "INVICTUSPAY_PRODUCT_HASH_SHIRT" : "INVICTUSPAY_PRODUCT_HASH_CAP"
      }`
    );
  }
  return hash;
}

function getSiteUrl(request: NextRequest): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? request.nextUrl.origin;
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const parsed = checkoutRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados inválidos.", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { items, customer, tracking } = parsed.data;

  if (!isValidCPF(customer.document)) {
    return NextResponse.json({ error: "CPF inválido." }, { status: 400 });
  }

  let priced;
  try {
    priced = priceCart(items);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Carrinho inválido." },
      { status: 400 }
    );
  }

  if (priced.total <= 0) {
    return NextResponse.json({ error: "Carrinho vazio." }, { status: 400 });
  }

  // 1) Cria o pedido no banco com status "pending" antes de chamar o gateway.
  let order;
  try {
    order = await createOrder({
      customer: {
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        document: customer.document,
        street: customer.street,
        number: customer.number,
        complement: customer.complement,
        neighborhood: customer.neighborhood,
        city: customer.city,
        state: customer.state,
        zipCode: customer.zipCode,
      },
      items: priced.items.map((i) => ({
        productId: i.productId,
        productName: i.productName,
        variant: i.variant,
        customName: i.customName,
        unitPrice: i.unitPrice,
        quantity: i.quantity,
        total: i.total,
      })),
      subtotal: priced.subtotal,
      total: priced.total,
      utm: tracking,
    });
  } catch (err) {
    console.error("Falha ao criar pedido no banco:", err);
    return NextResponse.json(
      { error: "Não foi possível criar o pedido. Tente novamente em instantes." },
      { status: 500 }
    );
  }

  // 2) Chama a InvictusPay para gerar a cobrança PIX.
  try {
    const siteUrl = getSiteUrl(request);
    const raw = await createPixTransaction({
      amount: priced.total,
      customer: {
        name: customer.name,
        email: customer.email,
        phone_number: customer.phone,
        document: customer.document,
        street_name: customer.street,
        number: customer.number,
        complement: customer.complement ?? "",
        neighborhood: customer.neighborhood,
        city: customer.city,
        state: customer.state,
        zip_code: customer.zipCode,
      },
      cart: priced.items.map((i) => {
        const parts = [i.productName];
        if (i.variant) parts.push(i.variant);
        if (i.customName) parts.push(`Nome: ${i.customName}`);
        return {
          product_hash: getProductHash(i.category),
          title: parts.join(" - "),
          cover: null,
          price: i.unitPrice,
          quantity: i.quantity,
          operation_type: 1,
          tangible: true,
        };
      }),
      postbackUrl: `${siteUrl}/api/webhooks/invictuspay`,
      tracking,
    });

    const normalized = normalizeInvictusPixResponse(raw);

    await attachTransaction(
      order.id,
      normalized.transactionHash,
      normalized.qrCodeImage,
      normalized.qrCodeText,
      raw
    );

    return NextResponse.json({
      orderId: order.id,
      redirectUrl: `/pedido/${order.id}/pix`,
    });
  } catch (err) {
    console.error("Falha ao criar transação PIX na InvictusPay:", err);
    return NextResponse.json(
      {
        error:
          "Pedido criado, mas a geração do PIX falhou. Você pode tentar novamente na tela do pedido.",
        orderId: order.id,
        redirectUrl: `/pedido/${order.id}/pix`,
      },
      { status: 502 }
    );
  }
}
