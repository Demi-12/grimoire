import { NextResponse, type NextRequest } from "next/server";
import { buildContentSecurityPolicy, hstsHeader } from "@/lib/security-headers";

/** Per-request CSP nonce: Next reads it from the request CSP and stamps its inline scripts. */
export function proxy(request: NextRequest) {
  const nonce = btoa(crypto.randomUUID());
  const csp = buildContentSecurityPolicy(nonce, { dev: process.env.NODE_ENV !== "production" });
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("content-security-policy", csp);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  const hsts = hstsHeader(process.env.BETTER_AUTH_URL);
  if (hsts) response.headers.set("Strict-Transport-Security", hsts);
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
