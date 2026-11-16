import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { THEME_INIT_SCRIPT } from "@grimoire/shared/theme-init";
import { buildContentSecurityPolicy, hstsHeader, staticSecurityHeaders, THEME_INIT_SCRIPT_HASH } from "./security-headers.js";

const directive = (csp: string, name: string) => csp.split("; ").find((part) => part.startsWith(`${name} `)) ?? "";

describe("Content-Security-Policy", () => {
  const csp = buildContentSecurityPolicy();

  it("allows the inline theme script by hash, so the saved theme still applies before first paint", () => {
    const expected = `'sha256-${createHash("sha256").update(THEME_INIT_SCRIPT).digest("base64")}'`;
    expect(THEME_INIT_SCRIPT_HASH).toBe(expected);
    expect(directive(csp, "script-src")).toContain(expected);
    // index.html must carry exactly THEME_INIT_SCRIPT (any other bytes would change the hash).
    const index = readFileSync(new URL("../../../web/src/index.html", import.meta.url), "utf8");
    expect(index).toContain(`<script>${THEME_INIT_SCRIPT}</script>`);
  });

  it("does not use unsafe-inline, unsafe-eval or nonces for scripts", () => {
    const scripts = directive(csp, "script-src");
    expect(scripts).toBe(`script-src 'self' ${THEME_INIT_SCRIPT_HASH}`);
  });

  it("blocks framing, plugins and base-tag injection, and keeps connections same-origin", () => {
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("form-action 'self'");
    expect(directive(csp, "connect-src")).toBe("connect-src 'self'");
  });

  it("needs no Google font hosts and does not force HTTPS upgrades on the LAN", () => {
    expect(csp).not.toContain("googleapis");
    expect(csp).not.toContain("upgrade-insecure-requests");
  });
});

describe("static security headers", () => {
  it("cover sniffing, referrers, permissions and framing", () => {
    const names = staticSecurityHeaders.map((header) => header.key);
    expect(names).toEqual(expect.arrayContaining(["X-Content-Type-Options", "Referrer-Policy", "Permissions-Policy", "X-Frame-Options"]));
  });
});

describe("hstsHeader", () => {
  it("is only sent when the public URL is HTTPS", () => {
    expect(hstsHeader("https://grimoire.example.com")).toBe("max-age=15552000");
    expect(hstsHeader("http://192.168.1.20:3000")).toBeNull();
    expect(hstsHeader(undefined)).toBeNull();
  });
});
