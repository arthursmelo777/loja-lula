"use client";

import { useEffect } from "react";
import { trackMetaEvent } from "@/lib/meta-pixel-client";

interface Props {
  orderId: number;
  value: number; // em reais
  currency: string;
  contentIds: string[];
}

/**
 * Dispara o evento Purchase do pixel do navegador quando o cliente chega na
 * tela de sucesso. Usa o mesmo event id (`order-{id}`) do evento equivalente
 * enviado pela Conversions API (server-side), pro Meta deduplicar os dois.
 */
export function TrackPurchase({ orderId, value, currency, contentIds }: Props) {
  useEffect(() => {
    trackMetaEvent(
      "Purchase",
      { value, currency, content_ids: contentIds, content_type: "product" },
      `order-${orderId}`
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- dispara uma vez ao montar
  }, [orderId]);

  return null;
}
