import "server-only";
import { createHash } from "node:crypto";

const GRAPH_API_VERSION = "v21.0";

function sha256(value: string): string {
  return createHash("sha256").update(value.trim().toLowerCase()).digest("hex");
}

export interface PurchaseEventInput {
  /** Mesmo id usado no evento equivalente do pixel do navegador, pra deduplicar no Meta. */
  eventId: string;
  value: number; // em reais, não centavos
  currency: string;
  email?: string;
  phone?: string; // qualquer formato — normalizamos e fazemos hash antes de enviar
  contentIds: string[];
  sourceUrl: string;
  /** Cookie `_fbp` do pixel, cru (não vai com hash). */
  fbp?: string | null;
  /** Cookie `_fbc`, que carrega o `fbclid` do clique no anúncio. É o campo que
   *  mais pesa pra Meta atribuir a venda ao anúncio certo. Cru, sem hash. */
  fbc?: string | null;
  clientIp?: string | null;
  userAgent?: string | null;
}

/**
 * Envia o evento Purchase pra Conversions API do Meta (server-side) — mais
 * confiável que só o pixel do navegador, já que não depende do cliente ter
 * chegado na tela de sucesso nem de ad blockers. Nunca lança: uma falha aqui
 * não pode derrubar o fluxo de pagamento.
 */
export async function sendMetaPurchaseEvent(input: PurchaseEventInput): Promise<void> {
  const pixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID;
  const accessToken = process.env.META_CONVERSIONS_API_TOKEN;
  if (!pixelId || !accessToken) {
    // Nunca em silêncio. Faltar o token da Conversions API não quebra nada
    // visível — o pagamento segue, a tela abre — mas a venda deixa de chegar
    // ao Meta, o algoritmo otimiza com dado incompleto e o ROAS aparece pior
    // do que é. Um problema invisível desses só se descobre auditando, então
    // ele precisa gritar no log.
    console.warn(
      "[meta] Purchase NÃO enviado: " +
        (!pixelId ? "NEXT_PUBLIC_META_PIXEL_ID ausente. " : "") +
        (!accessToken ? "META_CONVERSIONS_API_TOKEN ausente. " : "") +
        "A venda não será contabilizada na Conversions API."
    );
    return;
  }

  // Só e-mail e telefone vão com hash; fbp, fbc, IP e user-agent são enviados
  // crus, conforme a especificação da Conversions API.
  const userData: Record<string, string | string[]> = {};
  if (input.email) userData.em = [sha256(input.email)];
  if (input.phone) userData.ph = [sha256(input.phone.replace(/\D/g, ""))];
  if (input.fbp) userData.fbp = input.fbp;
  if (input.fbc) userData.fbc = input.fbc;
  if (input.clientIp) userData.client_ip_address = input.clientIp;
  if (input.userAgent) userData.client_user_agent = input.userAgent;

  const testEventCode = process.env.META_CONVERSIONS_API_TEST_EVENT_CODE;

  const body = {
    data: [
      {
        event_name: "Purchase",
        event_time: Math.floor(Date.now() / 1000),
        event_id: input.eventId,
        event_source_url: input.sourceUrl,
        action_source: "website",
        user_data: userData,
        custom_data: {
          currency: input.currency,
          value: input.value,
          content_ids: input.contentIds,
          content_type: "product",
        },
      },
    ],
    // Defina META_CONVERSIONS_API_TEST_EVENT_CODE (aba "Testar eventos" do
    // Gerenciador de Eventos) pra ver os eventos chegando ao vivo antes de
    // remover a variável e ativar de vez pros anúncios reais.
    ...(testEventCode ? { test_event_code: testEventCode } : {}),
  };

  try {
    const res = await fetch(
      `https://graph.facebook.com/${GRAPH_API_VERSION}/${pixelId}/events?access_token=${encodeURIComponent(accessToken)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );
    if (!res.ok) {
      console.error(`Meta Conversions API respondeu ${res.status}:`, await res.text());
    }
  } catch (err) {
    console.error("Falha ao enviar evento Purchase pra Meta Conversions API:", err);
  }
}
