declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}

/**
 * Dispara um evento padrão do Pixel do Meta no navegador (fbq). Não faz nada
 * no servidor nem se o pixel não tiver sido carregado (ex: ad blocker) —
 * seguro de chamar de qualquer client component.
 *
 * `eventId` permite deduplicar com o mesmo evento enviado pela Conversions
 * API (server-side) — use o mesmo id nos dois lados.
 */
export function trackMetaEvent(name: string, data?: Record<string, unknown>, eventId?: string): void {
  if (typeof window === "undefined" || !window.fbq) return;
  if (eventId) {
    window.fbq("track", name, data, { eventID: eventId });
  } else {
    window.fbq("track", name, data);
  }
}
