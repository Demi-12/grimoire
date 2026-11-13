import { NextResponse } from "next/server";
import { getCurrentUser, jsonError, rateLimit, readJson } from "@/lib/access";
import { parseTelemetry } from "@/lib/analytics";
import { recordError, recordEvent } from "@/lib/analytics-server";
import { ERROR_REPORT_LIMIT, TELEMETRY_LIMIT } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const MAX_TELEMETRY_BYTES = 16_000;

/** The caller's address as seen through the Cloudflare tunnel or a reverse proxy; only used as a rate-limit key. */
function clientAddress(request: Request): string {
  return request.headers.get("cf-connecting-ip")
    ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? request.headers.get("x-real-ip")
    ?? "unknown";
}

/**
 * Usage events and error reports from the browser. Events count only for approved accounts; errors are
 * accepted from anyone (the sign-in page can fail too), limited per account or per address.
 * Requiring a JSON content type makes cross-site posts need a CORS preflight, which this route never grants.
 */
export async function POST(request: Request) {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) return jsonError(415, "Send JSON.");
  const user = await getCurrentUser();
  const input = parseTelemetry(await readJson(request, MAX_TELEMETRY_BYTES));
  if (!input) return jsonError(400, "Unknown telemetry.");

  if (input.kind === "event") {
    if (!user || user.status !== "approved") return new NextResponse(null, { status: 204 });
    const limited = rateLimit(user, TELEMETRY_LIMIT);
    if (limited) return limited;
    await recordEvent(user.id, input.name, input.props);
    return new NextResponse(null, { status: 204 });
  }

  const limited = rateLimit({ id: user ? user.id : `ip:${clientAddress(request)}` }, ERROR_REPORT_LIMIT);
  if (limited) return limited;
  await recordError("client", input, { userId: user?.id ?? null, userAgent: request.headers.get("user-agent") });
  return new NextResponse(null, { status: 204 });
}
