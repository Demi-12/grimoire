import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createRateLimiter, IMPORT_LIMIT, INVITE_LIMIT, WRITE_LIMIT } from "./rate-limit";

describe("createRateLimiter", () => {
  const policy = { name: "t", max: 3, windowMs: 10_000 };

  it("allows up to max requests per window, then reports when to retry", () => {
    let now = 1_000;
    const limiter = createRateLimiter(() => now);
    for (let i = 0; i < 3; i++) expect(limiter.consume(policy, "u1")).toEqual({ ok: true });
    now += 2_500;
    expect(limiter.consume(policy, "u1")).toEqual({ ok: false, retryAfterSeconds: 8 });
  });

  it("opens a fresh window after it expires", () => {
    let now = 0;
    const limiter = createRateLimiter(() => now);
    for (let i = 0; i < 3; i++) limiter.consume(policy, "u1");
    expect(limiter.consume(policy, "u1").ok).toBe(false);
    now = 10_000;
    expect(limiter.consume(policy, "u1")).toEqual({ ok: true });
  });

  it("keeps users and policies independent", () => {
    const limiter = createRateLimiter(() => 0);
    for (let i = 0; i < 3; i++) limiter.consume(policy, "u1");
    expect(limiter.consume(policy, "u1").ok).toBe(false);
    expect(limiter.consume(policy, "u2").ok).toBe(true);
    expect(limiter.consume({ ...policy, name: "other" }, "u1").ok).toBe(true);
  });

  it("keeps the invite and import budgets tighter than ordinary writes", () => {
    expect(INVITE_LIMIT.max).toBeLessThan(WRITE_LIMIT.max);
    expect(IMPORT_LIMIT.max).toBeLessThan(INVITE_LIMIT.max);
  });
});

function routeFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? routeFiles(path) : name === "route.ts" ? [path] : [];
  });
}

describe("API routes", () => {
  const apiRoot = new URL("../app/api", import.meta.url).pathname;
  // better-auth rate-limits /api/auth itself; monsters are public read-only GETs.
  const skipped = ["/auth/", "/monsters/"];

  it("rate-limit every POST/PUT/PATCH/DELETE handler of the data routes", () => {
    const missing: string[] = [];
    for (const file of routeFiles(apiRoot)) {
      if (skipped.some((part) => file.includes(part))) continue;
      const source = readFileSync(file, "utf8");
      for (const part of source.split(/(?=export async function )/)) {
        const method = /^export async function (POST|PUT|PATCH|DELETE)\b/.exec(part)?.[1];
        if (method && !/rateLimit\(user, [A-Z_]+_LIMIT\)/.test(part)) missing.push(`${file.replace(apiRoot, "")} ${method}`);
      }
    }
    expect(missing).toEqual([]);
  });
});
