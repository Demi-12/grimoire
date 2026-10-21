import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import nextConfig from "../../next.config";
import { THEME_INIT_SCRIPT } from "./theme-init";
import { buildContentSecurityPolicy, hstsHeader, staticSecurityHeaders, THEME_INIT_SCRIPT_HASH } from "./security-headers";

const directive = (csp: string, name: string) => csp.split("; ").find((part) => part.startsWith(`${name} `)) ?? "";

describe("Content-Security-Policy", () => {
  const csp = buildContentSecurityPolicy("abc123");

  it("allows the inline theme script by hash, so the saved theme still applies before first paint", () => {
    const expected = `'sha256-${createHash("sha256").update(THEME_INIT_SCRIPT).digest("base64")}'`;
    expect(THEME_INIT_SCRIPT_HASH).toBe(expected);
    expect(directive(csp, "script-src")).toContain(expected);
    // The layout must inject exactly THEME_INIT_SCRIPT (any other bytes would change the hash).
    expect(readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8")).toContain("__html: THEME_INIT_SCRIPT }");
  });

  it("does not use unsafe-inline or unsafe-eval for scripts in production", () => {
    const scripts = directive(csp, "script-src");
    expect(scripts).toContain("'nonce-abc123'");
    expect(scripts).not.toContain("unsafe-inline");
    expect(scripts).not.toContain("unsafe-eval");
    expect(directive(buildContentSecurityPolicy("n", { dev: true }), "script-src")).toContain("'unsafe-eval'");
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
  it("are applied to every route from next.config.ts", async () => {
    const rules = await nextConfig.headers!();
    expect(rules).toEqual([{ source: "/:path*", headers: staticSecurityHeaders }]);
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
