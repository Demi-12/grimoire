import { NextResponse } from "next/server";
import { dataErrorResponse, jsonError, requireUser, rateLimit } from "@/lib/access";
import { WRITE_LIMIT } from "@/lib/rate-limit";
import { deleteMapSave, loadMapSave, type MapAudience } from "@/lib/battle-map-data";
import { isUuid } from "@/lib/permissions";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string; saveId: string }> };

const audienceOf = (request: Request): MapAudience => new URL(request.url).searchParams.get("audience") === "players" ? "players" : "auto";

/** Put this saved map on the table, replacing the current one (DMs). */
export async function POST(request: Request, { params }: Context) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const limited = rateLimit(user, WRITE_LIMIT);
  if (limited) return limited;
  const { id, saveId } = await params;
  if (!isUuid(id) || !isUuid(saveId)) return jsonError(404, "Not found.");
  const result = await loadMapSave(user, id, saveId, audienceOf(request));
  return result.ok ? NextResponse.json({ map: result.value }) : dataErrorResponse(result.error);
}

/** Delete a saved map (DMs). */
export async function DELETE(_request: Request, { params }: Context) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const limited = rateLimit(user, WRITE_LIMIT);
  if (limited) return limited;
  const { id, saveId } = await params;
  if (!isUuid(id) || !isUuid(saveId)) return jsonError(404, "Not found.");
  const result = await deleteMapSave(user, id, saveId);
  return result.ok ? NextResponse.json({ saves: result.value }) : dataErrorResponse(result.error);
}
