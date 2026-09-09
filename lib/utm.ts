import type { UtmData } from "@/types";

export const UTM_COOKIE_NAME = "lula_utm";
export const UTM_PARAMS = ["src", "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"] as const;

export const EMPTY_UTM: UtmData = {
  src: "",
  utm_source: "",
  utm_medium: "",
  utm_campaign: "",
  utm_term: "",
  utm_content: "",
};

export function readUtmFromSearchParams(params: URLSearchParams): UtmData | null {
  const found: Partial<UtmData> = {};
  let any = false;
  for (const key of UTM_PARAMS) {
    const value = params.get(key);
    if (value) {
      found[key] = value;
      any = true;
    }
  }
  return any ? { ...EMPTY_UTM, ...found } : null;
}

export function parseUtmCookie(raw: string | undefined | null): UtmData {
  if (!raw) return EMPTY_UTM;
  try {
    const parsed = JSON.parse(decodeURIComponent(raw));
    return { ...EMPTY_UTM, ...parsed };
  } catch {
    return EMPTY_UTM;
  }
}

const SESSION_STORAGE_KEY = "lula_utm_v1";

/** Lê os parâmetros utm/src da URL atual e persiste na sessão do navegador. Chame no cliente. */
export function captureUtmFromLocation(): void {
  if (typeof window === "undefined") return;
  const found = readUtmFromSearchParams(new URLSearchParams(window.location.search));
  if (found) {
    try {
      window.sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(found));
    } catch {
      // sessionStorage indisponível — segue sem tracking
    }
  }
}

const FBC_STORAGE_KEY = "lula_fbc_v1";

/**
 * O `fbclid` que a Meta cola na URL do anúncio é o que liga a venda ao clique.
 * Normalmente o pixel do navegador transforma esse parâmetro no cookie `_fbc`
 * sozinho, mas se o pixel for bloqueado o cookie nunca existe — justamente o
 * caso em que dependemos da Conversions API. Então guardamos aqui uma reserva
 * já no formato que a API espera: `fb.<subdomínio>.<timestamp>.<fbclid>`.
 */
export function captureFbclidFromLocation(): void {
  if (typeof window === "undefined") return;
  const fbclid = new URLSearchParams(window.location.search).get("fbclid");
  if (!fbclid) return;
  try {
    window.sessionStorage.setItem(FBC_STORAGE_KEY, `fb.1.${Date.now()}.${fbclid}`);
  } catch {
    // sessionStorage indisponível — segue sem tracking
  }
}

/** Lê a reserva do `_fbc` capturada nesta sessão do navegador. */
export function getStoredFbc(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage.getItem(FBC_STORAGE_KEY);
  } catch {
    return null;
  }
}

/** Lê os dados de UTM capturados nesta sessão do navegador. */
export function getStoredUtm(): UtmData {
  if (typeof window === "undefined") return EMPTY_UTM;
  try {
    const raw = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return EMPTY_UTM;
    return { ...EMPTY_UTM, ...JSON.parse(raw) };
  } catch {
    return EMPTY_UTM;
  }
}
