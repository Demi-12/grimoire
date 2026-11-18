/**
 * Security headers for every response. The policy is built here (pure, unit-tested); main.ts applies it.
 */
import { createHash } from "node:crypto";
import { THEME_INIT_SCRIPT } from "@grimoire/shared/theme-init";

/** CSP source for the inline theme script in the web app's index.html. */
export const THEME_INIT_SCRIPT_HASH = `'sha256-${createHash("sha256").update(THEME_INIT_SCRIPT).digest("base64")}'`;

/** Host that serves monster illustrations (Open5e, see open5e.ts). */
const MONSTER_IMAGE_HOST = "https://api.open5e.com";

/**
 * Content-Security-Policy for every response.
 * - Scripts: only same-origin files (the Angular bundles) and the theme script (via its hash).
 *   No 'unsafe-inline', no 'unsafe-eval'. The web build keeps critical-CSS inlining off because it
 *   relies on inline `onload` handlers, which this policy blocks.
 * - Styles keep 'unsafe-inline': Angular adds component styles as <style> elements and the UI uses style bindings.
 * - No upgrade-insecure-requests: the app is also reached over plain HTTP on the LAN.
 * - Passkeys need nothing extra: WebAuthn is not governed by CSP.
 */
export function buildContentSecurityPolicy(): string {
  return [
    "default-src 'self'",
    `script-src 'self' ${THEME_INIT_SCRIPT_HASH}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: ${MONSTER_IMAGE_HOST}`,
    "font-src 'self'",
    "connect-src 'self'",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}

/** Static headers for every response. */
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
