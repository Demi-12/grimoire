import { NextResponse } from "next/server";
import { dataErrorResponse, jsonError, requireUser, rateLimit } from "@/lib/access";
import { WRITE_LIMIT } from "@/lib/rate-limit";
import { removeCampaignMember } from "@/lib/data";
import { isUuid } from "@/lib/permissions";

export const dynamic = "force-dynamic";

/** Remove a member (managers) or leave the campaign (the member themselves). */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string; userId: string }> }) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const limited = rateLimit(user, WRITE_LIMIT);
  if (limited) return limited;
  const { id, userId } = await params;
  if (!isUuid(id) || userId.length > 128) return jsonError(404, "Not found.");
  const result = await removeCampaignMember(user, id, userId);
  return result.ok ? new NextResponse(null, { status: 204 }) : dataErrorResponse(result.error);
}
