// Usa a Web Crypto API (disponível tanto no runtime Edge do middleware quanto
// no runtime Node das rotas de API) para não depender do módulo "crypto" do Node.

export const ADMIN_SESSION_COOKIE = "lula_admin_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 12; // 12 horas

function getSecret(): string {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) {
    throw new Error(
      "ADMIN_SESSION_SECRET não configurada. Defina uma string aleatória longa no .env."
    );
  }
  return secret;
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function importKey(secret: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
}

async function sign(payload: string): Promise<string> {
  const key = await importKey(getSecret());
  const encoder = new TextEncoder();
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return toHex(signature);
}

function timingSafeEqualStr(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

export async function createAdminSessionToken(): Promise<string> {
  const expires = Date.now() + SESSION_TTL_MS;
  const payload = `admin:${expires}`;
  const signature = await sign(payload);
  return `${payload}:${signature}`;
}

export async function verifyAdminSessionToken(token: string | undefined | null): Promise<boolean> {
  if (!token) return false;
  const parts = token.split(":");
  if (parts.length !== 3) return false;
  const [label, expiresStr, signature] = parts;
  if (label !== "admin") return false;

  const expires = Number(expiresStr);
  if (!Number.isFinite(expires) || Date.now() > expires) return false;

  const expectedSignature = await sign(`${label}:${expiresStr}`);
  return timingSafeEqualStr(signature, expectedSignature);
}

export function checkAdminPassword(password: string): boolean {
  // O .trim() não é capricho: o campo de valor no painel da Vercel é uma caixa
  // de várias linhas, e colar ali costuma levar junto um "\n" invisível. Com a
  // comparação exata, "senha" e "senha\n" têm tamanhos diferentes e o login é
  // recusado — com a MESMA mensagem de senha errada, o que faz a pessoa passar
  // horas achando que digitou errado. Espaço em volta de senha nunca é
  // intencional, então normalizamos os dois lados.
  const configured = process.env.ADMIN_PASSWORD?.trim();

  if (!configured) {
    // Sem a variável, nenhum login é possível — e o erro genérico esconderia
    // isso atrás de "senha incorreta". Precisa aparecer no log.
    console.error(
      "[admin] ADMIN_PASSWORD não está definida no ambiente. Nenhum login será aceito."
    );
    return false;
  }

  return timingSafeEqualStr(password.trim(), configured);
}
