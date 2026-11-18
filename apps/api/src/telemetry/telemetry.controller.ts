/**
 * /api/telemetry: usage events and error reports from the browser. No guard on purpose: errors are accepted
 * from anyone (the sign-in page can fail too), so the account, if any, is looked up here and the rate limit
 * is counted by hand, per account or per address. What is recorded goes through data/analytics-server.ts.
 */
import { Controller, HttpCode, Post, Req } from "@nestjs/common";
import { parseTelemetry } from "@grimoire/shared/analytics";
import { ApiError } from "../common/api-error.js";
import { getCurrentUser, type AppRequest } from "../common/current-user.js";
import { JsonBody } from "../common/params.js";
import { consumeRateLimit } from "../common/rate-limit.guard.js";
import { ERROR_REPORT_LIMIT, TELEMETRY_LIMIT } from "../common/rate-limit.js";
import { recordError, recordEvent } from "../data/analytics-server.js";

const MAX_TELEMETRY_BYTES = 16_000;

const header = (request: AppRequest, name: string): string | undefined => {
  const value = request.headers[name];
  return Array.isArray(value) ? value[0] : value;
};

/**
 * The caller's address as seen through the Cloudflare tunnel or a reverse proxy, or the socket's when the
 * server is reached directly; only used as a rate-limit key.
 */
function clientAddress(request: AppRequest): string {
  return header(request, "cf-connecting-ip")
    ?? header(request, "x-forwarded-for")?.split(",")[0]?.trim()
    ?? header(request, "x-real-ip")
    ?? request.socket.remoteAddress
    ?? "unknown";
}

@Controller("telemetry")
export class TelemetryController {
  /**
   * Events count only for approved accounts; errors are limited per account or per address.
   * Requiring a JSON content type makes cross-site posts need a CORS preflight, which this route never grants.
   */
  @Post()
  @HttpCode(204)
  async report(@Req() request: AppRequest, @JsonBody(MAX_TELEMETRY_BYTES) body: unknown): Promise<void> {
    if (!header(request, "content-type")?.toLowerCase().startsWith("application/json")) throw new ApiError(415, "Send JSON.");
    const user = await getCurrentUser(request);
    const input = parseTelemetry(body);
    if (!input) throw new ApiError(400, "Unknown telemetry.");

    if (input.kind === "event") {
      if (!user || user.status !== "approved") return;
      consumeRateLimit(user.id, TELEMETRY_LIMIT);
      await recordEvent(user.id, input.name, input.props);
      return;
    }

    consumeRateLimit(user ? user.id : `ip:${clientAddress(request)}`, ERROR_REPORT_LIMIT);
    await recordError("client", input, { userId: user?.id ?? null, userAgent: header(request, "user-agent") ?? null });
  }
}
