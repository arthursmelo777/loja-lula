import { NextRequest, NextResponse } from "next/server";
import { getOrderById, getOrderItems, attachTransaction } from "@/lib/db";
import { getProductById } from "@/lib/products";
import { getProcessadora, ProcessadoraNaoConfigurada } from "@/lib/pagamentos";
import { generatePixQrCodeImage } from "@/lib/pix-qrcode";

/**
 * Gera (ou regera) a cobrança PIX de um pedido que já existe no banco.
 *
 * O checkout cria o pedido ANTES de falar com a processadora. Quando ela
 * falha, o pedido fica salvo com status "pending" mas sem código PIX nenhum, e
 * a resposta do checkout já mandava o comprador para a tela do pedido dizendo
 * "você pode tentar novamente na tela do pedido" — só que não existia nada por
 * lá para tentar de novo, e o pedido ficava preso em "QR Code indisponível"
 * para sempre. Esta rota é esse "tentar de novo".
 *
 * Os valores NUNCA vêm do cliente: relemos o pedido e os itens já gravados no
 * banco, então o comprador não consegue alterar o preço do que vai pagar.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const orderId = Number(id);
  if (!Number.isInteger(orderId) || orderId <= 0) {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }

  let order;
  try {
    order = await getOrderById(orderId);
  } catch (err) {
    console.error("Falha ao ler o pedido para regerar o PIX:", err);
    return NextResponse.json(
      { error: "Não foi possível consultar o pedido agora. Tente novamente em instantes." },
      { status: 503 }
    );
  }

  if (!order) {
    return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });
  }

  // Um pedido já pago, cancelado ou estornado não pode ganhar cobrança nova.
  if (order.payment_status !== "pending") {
    return NextResponse.json(
      { error: "Este pedido não está mais aguardando pagamento.", status: order.payment_status },
      { status: 409 }
    );
  }

  // Idempotente: se a cobrança já existe, devolvemos a mesma — nunca criamos
  // uma segunda cobrança para o mesmo pedido só porque alguém clicou de novo.
  if (order.pix_qr_code_text) {
    return NextResponse.json({
      qrCodeText: order.pix_qr_code_text,
      qrCodeImage: order.pix_qr_code ?? (await generatePixQrCodeImage(order.pix_qr_code_text)),
    });
  }

  const items = await getOrderItems(order.id);
  if (items.length === 0) {
    return NextResponse.json({ error: "Pedido sem itens." }, { status: 409 });
  }

  try {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? request.nextUrl.origin;
    const processadora = getProcessadora();

    const cobranca = await processadora.criarCobrancaPix({
      valor: order.total,
      cliente: {
        nome: order.customer_name,
        email: order.customer_email,
        telefone: order.customer_phone,
        documento: order.customer_document,
        rua: order.street,
        numero: order.number,
        complemento: order.complement ?? "",
        bairro: order.neighborhood,
        cidade: order.city,
        estado: order.state,
        cep: order.zip_code,
      },
      itens: items.map((item) => {
        const product = getProductById(item.product_id);
        if (!product) {
          throw new Error(`Produto ${item.product_id} não existe mais no catálogo.`);
        }
        const parts = [item.product_name];
        if (item.variant) parts.push(item.variant);
        if (item.custom_name) parts.push(`Nome: ${item.custom_name}`);
        return {
          productId: item.product_id,
          category: product.category,
          titulo: parts.join(" - "),
          precoUnitario: item.unit_price,
          quantidade: item.quantity,
        };
      }),
      urlWebhook: `${siteUrl}/api/webhooks/pagamento`,
      tracking: {
        // `src` não é persistido no pedido; os demais UTMs voltam do banco.
        src: "",
        utm_source: order.utm_source ?? "",
        utm_medium: order.utm_medium ?? "",
        utm_campaign: order.utm_campaign ?? "",
        utm_term: order.utm_term ?? "",
        utm_content: order.utm_content ?? "",
      },
    });

    if (!cobranca.qrCodeTexto && !cobranca.qrCodeImagem) {
      console.error("Processadora respondeu sem código PIX:", JSON.stringify(cobranca.raw));
      return NextResponse.json(
        { error: "A processadora respondeu sem o código PIX. Tente novamente em instantes." },
        { status: 502 }
      );
    }

    await attachTransaction(
      order.id,
      cobranca.idTransacao,
      cobranca.qrCodeImagem,
      cobranca.qrCodeTexto,
      cobranca.raw
    );

    return NextResponse.json({
      qrCodeText: cobranca.qrCodeTexto,
      qrCodeImage:
        cobranca.qrCodeImagem ??
        (cobranca.qrCodeTexto ? await generatePixQrCodeImage(cobranca.qrCodeTexto) : null),
    });
  } catch (err) {
    if (err instanceof ProcessadoraNaoConfigurada) {
      console.error("Tentativa de gerar PIX sem processadora configurada:", err);
      return NextResponse.json(
        { error: "Pagamento indisponível no momento. Tente novamente mais tarde." },
        { status: 503 }
      );
    }
    console.error("Falha ao gerar a cobrança PIX:", err);
    return NextResponse.json(
      { error: "Não foi possível gerar o PIX agora. Tente novamente em instantes." },
      { status: 502 }
    );
  }
}
