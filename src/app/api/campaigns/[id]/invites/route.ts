import { NextResponse } from "next/server";
import { dataErrorResponse, jsonError, requireUser } from "@/lib/access";
import { createCampaignInvite, listCampaignInvites } from "@/lib/data";
import { isUuid } from "@/lib/permissions";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

/** Live invite links of the campaign (managers only). */
export async function GET(_request: Request, { params }: Context) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const { id } = await params;
  if (!isUuid(id)) return jsonError(404, "Not found.");
  const result = await listCampaignInvites(user, id);
  return result.ok ? NextResponse.json({ invites: result.value }) : dataErrorResponse(result.error);
}

/** Create a new invite link (managers only). */
export async function POST(_request: Request, { params }: Context) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const { id } = await params;
  if (!isUuid(id)) return jsonError(404, "Not found.");
  const result = await createCampaignInvite(user, id);
  return result.ok ? NextResponse.json({ invite: result.value }, { status: 201 }) : dataErrorResponse(result.error);
}
