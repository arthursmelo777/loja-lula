import { NextRequest, NextResponse } from "next/server";
import { buscarPedidoParaRastreio } from "@/lib/db";
import { isValidCPF } from "@/lib/validators";

/**
 * Consulta pública de rastreio: número do pedido + CPF.
 *
 * Responde sempre a mesma mensagem quando não encontra, seja porque o pedido
 * não existe ou porque o CPF não confere. Distinguir os dois casos entregaria
 * de graça a informação de quais números de pedido existem.
 */
export async function POST(request: NextRequest) {
  let body: { pedido?: unknown; documento?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Requisição inválida." }, { status: 400 });
  }

  const orderId = Number(String(body.pedido ?? "").replace(/\D/g, ""));
  const documento = String(body.documento ?? "");

  if (!Number.isInteger(orderId) || orderId <= 0) {
    return NextResponse.json({ error: "Informe o número do pedido." }, { status: 400 });
  }
  if (!isValidCPF(documento)) {
    return NextResponse.json({ error: "CPF inválido." }, { status: 400 });
  }

  let pedido;
  try {
    pedido = await buscarPedidoParaRastreio(orderId, documento);
  } catch (err) {
    console.error("Falha ao consultar rastreio:", err);
    return NextResponse.json(
      { error: "Não foi possível consultar agora. Tente novamente em instantes." },
      { status: 503 }
    );
  }

  if (!pedido) {
    return NextResponse.json(
      { error: "Não encontramos um pedido com esse número e CPF. Confira os dados." },
      { status: 404 }
    );
  }

  return NextResponse.json({ pedido });
}
