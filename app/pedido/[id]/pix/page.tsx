import { notFound } from "next/navigation";
import { getOrderById } from "@/lib/db";
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

  return (
    <PixPaymentView
      orderId={order.id}
      total={order.total}
      qrCodeImage={order.pix_qr_code}
      qrCodeText={order.pix_qr_code_text}
      initialStatus={order.payment_status}
    />
  );
}
