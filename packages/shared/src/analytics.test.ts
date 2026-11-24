import { describe, expect, it } from "vitest";
import {
  errorGroupKey, errorReportLimitKey, isForeignScriptError, keepsUsageEvents, normalizeRoute, parseRange, parseTelemetry, parseTimeZone, percentChange, sanitizeError, sanitizeText, shapeAnalyticsReport, summarizeUserAgent,
  type AnalyticsRows,
} from "./analytics.js";

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

describe("who a telemetry report counts against", () => {
  const account = (status: "pending" | "approved" | "blocked") => ({ id: "user-1", status });

  it("keeps usage events only from approved accounts", () => {
    expect(keepsUsageEvents(account("approved"))).toBe(true);
    expect(keepsUsageEvents(account("pending"))).toBe(false);
    expect(keepsUsageEvents(account("blocked"))).toBe(false);
    expect(keepsUsageEvents(null)).toBe(false);
  });

  it("limits error reports per account, whatever its status, or per address before signing in", () => {
    expect(errorReportLimitKey(account("pending"), "203.0.113.7")).toBe("user-1");
    expect(errorReportLimitKey(account("blocked"), "203.0.113.7")).toBe("user-1");
    expect(errorReportLimitKey(null, "203.0.113.7")).toBe("ip:203.0.113.7");
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
  it("tells apart the other browsers and systems people use", () => {
    expect(summarizeUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 OPR/115.0.0.0")).toBe("Opera 115 · macOS");
    expect(summarizeUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/131.0.6778.73 Mobile/15E148 Safari/604.1")).toBe("Chrome 131 · iOS");
    expect(summarizeUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 14_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15")).toBe("Safari 18 · macOS");
    expect(summarizeUserAgent("Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36")).toBe("Chrome 131 · ChromeOS");
    expect(summarizeUserAgent("Mozilla/5.0 (X11; Linux x86_64; rv:133.0) Gecko/20100101 Firefox/133.0")).toBe("Firefox 133 · Linux");
    expect(summarizeUserAgent("node")).toBe("Node");
    expect(summarizeUserAgent("undici")).toBe("Node");
    expect(summarizeUserAgent("curl/8.5.0")).toBe("Other");
    expect(summarizeUserAgent("")).toBeNull();
  });
});

describe("isForeignScriptError", () => {
  it("ignores scripts a browser injects into the page, like Brave's wallet on iOS", () => {
    expect(isForeignScriptError({
      filename: "https://grimoire.demigv.dev/admin",
      stack: "global code@https://grimoire.demigv.dev/admin:2:34",
    })).toBe(true);
    expect(isForeignScriptError({ stack: "global code@https://prometeo.example.ts.net/characters:1:1" })).toBe(true);
  });

  it("ignores errors thrown inside extensions, including Safari's masked extension URLs", () => {
    expect(isForeignScriptError({ filename: "chrome-extension://abc/content.js" })).toBe(true);
    expect(isForeignScriptError({
      stack: "f@webkit-masked-url://hidden/:1:2\nonClick@https://grimoire.demigv.dev/main-K3J5QW2A.js:1:2",
    })).toBe(true);
  });

  it("keeps the app's own errors even when an extension sits lower in the stack", () => {
    expect(isForeignScriptError({
      stack: "onClick@https://grimoire.demigv.dev/main-K3J5QW2A.js:1:2\nwrapped@chrome-extension://abc/hook.js:3:4",
    })).toBe(false);
  });

  it("keeps errors from the app's own chunks", () => {
    expect(isForeignScriptError({
      filename: "https://grimoire.demigv.dev/chunk-7XQ2LM4B.js",
      stack: "TypeError: x is undefined\n    at render (https://grimoire.demigv.dev/chunk-7XQ2LM4B.js:4:56)",
    })).toBe(false);
    // `ng serve` names its bundles without a hash.
    expect(isForeignScriptError({ stack: "save@http://localhost:3000/main.js:10:2" })).toBe(false);
  });

  it("does not mistake other scripts at the root for the app's bundles", () => {
    expect(isForeignScriptError({ stack: "x@https://grimoire.demigv.dev/main-extension.js:1:1" })).toBe(true);
    expect(isForeignScriptError({ stack: "x@https://grimoire.demigv.dev/assets/chunk-7XQ2LM4B.js:1:1" })).toBe(true);
  });

  it("keeps errors with no location, since they can't be ruled out", () => {
    expect(isForeignScriptError({})).toBe(false);
    expect(isForeignScriptError({ stack: "Error: boom" })).toBe(false);
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

describe("shapeAnalyticsReport", () => {
  const range = { days: 7 as const, timeZone: "Europe/Madrid", from: "2026-11-17", to: "2026-11-23" };
  const now = new Date("2026-11-23T10:00:00.000Z");
  const errorRow = (index: number) => ({
    fingerprint: `fp-${index}`, source: "client" as const, name: "TypeError", message: `boom ${index}`, route: "/characters/:id",
    count: "3", users: "2", firstSeen: new Date(Date.UTC(2026, 10, 1, 0, index)), lastSeen: new Date(Date.UTC(2026, 10, 20, 0, index)),
    stack: null, digest: null, userAgent: "Firefox 140 · Linux", method: null,
  });
  // As the SQL queries return them: PostgreSQL counts (bigint) arrive as strings.
  const rows: AnalyticsRows = {
    events: [
      { name: "character.created", current: "5", previous: "2", creator: "3", manual: "2" },
      { name: "character.wizard_started", current: "8", previous: "1", creator: "0", manual: "0" },
      { name: "encounter.saved", current: "4", previous: "6", creator: "0", manual: "0" },
    ],
    active: { current: "12", previous: "9", today: "4" },
    users: { approved: "20", current: "3", previous: "1" },
    errorTotals: { current: "7", previous: "2", users: "3", server: "5", client: "2" },
    daily: [{ date: "2026-11-23", activeUsers: "4", characters: "1", encounters: "0", campaigns: "2", errors: "1" }],
    sections: [{ section: "characters", views: "30", users: "6" }, { section: "retired-page", views: "9", users: "1" }, { section: "map", views: "2", users: "2" }],
    errors: [errorRow(1)],
  };

  it("turns the query rows into the dashboard figures", () => {
    const report = shapeAnalyticsReport(range, rows, now);
    expect(report.range).toEqual({ ...range, generatedAt: "2026-11-23T10:00:00.000Z" });
    expect(report.kpis).toEqual({
      activeUsers: { current: 12, previous: 9 },
      activeToday: 4,
      approvedUsers: 20,
      newUsers: { current: 3, previous: 1 },
      charactersCreated: { current: 5, previous: 2, creator: 3, manual: 2 },
      encountersGenerated: { current: 0, previous: 0 },
      encountersSaved: { current: 4, previous: 6 },
      campaignsCreated: { current: 0, previous: 0 },
      campaignsJoined: { current: 0, previous: 0 },
      errors: { current: 7, previous: 2, users: 3, server: 5, client: 2 },
      wizard: { started: 8, completed: 3 },
    });
    expect(report.daily).toEqual([{ date: "2026-11-23", activeUsers: 4, characters: 1, encounters: 0, campaigns: 2, errors: 1 }]);
    expect(report.errors).toEqual([{
      fingerprint: "fp-1", source: "client", name: "TypeError", message: "boom 1", route: "/characters/:id", count: 3, users: 2,
      firstSeen: "2026-11-01T00:01:00.000Z", lastSeen: "2026-11-20T00:01:00.000Z", stack: null, digest: null, userAgent: "Firefox 140 · Linux", method: null,
    }]);
  });

  it("counts zero when nothing happened or a query returned no row", () => {
    const report = shapeAnalyticsReport(range, { ...rows, events: [], active: undefined, users: undefined, errorTotals: undefined }, now);
    expect(report.kpis.activeUsers).toEqual({ current: 0, previous: 0 });
    expect(report.kpis.activeToday).toBe(0);
    expect(report.kpis.approvedUsers).toBe(0);
    expect(report.kpis.newUsers).toEqual({ current: 0, previous: 0 });
    expect(report.kpis.charactersCreated).toEqual({ current: 0, previous: 0, creator: 0, manual: 0 });
    expect(report.kpis.errors).toEqual({ current: 0, previous: 0, users: 0, server: 0, client: 0 });
    expect(report.kpis.wizard).toEqual({ started: 0, completed: 0 });
  });

  it("keeps the order of the section views and leaves out sections the app no longer has", () => {
    expect(shapeAnalyticsReport(range, rows, now).sections).toEqual([
      { section: "characters", views: 30, users: 6 }, { section: "map", views: 2, users: 2 },
    ]);
  });

  it("lists the 50 error groups seen most recently, newest first", () => {
    const errors = Array.from({ length: 60 }, (_, index) => errorRow(index));
    const listed = shapeAnalyticsReport(range, { ...rows, errors }, now).errors;
    expect(listed).toHaveLength(50);
    expect(listed[0].fingerprint).toBe("fp-59");
    expect(listed[49].fingerprint).toBe("fp-10");
  });
});
