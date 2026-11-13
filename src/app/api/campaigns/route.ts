import { NextResponse } from "next/server";
import { recordEvent } from "@/lib/analytics-server";
import { dataErrorResponse, jsonError, readJson, requireUser, rateLimit } from "@/lib/access";
import { WRITE_LIMIT } from "@/lib/rate-limit";
import { createCampaign, listCampaigns } from "@/lib/data";
import { parseCampaignInput } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  return NextResponse.json({ campaigns: await listCampaigns(user) });
}

export async function POST(request: Request) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const limited = rateLimit(user, WRITE_LIMIT);
  if (limited) return limited;
  const input = parseCampaignInput(await readJson(request));
  if (!input) return jsonError(400, "Invalid campaign.");
  const result = await createCampaign(user, input);
  if (result.ok) await recordEvent(user.id, "campaign.created");
  return result.ok ? NextResponse.json({ campaign: result.value }, { status: 201 }) : dataErrorResponse(result.error);
}
