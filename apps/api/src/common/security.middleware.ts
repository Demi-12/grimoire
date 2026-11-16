/** Applies the security headers of security-headers.ts to every response, and keeps API answers out of caches. */
import type { NextFunction, Request, Response } from "express";
import { buildContentSecurityPolicy, hstsHeader, staticSecurityHeaders } from "./security-headers.js";

const csp = buildContentSecurityPolicy();

export function securityMiddleware(request: Request, response: Response, next: NextFunction): void {
  for (const { key, value } of staticSecurityHeaders) response.setHeader(key, value);
  response.setHeader("Content-Security-Policy", csp);
  const hsts = hstsHeader(process.env.BETTER_AUTH_URL);
  if (hsts) response.setHeader("Strict-Transport-Security", hsts);
  // Account data: never stored by the browser or a proxy unless a handler says otherwise (monster catalog, map background).
  if (request.path.startsWith("/api/")) response.setHeader("Cache-Control", "no-store");
  next();
}
