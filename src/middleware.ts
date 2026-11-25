import { NextResponse, type NextRequest } from "next/server";

// Área administrativa (/admin): acompanhamento técnico de robôs, fontes, cotas e erros.
// Protegida por senha (HTTP Basic) definida em ADMIN_PASSWORD. Sem senha configurada,
// só abre em desenvolvimento local; em produção responde 404.

export function middleware(req: NextRequest) {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) {
    return process.env.NODE_ENV === "development" ? NextResponse.next() : new NextResponse("Não encontrado", { status: 404 });
  }
  const header = req.headers.get("authorization") ?? "";
  const [scheme, encoded] = header.split(" ");
  if (scheme === "Basic" && encoded) {
    const [user, pass] = atob(encoded).split(":");
    if (user === (process.env.ADMIN_USER ?? "admin") && pass === password) return NextResponse.next();
  }
  return new NextResponse("Acesso restrito", { status: 401, headers: { "WWW-Authenticate": 'Basic realm="Travel Vision admin", charset="UTF-8"' } });
}

export const config = { matcher: ["/admin/:path*"] };
