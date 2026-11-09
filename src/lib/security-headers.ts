import { createHash } from "node:crypto";
import { THEME_INIT_SCRIPT } from "./theme-init";

/** CSP source for the inline theme script in <head>: valid whatever nonce a request gets. */
export const THEME_INIT_SCRIPT_HASH = `'sha256-${createHash("sha256").update(THEME_INIT_SCRIPT).digest("base64")}'`;

/** Host that serves monster illustrations (Open5e, see open5e.ts). */
const MONSTER_IMAGE_HOST = "https://api.open5e.com";

/**
 * Content-Security-Policy for a page response.
 * - Scripts: only same-origin files, Next's own inline bootstrap scripts (via the per-request nonce)
 *   and the theme script (via its hash). No 'unsafe-inline'. 'unsafe-eval' only in `next dev`.
 * - Styles keep 'unsafe-inline' because the UI uses style="" attributes, which a nonce cannot cover.
 * - No upgrade-insecure-requests: the app is also reached over plain HTTP on the LAN.
 * - Google sign-in and passkeys need nothing extra: the client fetches same-origin, then navigates
 *   to Google, and WebAuthn is not governed by CSP.
 */
export function buildContentSecurityPolicy(nonce: string, { dev = false }: { dev?: boolean } = {}): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' ${THEME_INIT_SCRIPT_HASH}${dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: ${MONSTER_IMAGE_HOST}`,
    "font-src 'self'",
    `connect-src 'self'${dev ? " ws: wss:" : ""}`,
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}

/** Static headers for every response (applied from next.config.ts). */
export const staticSecurityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()" },
  // Legacy twin of CSP frame-ancestors for old browsers.
  { key: "X-Frame-Options", value: "DENY" },
];

/**
 * HSTS only when the configured public URL is HTTPS. It is read at request time (not at build, since the
 * Docker image is built without .env). Browsers ignore it on plain-HTTP LAN access, but a wrong HSTS on an
 * HTTPS host is sticky for months, so no includeSubDomains and no preload.
 */
export function hstsHeader(baseUrl: string | undefined): string | null {
  return baseUrl?.trim().toLowerCase().startsWith("https://") ? "max-age=15552000" : null;
}
