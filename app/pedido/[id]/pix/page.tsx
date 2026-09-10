import { notFound } from "next/navigation";
import { getOrderById } from "@/lib/db";
import { generatePixQrCodeImage } from "@/lib/pix-qrcode";
import { PixPaymentView } from "@/components/PixPaymentView";
import { PedidoIndisponivel } from "@/components/PedidoIndisponivel";

export const dynamic = "force-dynamic";

export default async function PedidoPixPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const orderId = Number(id);
  if (!Number.isFinite(orderId)) notFound();

  // Uma falha ao ler o pedido (banco fora do ar, credencial inválida) não pode
  // virar a tela branca de erro do runtime: esta é a página que o comprador
  // abre logo depois de finalizar a compra. Mostramos um aviso claro com botão
  // de tentar de novo, sem nunca inventar dados de pagamento.
  let order;
  try {
    order = await getOrderById(orderId);
  } catch (err) {
    console.error(`Falha ao carregar o pedido ${orderId}:`, err);
    return <PedidoIndisponivel orderId={orderId} />;
  }

  if (!order) notFound();

  // Prioriza a imagem vinda da processadora, quando ela manda uma; do
  // contrário, geramos o QR Code a partir do código "copia e cola".
  const qrCodeImage =
    order.pix_qr_code ?? (order.pix_qr_code_text ? await generatePixQrCodeImage(order.pix_qr_code_text) : null);

  return (
    <PixPaymentView
      orderId={order.id}
      total={order.total}
      qrCodeImage={qrCodeImage}
      qrCodeText={order.pix_qr_code_text}
      initialStatus={order.payment_status}
    />
  );
}
