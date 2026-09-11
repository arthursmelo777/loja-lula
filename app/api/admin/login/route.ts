import { NextRequest, NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE, checkAdminPassword, createAdminSessionToken } from "@/lib/admin-auth";

export async function POST(request: NextRequest) {
  let body: { password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  if (!body.password || !checkAdminPassword(body.password)) {
    return NextResponse.json({ error: "Senha incorreta." }, { status: 401 });
  }

  // A senha está correta a partir daqui. Se a sessão não puder ser criada, o
  // problema é de CONFIGURAÇÃO do servidor, não do que a pessoa digitou —
  // e dizer "não foi possível entrar" mandaria ela trocar a senha à toa, que
  // foi exatamente o que aconteceu. A mensagem só é visível para quem já
  // acertou a senha, então não entrega nada a quem não deveria saber.
  let token: string;
  try {
    token = await createAdminSessionToken();
  } catch (err) {
    console.error("[admin] Senha correta, mas falhou ao criar a sessão:", err);
    return NextResponse.json(
      {
        error:
          "Senha correta, mas o servidor não conseguiu criar a sessão. " +
          "Falta definir ADMIN_SESSION_SECRET nas variáveis de ambiente.",
      },
      { status: 503 }
    );
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(ADMIN_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(ADMIN_SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  return response;
}
