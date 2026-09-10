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

/** Um product_hash por categoria, conforme fornecido pela InvictusPay. */
export function getProductHash(category: "camiseta" | "bone"): string {
  const variavel =
    category === "camiseta" ? "INVICTUSPAY_PRODUCT_HASH_SHIRT" : "INVICTUSPAY_PRODUCT_HASH_CAP";
  const hash = process.env[variavel];
  if (!hash) throw new Error(`Variável de ambiente ausente: ${variavel}`);
  return hash;
}

/**
 * Cada produto cadastrado na InvictusPay tem a SUA oferta — camiseta e boné não
 * compartilham offer_hash. O histórico real de transações da conta confirma:
 * camiseta usa a oferta q5q7cv0hes (produto k2zdlfbrrp) e boné usa vr6ysqln9k
 * (produto pywa4t06zq). Mandar uma oferta que não corresponde ao produto do
 * carrinho faz a API responder 400 "Ocorreu um erro ao processar o pagamento".
 *
 * `INVICTUSPAY_OFFER_HASH` (sem sufixo) continua aceita como fallback para não
 * quebrar ambientes antigos, mas o certo é definir uma por categoria.
 */
export function getOfferHash(category: "camiseta" | "bone"): string {
  const variavel =
    category === "camiseta" ? "INVICTUSPAY_OFFER_HASH_SHIRT" : "INVICTUSPAY_OFFER_HASH_CAP";
  const hash = process.env[variavel] ?? process.env.INVICTUSPAY_OFFER_HASH;
  if (!hash) {
    throw new Error(
      `Variável de ambiente ausente: ${variavel} (nem o fallback INVICTUSPAY_OFFER_HASH está definido).`
    );
  }
  return hash;
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
  /** Categoria que define qual oferta usar na cobrança. Ver getOfferHash(). */
  offerCategory: "camiseta" | "bone";
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
  const offerHash = getOfferHash(input.offerCategory);

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
/**
 * Um payload EMV do PIX ("copia e cola") começa sempre pelo campo 00
 * (Payload Format Indicator) com valor "01" — ou seja, os caracteres "0002" —
 * e os QRs brasileiros carregam o GUI "br.gov.bcb.pix" no campo 26.
 */
function pareceCodigoPix(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const s = value.trim();
  return s.startsWith("0002") || /br\.gov\.bcb\.pix/i.test(s);
}

/** Data URL, ou base64 cru cujos primeiros bytes são a assinatura de PNG/JPEG/GIF. */
function pareceImagem(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const s = value.trim();
  return s.startsWith("data:image/") || /^(iVBORw0KGgo|\/9j\/|R0lGOD)/.test(s);
}

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

  // Candidatos por nome de campo. Repare que `qr_code` é ambíguo: o nome sugere
  // imagem, mas gateways brasileiros frequentemente colocam o payload EMV
  // ("copia e cola") nele.
  const candidatoImagem = (pick(
    ["pix", "qr_code_base64"],
    ["pix", "qr_code_image"],
    ["qr_code_base64"],
    ["qr_code_image"]
  ) ?? null) as string | null;

  const candidatoTexto = (pick(
    ["pix", "pix_qr_code"],
    ["pix", "qr_code_text"],
    ["pix", "emv"],
    ["pix", "copia_e_cola"],
    ["pix", "code"],
    ["pix_qr_code"],
    ["qr_code_text"]
  ) ?? null) as string | null;

  const candidatoAmbiguo = (pick(["pix", "qr_code"], ["qr_code"]) ?? null) as string | null;

  // Classificamos pelo CONTEÚDO, nunca pelo nome do campo. Se confiássemos no
  // nome, um payload EMV vindo em `pix.qr_code` seria gravado como imagem e a
  // tela renderizaria `data:image/png;base64,<texto EMV>` — um QR Code quebrado
  // — e ainda deixaria o campo "copia e cola" vazio. Na dúvida preferimos
  // tratar o valor como texto: a imagem a gente regenera a partir dele em
  // lib/pix-qrcode.ts, mas o texto não dá pra recuperar de uma imagem.
  const qrCodeImage = [candidatoImagem, candidatoAmbiguo].find(pareceImagem) ?? null;

  const qrCodeText =
    [candidatoTexto, candidatoAmbiguo, candidatoImagem].find(pareceCodigoPix) ??
    (typeof candidatoTexto === "string" && !pareceImagem(candidatoTexto) ? candidatoTexto : null);

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
