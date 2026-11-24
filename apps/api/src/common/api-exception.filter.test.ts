import { HttpException, Logger, NotFoundException, type ArgumentsHost } from "@nestjs/common";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AppRequest } from "./current-user.js";

// Only the database edge is replaced: where server errors are stored and who a cookie belongs to.
vi.mock("../data/analytics-server.js", () => ({
  recordError: vi.fn(async () => {}),
  userIdFromHeaders: vi.fn(async () => null as string | null),
}));

const { ApiExceptionFilter } = await import("./api-exception.filter.js");
const { ApiError } = await import("./api-error.js");
const { recordError, userIdFromHeaders } = await import("../data/analytics-server.js");

/** What the filter did to the response: status, headers, JSON body and whether it was just closed. */
function exchange(options: { headersSent?: boolean; request?: Partial<AppRequest> & Record<string, unknown> } = {}) {
  const sent = { status: 0, headers: {} as Record<string, string>, body: undefined as unknown, ended: false };
  const response = {
    headersSent: options.headersSent ?? false,
    status(code: number) { sent.status = code; return response; },
    json(body: unknown) { sent.body = body; return response; },
    setHeader(name: string, value: string) { sent.headers[name] = value; },
    end() { sent.ended = true; },
  };
  const request = { method: "PATCH", originalUrl: "/api/campaigns/abc?x=1", path: "/api/campaigns/abc", headers: {}, ...options.request };
  const host = { switchToHttp: () => ({ getRequest: () => request, getResponse: () => response }) } as unknown as ArgumentsHost;
  return { sent, host };
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
const filter = new ApiExceptionFilter();
let logged: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.mocked(recordError).mockClear();
  vi.mocked(userIdFromHeaders).mockClear();
  logged = vi.spyOn(Logger.prototype, "error").mockImplementation(() => {});
});

afterEach(() => logged.mockRestore());

describe("ApiExceptionFilter: expected failures", () => {
  it("answers an ApiError with its status, body and headers, and stores nothing", async () => {
    const { sent, host } = exchange();
    filter.catch(new ApiError(429, "Too many requests.", "slow", { limit: 5 }, { "Retry-After": "30" }), host);
    await settle();
    expect(sent).toEqual({ status: 429, headers: { "Retry-After": "30" }, body: { error: "Too many requests.", code: "slow", limit: 5 }, ended: false });
    expect(recordError).not.toHaveBeenCalled();
    expect(logged).not.toHaveBeenCalled();
  });

  it("answers Nest's own exceptions in the same shape, with a fixed message for unknown routes", () => {
    const missing = exchange();
    filter.catch(new NotFoundException("Cannot GET /api/nothing"), missing.host);
    expect(missing.sent).toMatchObject({ status: 404, body: { error: "Not found." } });

    const other = exchange();
    filter.catch(new HttpException("Payload too large", 413), other.host);
    expect(other.sent).toMatchObject({ status: 413, body: { error: "Payload too large" } });
  });

  it("only closes a response that already started, such as the map's live stream", () => {
    const { sent, host } = exchange({ headersSent: true });
    filter.catch(new ApiError(403, "No."), host);
    expect(sent).toEqual({ status: 0, headers: {}, body: undefined, ended: true });
  });
});

describe("ApiExceptionFilter: bugs", () => {
  it("answers a bare 500, logs the request line, and stores the error under the route pattern", async () => {
    const { sent, host } = exchange({ request: { route: { path: "/api/campaigns/:id" }, grimoireUser: { id: "user-1" } as AppRequest["grimoireUser"], headers: { "user-agent": "Test agent" } } });
    const bug = new TypeError("boom");
    filter.catch(bug, host);
    await settle();
    expect(sent).toEqual({ status: 500, headers: {}, body: { error: "Internal server error." }, ended: false });
    expect(logged).toHaveBeenCalledWith("PATCH /api/campaigns/abc?x=1: boom", bug.stack);
    expect(recordError).toHaveBeenCalledWith("server", {
      name: "TypeError", message: "boom", stack: bug.stack, route: "/api/campaigns/:id", method: "PATCH", digest: null,
    }, { userId: "user-1", userAgent: "Test agent" });
    expect(userIdFromHeaders).not.toHaveBeenCalled();
  });

  it("falls back to the concrete path and to the session cookie's account when the route or the user is unknown", async () => {
    vi.mocked(userIdFromHeaders).mockResolvedValueOnce("user-2");
    const { host } = exchange();
    filter.catch(new Error("boom"), host);
    await settle();
    expect(recordError).toHaveBeenCalledWith("server", expect.objectContaining({ route: "/api/campaigns/abc" }), { userId: "user-2", userAgent: null });
  });

  it("turns a thrown non-error into an Error", async () => {
    const { sent, host } = exchange();
    filter.catch("plain text", host);
    await settle();
    expect(sent.status).toBe(500);
    expect(recordError).toHaveBeenCalledWith("server", expect.objectContaining({ name: "Error", message: "plain text" }), expect.anything());
  });

  it("only closes a stream that already started, but still stores the error", async () => {
    const { sent, host } = exchange({ headersSent: true });
    filter.catch(new Error("boom"), host);
    await settle();
    expect(sent).toMatchObject({ status: 0, ended: true });
    expect(recordError).toHaveBeenCalledTimes(1);
  });

  it("never throws when storing the error fails", async () => {
    vi.mocked(recordError).mockRejectedValueOnce(new Error("database down"));
    const { sent, host } = exchange();
    expect(() => filter.catch(new Error("boom"), host)).not.toThrow();
    await settle();
    expect(sent.status).toBe(500);
  });
});
