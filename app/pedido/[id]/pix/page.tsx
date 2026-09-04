import { notFound } from "next/navigation";
import { getOrderById } from "@/lib/db";
import { generatePixQrCodeImage } from "@/lib/pix-qrcode";
import { PixPaymentView } from "@/components/PixPaymentView";

export const dynamic = "force-dynamic";

export default async function PedidoPixPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const orderId = Number(id);
  if (!Number.isFinite(orderId)) notFound();

  const order = await getOrderById(orderId);
  if (!order) notFound();

  // Prioriza uma imagem vinda do gateway, se algum dia existir; na prática a
  // InvictusPay só devolve o texto, então geramos a imagem a partir dele.
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
