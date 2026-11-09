import { NextResponse } from "next/server";
import { dataErrorResponse, jsonError, readJson, requireUser, rateLimit } from "@/lib/access";
import { MAP_LIMIT } from "@/lib/rate-limit";
import { changeBattleMap, readBattleMap, type MapAudience } from "@/lib/battle-map-data";
import { parseMapOps } from "@/lib/battle-map";
import { isUuid } from "@/lib/permissions";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

const audienceOf = (request: Request): MapAudience => new URL(request.url).searchParams.get("audience") === "players" ? "players" : "auto";

/** The campaign's battle map as the caller may see it (any member). */
export async function GET(request: Request, { params }: Context) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const { id } = await params;
  if (!isUuid(id)) return jsonError(404, "Not found.");
  const result = await readBattleMap(user, id, audienceOf(request));
  return result.ok ? NextResponse.json({ map: result.value }) : dataErrorResponse(result.error);
}

/** Apply a batch of changes: `{ ops: [{ type: "move", tokenId, x, y }, …] }`. */
export async function POST(request: Request, { params }: Context) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const limited = rateLimit(user, MAP_LIMIT);
  if (limited) return limited;
  const { id } = await params;
  if (!isUuid(id)) return jsonError(404, "Not found.");
  const ops = parseMapOps(await readJson(request));
  if (!ops) return jsonError(400, "Invalid map change.");
  const result = await changeBattleMap(user, id, ops, audienceOf(request));
  return result.ok ? NextResponse.json({ map: result.value }) : dataErrorResponse(result.error);
}
