import { NextResponse } from "next/server";
import { dataErrorResponse, jsonError, requireUser, rateLimit } from "@/lib/access";
import { WRITE_LIMIT } from "@/lib/rate-limit";
import { revokeCampaignInvite } from "@/lib/data";
import { isUuid } from "@/lib/permissions";

export const dynamic = "force-dynamic";

/** Revoke an invite link so it stops working immediately. */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string; inviteId: string }> }) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const limited = rateLimit(user, WRITE_LIMIT);
  if (limited) return limited;
  const { id, inviteId } = await params;
  if (!isUuid(id) || !isUuid(inviteId)) return jsonError(404, "Not found.");
  const result = await revokeCampaignInvite(user, id, inviteId);
  return result.ok ? new NextResponse(null, { status: 204 }) : dataErrorResponse(result.error);
}
