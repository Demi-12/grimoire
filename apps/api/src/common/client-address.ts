/**
 * Which request headers name the caller, for keys that need an address (the error-report rate limit of
 * /api/telemetry). Pure: reads only the headers it is given. Sign-in limits are keyed by better-auth instead,
 * from CF-Connecting-IP or X-Forwarded-For (see auth/auth.ts and auth/auth.middleware.ts).
 */
import type { IncomingHttpHeaders } from "node:http";

/** A header's value, or its first value when it was sent more than once. */
export function firstHeader(headers: IncomingHttpHeaders, name: string): string | undefined {
  const value = headers[name];
  return Array.isArray(value) ? value[0] : value;
}

/**
 * The caller's address as seen through the Cloudflare tunnel or a reverse proxy, or the socket's when the
 * server is reached directly; only used as a rate-limit key. A header that is present wins, even when empty.
 */
export function clientAddress(headers: IncomingHttpHeaders, socketAddress: string | undefined): string {
  return firstHeader(headers, "cf-connecting-ip")
    ?? firstHeader(headers, "x-forwarded-for")?.split(",")[0]?.trim()
    ?? firstHeader(headers, "x-real-ip")
    ?? socketAddress
    ?? "unknown";
}
