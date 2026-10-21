import { NextResponse } from "next/server";
import { dataErrorResponse, jsonError, requireUser, rateLimit } from "@/lib/access";
import { WRITE_LIMIT } from "@/lib/rate-limit";
import { removeCampaignCharacter } from "@/lib/data";
import { isUuid } from "@/lib/permissions";

export const dynamic = "force-dynamic";

/** Take a character out of the campaign without deleting it. */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string; characterId: string }> }) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const limited = rateLimit(user, WRITE_LIMIT);
  if (limited) return limited;
  const { id, characterId } = await params;
  if (!isUuid(id) || !isUuid(characterId)) return jsonError(404, "Not found.");
  const result = await removeCampaignCharacter(user, id, characterId);
  return result.ok ? new NextResponse(null, { status: 204 }) : dataErrorResponse(result.error);
}
