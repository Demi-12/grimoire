import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createRateLimiter, IMPORT_LIMIT, INVITE_LIMIT, WRITE_LIMIT } from "./rate-limit.js";

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

function controllerFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? controllerFiles(path) : name.endsWith(".controller.ts") ? [path] : [];
  });
}

/** Each handler of a controller source: the decorators above it, its name and its body. */
function handlers(source: string): { decorators: string; name: string; body: string }[] {
  const found: { decorators: string; name: string; body: string }[] = [];
  let decorators: string[] = [];
  let open: { decorators: string; name: string; body: string } | undefined;
  for (const line of source.split("\n")) {
    if (open) {
      if (line === "  }") open = undefined;
      else open.body += `${line}\n`;
      continue;
    }
    if (line.startsWith("  @")) { decorators.push(line); continue; }
    const name = /^  (?:async )?(\w+)\(/.exec(line)?.[1];
    if (name && decorators.length) {
      found.push(open = { decorators: decorators.join("\n"), name, body: "" });
      decorators = [];
    }
  }
  return found;
}

describe("API controllers", () => {
  const sourceRoot = new URL("..", import.meta.url).pathname;

  it("rate-limit every POST/PUT/PATCH/DELETE handler", () => {
    const files = controllerFiles(sourceRoot);
    expect(files.length).toBeGreaterThan(10);
    const missing: string[] = [];
    for (const file of files) {
      for (const handler of handlers(readFileSync(file, "utf8"))) {
        if (!/@(Post|Put|Patch|Delete)\(/.test(handler.decorators)) continue;
        // Either the decorator, or (telemetry, which also serves callers without an account) the call it wraps.
        const limited = /@RateLimit\([A-Z_]+_LIMIT\)/.test(handler.decorators) || /consumeRateLimit\(.+, [A-Z_]+_LIMIT\)/.test(handler.body);
        if (!limited) missing.push(`${file.replace(sourceRoot, "")} ${handler.name}`);
      }
    }
    expect(missing).toEqual([]);
  });
});
