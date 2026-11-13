import { describe, expect, it } from "vitest";
import {
  errorGroupKey, normalizeRoute, parseRange, parseTelemetry, parseTimeZone, percentChange, sanitizeError, sanitizeText, summarizeUserAgent,
} from "./analytics";

describe("parseTelemetry", () => {
  it("accepts known browser events and keeps only their allowed properties", () => {
    expect(parseTelemetry({ kind: "event", name: "encounter.generated", props: { difficulty: "high", source: "srd", party: 4.4, results: 3, notes: "secret" } }))
      .toEqual({ kind: "event", name: "encounter.generated", props: { difficulty: "high", source: "srd", party: 4, results: 3 } });
    expect(parseTelemetry({ kind: "event", name: "character.wizard_started", props: { quick: true } }))
      .toEqual({ kind: "event", name: "character.wizard_started", props: { quick: true } });
  });

  it("rejects server-only and unknown events, and free text in properties", () => {
    expect(parseTelemetry({ kind: "event", name: "character.created" })).toBeNull();
    expect(parseTelemetry({ kind: "event", name: "made.up" })).toBeNull();
    expect(parseTelemetry({ kind: "event", name: "encounter.generated", props: { difficulty: "Bob's <b>party</b>" } }))
      .toEqual({ kind: "event", name: "encounter.generated", props: {} });
  });

  it("only counts page views for known sections", () => {
    expect(parseTelemetry({ kind: "event", name: "page.view", props: { section: "campaigns" } })).not.toBeNull();
    expect(parseTelemetry({ kind: "event", name: "page.view", props: { section: "secret-page" } })).toBeNull();
    expect(parseTelemetry({ kind: "event", name: "page.view" })).toBeNull();
  });

  it("parses error reports and trims oversized fields", () => {
    const parsed = parseTelemetry({ kind: "error", name: "TypeError", message: "x is undefined", stack: "s".repeat(9000), route: "/characters", digest: "123" });
    expect(parsed).toMatchObject({ kind: "error", name: "TypeError", message: "x is undefined", route: "/characters", digest: "123", method: null });
    expect(parsed && "stack" in parsed && parsed.stack?.length).toBe(8000);
    expect(parseTelemetry({ kind: "error", message: "  " })).toBeNull();
    expect(parseTelemetry(null)).toBeNull();
    expect(parseTelemetry([])).toBeNull();
  });
});

describe("normalizeRoute", () => {
  it("replaces ids and tokens and drops the query and hash", () => {
    expect(normalizeRoute("/characters/3f2a9c1e-1b2c-4d5e-8f90-123456789abc")).toBe("/characters/:id");
    expect(normalizeRoute("/api/campaigns/9b1d/map/saves/77")).toBe("/api/campaigns/:id/map/saves/:id");
    expect(normalizeRoute("/?invite=abcdefghijklmnopqrstuvwxyz#x")).toBe("/");
    expect(normalizeRoute("/api/invites/AbCdEfGhIjKlMnOpQrStUvWx")).toBe("/api/invites/:id");
    expect(normalizeRoute("https://grimoire.example/map/123?x=1")).toBe("/map/:id");
  });

  it("keeps route patterns and plain words", () => {
    expect(normalizeRoute("/api/campaigns/[id]/map")).toBe("/api/campaigns/[id]/map");
    expect(normalizeRoute("/admin/analytics")).toBe("/admin/analytics");
  });

  it("rejects anything that is not a path", () => {
    expect(normalizeRoute("")).toBeNull();
    expect(normalizeRoute("javascript:alert(1)")).toBeNull();
    expect(normalizeRoute(null)).toBeNull();
  });
});

describe("sanitizing errors", () => {
  it("masks e-mails, uuids and long tokens", () => {
    expect(sanitizeText("Key (email)=(ada@example.com) exists for 3f2a9c1e-1b2c-4d5e-8f90-123456789abc", 500))
      .toBe("Key (email)=([email]) exists for [id]");
    expect(sanitizeText(`token ${"a".repeat(40)} used`, 500)).toBe("token [token] used");
  });

  it("caps every field to the table's limits", () => {
    const clean = sanitizeError({ name: "E ".repeat(300), message: "m ".repeat(900), stack: "at x\n".repeat(2000), route: "/characters/42?x=y", method: "post", digest: null });
    expect(clean.name).toHaveLength(100);
    expect(clean.message).toHaveLength(500);
    expect(clean.stack).toHaveLength(4000);
    expect(clean.route).toBe("/characters/:id");
    expect(clean.method).toBe("POST");
  });

  it("groups errors that differ only by numbers", () => {
    const a = errorGroupKey("client", { name: "TypeError", message: "Cannot read index 3", route: "/characters" });
    const b = errorGroupKey("client", { name: "TypeError", message: "Cannot read index 17", route: "/characters" });
    expect(a).toBe(b);
    expect(errorGroupKey("server", { name: "TypeError", message: "Cannot read index 3", route: "/characters" })).not.toBe(a);
  });
});

describe("summarizeUserAgent", () => {
  it("keeps only the browser, its major version and the OS", () => {
    expect(summarizeUserAgent("Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36")).toBe("Chrome 131 · Android");
    expect(summarizeUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1")).toBe("Safari 18 · iOS");
    expect(summarizeUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0")).toBe("Firefox 133 · Windows");
    expect(summarizeUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0")).toBe("Edge 131 · Windows");
    expect(summarizeUserAgent(null)).toBeNull();
  });
});

describe("dashboard parameters", () => {
  it("falls back to 30 days and UTC on bad input", () => {
    expect(parseRange("7")).toBe(7);
    expect(parseRange("365")).toBe(30);
    expect(parseRange(null)).toBe(30);
    expect(parseTimeZone("Europe/Madrid")).toBe("Europe/Madrid");
    expect(parseTimeZone("Mars/Olympus'; DROP TABLE x")).toBe("UTC");
    expect(parseTimeZone(null)).toBe("UTC");
  });

  it("computes the change between periods", () => {
    expect(percentChange({ current: 15, previous: 10 })).toBe(50);
    expect(percentChange({ current: 5, previous: 10 })).toBe(-50);
    expect(percentChange({ current: 3, previous: 0 })).toBeNull();
  });
});
