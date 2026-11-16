/**
 * Hands /api/auth/* to better-auth (sign-in, sign-up, sessions, 2FA, passkeys, password reset).
 * Registered in main.ts ahead of the Nest router: better-auth reads the raw request body itself.
 */
import type { NextFunction, Request, Response } from "express";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./auth.js";

const handler = toNodeHandler(auth);

export function authMiddleware(request: Request, response: Response, next: NextFunction): void {
  if (request.path !== "/api/auth" && !request.path.startsWith("/api/auth/")) { next(); return; }
  // better-auth keys its sign-in rate limits by client IP, read from CF-Connecting-IP or X-Forwarded-For
  // (see auth.ts). Reached directly (LAN, local development) neither header exists: use the socket address.
  if (!request.headers["cf-connecting-ip"] && !request.headers["x-forwarded-for"] && request.socket.remoteAddress) {
    request.headers["x-forwarded-for"] = request.socket.remoteAddress;
  }
  handler(request, response).catch(next);
}
