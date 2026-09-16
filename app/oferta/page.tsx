import type { Metadata } from "next";
import { PresellCupom } from "@/components/PresellCupom";
import { CUPOM_CAMPANHA } from "@/lib/cupons";

export const metadata: Metadata = {
  title: "Seu cupom de desconto — VesteLula",
  description: "Resgate seu cupom e use no checkout.",
};

export default function OfertaPage() {
  return <PresellCupom codigo={CUPOM_CAMPANHA.codigo} percentual={CUPOM_CAMPANHA.percentual} />;
}
