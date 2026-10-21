import { NextResponse } from "next/server";
import { dataErrorResponse, jsonError, requireUser } from "@/lib/access";
import { removeCampaignMember } from "@/lib/data";
import { isUuid } from "@/lib/permissions";

export const dynamic = "force-dynamic";

/** Remove a member (managers) or leave the campaign (the member themselves). */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string; userId: string }> }) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const { id, userId } = await params;
  if (!isUuid(id)) return jsonError(404, "Not found.");
  const result = await removeCampaignMember(user, id, userId);
  return result.ok ? new NextResponse(null, { status: 204 }) : dataErrorResponse(result.error);
}
