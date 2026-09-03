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
