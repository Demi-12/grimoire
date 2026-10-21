import { NextResponse } from "next/server";
import { dataErrorResponse, jsonError, readJson, requireUser } from "@/lib/access";
import { addCampaignMember } from "@/lib/data";
import { isCampaignRole, isUuid } from "@/lib/permissions";

export const dynamic = "force-dynamic";

/** Add an approved account to the campaign, or change the role of an existing member. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const { id } = await params;
  if (!isUuid(id)) return jsonError(404, "Not found.");
  const body = await readJson(request) as { userId?: unknown; role?: unknown } | null;
  if (!body || typeof body.userId !== "string" || !body.userId || !isCampaignRole(body.role)) return jsonError(400, "Invalid member.");
  const result = await addCampaignMember(user, id, body.userId, body.role);
  return result.ok ? new NextResponse(null, { status: 204 }) : dataErrorResponse(result.error);
}
