import { NextResponse } from "next/server";
import { requireUser } from "@/lib/access";
import { parseRange, parseTimeZone } from "@/lib/analytics";
import { buildAnalyticsReport } from "@/lib/analytics-server";

export const dynamic = "force-dynamic";

/** Usage and error figures for the admin dashboard: `?days=7|30|90&tz=Europe/Madrid`. */
export async function GET(request: Request) {
  const user = await requireUser(["admin"]);
  if (user instanceof NextResponse) return user;
  const params = new URL(request.url).searchParams;
  const report = await buildAnalyticsReport(parseRange(params.get("days")), parseTimeZone(params.get("tz")));
  return NextResponse.json({ report });
}
