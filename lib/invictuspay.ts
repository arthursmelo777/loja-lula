import "server-only";
import type { NormalizedPixResult, OrderStatus, UtmData } from "@/types";

function getBaseUrl(): string {
  const url = process.env.INVICTUSPAY_API_URL;
  if (!url) throw new Error("INVICTUSPAY_API_URL não configurada.");
  return url.replace(/\/+$/, "");
}

function getToken(): string {
  const token = process.env.INVICTUSPAY_API_TOKEN;
  if (!token) throw new Error("INVICTUSPAY_API_TOKEN não configurada.");
  return token;
}

interface InvictusCustomer {
  name: string;
  email: string;
  phone_number: string;
  document: string;
  street_name: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
  zip_code: string;
}

interface InvictusCartItem {
  product_hash: string;
  title: string;
  cover: string | null;
  price: number;
  quantity: number;
  operation_type: number;
  tangible: boolean;
}

export interface CreatePixTransactionInput {
  amount: number; // centavos — deve ser recalculado pelo backend, nunca recebido do cliente
  customer: InvictusCustomer;
  cart: InvictusCartItem[];
  postbackUrl: string;
  tracking: UtmData;
}

async function invictusFetch(path: string, init: RequestInit): Promise<unknown> {
  const url = `${getBaseUrl()}${path}${path.includes("?") ? "&" : "?"}api_token=${encodeURIComponent(
    getToken()
  )}`;

  const response = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(init.headers ?? {}),
    },
    // Nunca cachear chamadas de pagamento
    cache: "no-store",
  });

  const text = await response.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    // resposta não-JSON — devolvemos o texto bruto encapsulado para diagnóstico
    json = { raw_text: text };
  }

  if (!response.ok) {
    throw new Error(
      `InvictusPay respondeu ${response.status}: ${
        typeof json === "object" ? JSON.stringify(json) : String(json)
      }`
    );
  }

  return json;
}

export async function createPixTransaction(input: CreatePixTransactionInput): Promise<unknown> {
  const offerHash = process.env.INVICTUSPAY_OFFER_HASH;
  if (!offerHash) {
    throw new Error(
      "INVICTUSPAY_OFFER_HASH não configurada. Adicione o offer_hash fornecido pela InvictusPay no .env."
    );
  }

  const body = {
    amount: input.amount,
    offer_hash: offerHash,
    payment_method: "pix",
    customer: input.customer,
    cart: input.cart,
    expire_in_days: 1,
    transaction_origin: "api",
    tracking: {
      src: input.tracking.src,
      utm_source: input.tracking.utm_source,
      utm_medium: input.tracking.utm_medium,
      utm_campaign: input.tracking.utm_campaign,
      utm_term: input.tracking.utm_term,
      utm_content: input.tracking.utm_content,
    },
    postback_url: input.postbackUrl,
  };

  return invictusFetch("/transactions", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function getInvictusTransaction(hash: string): Promise<unknown> {
  return invictusFetch(`/transactions/${encodeURIComponent(hash)}`, { method: "GET" });
}

export async function refundInvictusTransaction(hash: string, amount: number): Promise<unknown> {
  return invictusFetch(`/transactions/${encodeURIComponent(hash)}/refund`, {
    method: "POST",
    body: JSON.stringify({ amount }),
  });
}

/**
 * Confirmado com uma resposta real de criação de transação PIX na InvictusPay.
 * O objeto vem no nível raiz (sem envelope `data`). Campos confirmados:
 *   hash: string                     — id da transação
 *   payment_status: string           — ex. "waiting_payment", "paid"
 *   pix.pix_qr_code: string          — código "copia e cola" (payload EMV)
 *   pix.qr_code_base64: null         — a API NÃO devolve a imagem pronta;
 *   pix.pix_url: null                  geramos o QR Code a partir do texto
 *                                       acima em lib/pix-qrcode.ts.
 * Mantemos os fallbacks para nomes alternativos por segurança (webhook e
 * outras respostas podem variar), mas nunca inventamos um campo inexistente.
 */
export function normalizeInvictusPixResponse(raw: unknown): NormalizedPixResult {
  const obj = (raw ?? {}) as Record<string, unknown>;
  const data = (obj.data ?? obj) as Record<string, unknown>;

  const pick = (...paths: string[][]): unknown => {
    for (const path of paths) {
      let current: unknown = data;
      for (const key of path) {
        if (current && typeof current === "object" && key in (current as Record<string, unknown>)) {
          current = (current as Record<string, unknown>)[key];
        } else {
          current = undefined;
          break;
        }
      }
      if (current !== undefined && current !== null) return current;
    }
    return null;
  };

  const transactionHash =
    (pick(["hash"]) as string | null) ??
    (pick(["transaction_hash"]) as string | null) ??
    (pick(["transaction", "hash"]) as string | null) ??
    "";

  const qrCodeImage =
    (pick(["pix", "qr_code_base64"]) as string | null) ??
    (pick(["pix", "qr_code"]) as string | null) ??
    (pick(["qr_code_base64"]) as string | null) ??
    (pick(["qr_code_image"]) as string | null) ??
    null;

  const qrCodeText =
    (pick(["pix", "qr_code_text"]) as string | null) ??
    (pick(["pix", "pix_qr_code"]) as string | null) ??
    (pick(["pix", "code"]) as string | null) ??
    (pick(["pix_qr_code"]) as string | null) ??
    (pick(["qr_code_text"]) as string | null) ??
    null;

  const rawStatus = (
    (pick(["payment_status"]) as string | null) ?? (pick(["status"]) as string | null) ?? "pending"
  ).toLowerCase();
  const status = normalizeStatus(rawStatus);

  return {
    transactionHash: transactionHash || "",
    qrCodeImage,
    qrCodeText,
    status,
    raw,
  };
}

export function normalizeStatus(rawStatus: string): OrderStatus {
  const s = rawStatus.toLowerCase();
  if (["paid", "approved", "completed", "confirmed"].includes(s)) return "paid";
  if (["refused", "canceled", "cancelled", "chargeback", "expired"].includes(s)) return "canceled";
  if (["refunded", "reversed"].includes(s)) return "refunded";
  // "waiting_payment" (valor real confirmado da InvictusPay) cai aqui, junto
  // com qualquer outro status ainda não pago.
  return "pending";
}
