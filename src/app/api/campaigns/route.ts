import { NextResponse } from "next/server";
import { dataErrorResponse, jsonError, readJson, requireApproved } from "@/lib/access";
import { createCampaign, listCampaigns } from "@/lib/data";
import { parseCampaignInput } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await requireApproved();
  if (user instanceof NextResponse) return user;
  return NextResponse.json({ campaigns: await listCampaigns(user) });
}

export async function POST(request: Request) {
  const user = await requireApproved();
  if (user instanceof NextResponse) return user;
  const input = parseCampaignInput(await readJson(request));
  if (!input) return jsonError(400, "Invalid campaign.");
  const result = await createCampaign(user, input);
  return result.ok ? NextResponse.json({ campaign: result.value }, { status: 201 }) : dataErrorResponse(result.error);
}
