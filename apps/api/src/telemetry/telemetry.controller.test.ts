import type { AppUser } from "@grimoire/shared/permissions";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppRequest } from "../common/current-user.js";

// Only the database edge is replaced: who is signed in, and where events and errors are written.
// Parsing, the rate limiter and the status codes are the real ones.
const signedIn = vi.hoisted(() => ({ user: null as AppUser | null }));
vi.mock("../common/current-user.js", () => ({ getCurrentUser: vi.fn(async () => signedIn.user) }));
vi.mock("../data/analytics-server.js", () => ({ recordEvent: vi.fn(async () => {}), recordError: vi.fn(async () => {}) }));

const { TelemetryController } = await import("./telemetry.controller.js");
const { recordError, recordEvent } = await import("../data/analytics-server.js");

const controller = new TelemetryController();
const pageView = { kind: "event", name: "page.view", props: { section: "home" } };
const crash = { kind: "error", name: "TypeError", message: "x is undefined" };

// The limiter keeps its counters for the whole file: every test uses its own accounts and addresses.
let serial = 0;
const account = (status: AppUser["status"]): AppUser =>
  ({ id: `user-${++serial}`, name: "Test", email: "test@example.invalid", role: "user", status });
const address = () => `203.0.113.${++serial}`;

function request(headers: Record<string, string> = {}, socketAddress?: string): AppRequest {
  return { headers: { "content-type": "application/json", ...headers }, socket: { remoteAddress: socketAddress } } as unknown as AppRequest;
}

/** The status and body an ApiError leaves with, or "ok" when the call succeeded. */
async function outcome(call: Promise<void>): Promise<"ok" | { status: number; body: unknown }> {
  try {
    await call;
    return "ok";
  } catch (error) {
    const failure = error as { getStatus(): number; getResponse(): unknown };
    return { status: failure.getStatus(), body: failure.getResponse() };
  }
}

const tooMany = { status: 429, body: { error: "Too many requests. Please wait a moment and try again." } };

beforeEach(() => {
  signedIn.user = null;
  vi.mocked(recordEvent).mockClear();
  vi.mocked(recordError).mockClear();
});

describe("POST /api/telemetry", () => {
  it("answers 415 to anything not sent as JSON", async () => {
    expect(await outcome(controller.report(request({ "content-type": "text/plain" }), pageView)))
      .toEqual({ status: 415, body: { error: "Send JSON." } });
    expect(await outcome(controller.report(request({ "content-type": "" }), pageView))).toMatchObject({ status: 415 });
    expect(await outcome(controller.report(request({ "content-type": "Application/JSON; charset=utf-8" }), crash))).toBe("ok");
  });

  it("answers 400 to a body that is not a known event or error", async () => {
    expect(await outcome(controller.report(request(), { kind: "event", name: "character.created" })))
      .toEqual({ status: 400, body: { error: "Unknown telemetry." } });
    expect(await outcome(controller.report(request(), null))).toMatchObject({ status: 400 });
  });

  it("records usage events for approved accounts and drops everyone else's silently", async () => {
    const approved = account("approved");
    signedIn.user = approved;
    expect(await outcome(controller.report(request(), pageView))).toBe("ok");
    expect(recordEvent).toHaveBeenCalledWith(approved.id, "page.view", { section: "home" });

    for (const user of [account("pending"), account("blocked"), null]) {
      signedIn.user = user;
      expect(await outcome(controller.report(request(), pageView))).toBe("ok");
    }
    expect(recordEvent).toHaveBeenCalledTimes(1);
  });

  it("limits usage events to 120 a minute per account", async () => {
    signedIn.user = account("approved");
    for (let sent = 0; sent < 120; sent++) await controller.report(request(), pageView);
    expect(await outcome(controller.report(request(), pageView))).toEqual(tooMany);
    signedIn.user = account("approved");
    expect(await outcome(controller.report(request(), pageView))).toBe("ok");
  });

  it("records error reports from anyone, with the account and the browser when known", async () => {
    const pending = account("pending");
    signedIn.user = pending;
    await controller.report(request({ "user-agent": "Test agent" }), crash);
    expect(recordError).toHaveBeenLastCalledWith("client", expect.objectContaining({ kind: "error", message: "x is undefined" }), { userId: pending.id, userAgent: "Test agent" });

    signedIn.user = null;
    await controller.report(request(), crash);
    expect(recordError).toHaveBeenLastCalledWith("client", expect.anything(), { userId: null, userAgent: null });
  });

  it("limits error reports to 20 a minute per account, or per address before signing in", async () => {
    const visitor = address();
    for (let sent = 0; sent < 20; sent++) await controller.report(request({ "cf-connecting-ip": visitor }), crash);
    expect(await outcome(controller.report(request({ "cf-connecting-ip": visitor }), crash))).toEqual(tooMany);
    // The same visitor reached through another header still has no budget left; another address does.
    expect(await outcome(controller.report(request({ "x-forwarded-for": `${visitor}, 198.51.100.2` }), crash))).toEqual(tooMany);
    expect(await outcome(controller.report(request({}, visitor), crash))).toEqual(tooMany);
    expect(await outcome(controller.report(request({ "cf-connecting-ip": address() }), crash))).toBe("ok");
    // Signed in, the account has its own budget wherever it connects from.
    signedIn.user = account("pending");
    expect(await outcome(controller.report(request({ "cf-connecting-ip": visitor }), crash))).toBe("ok");
  });
});
