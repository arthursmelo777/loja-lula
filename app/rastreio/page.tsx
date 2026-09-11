import type { Metadata } from "next";
import { RastreioView } from "@/components/RastreioView";

export const metadata: Metadata = {
  title: "Rastrear pedido — VesteLula",
  description: "Acompanhe o andamento e a entrega do seu pedido.",
};

// A consulta acontece no cliente, via /api/rastreio — esta página é só a casca,
// então não há nada a pré-renderizar com dados de pedido.
export default function RastreioPage() {
  // Só o número, sem símbolos: wa.me exige o formato internacional cru.
  const whatsapp = process.env.NEXT_PUBLIC_WHATSAPP_SUPORTE?.replace(/\D/g, "") || null;
  return <RastreioView whatsapp={whatsapp} />;
}
