import { NextResponse } from "next/server";
import { dataErrorResponse, jsonError, requireUser, rateLimit } from "@/lib/access";
import { WRITE_LIMIT } from "@/lib/rate-limit";
import { loadMapSave, type MapAudience } from "@/lib/battle-map-data";
import { isUuid } from "@/lib/permissions";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

/** Start a new, empty map (DMs). Save the current one first if it should come back. */
export async function POST(request: Request, { params }: Context) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const limited = rateLimit(user, WRITE_LIMIT);
  if (limited) return limited;
  const { id } = await params;
  if (!isUuid(id)) return jsonError(404, "Not found.");
  const audience: MapAudience = new URL(request.url).searchParams.get("audience") === "players" ? "players" : "auto";
  const result = await loadMapSave(user, id, null, audience);
  return result.ok ? NextResponse.json({ map: result.value }) : dataErrorResponse(result.error);
}
