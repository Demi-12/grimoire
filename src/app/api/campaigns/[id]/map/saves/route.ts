import { NextResponse } from "next/server";
import { dataErrorResponse, jsonError, readJson, requireUser, rateLimit } from "@/lib/access";
import { WRITE_LIMIT } from "@/lib/rate-limit";
import { createMapSave, listMapSaves, MAP_SAVE_NAME_MAX } from "@/lib/battle-map-data";
import { isUuid } from "@/lib/permissions";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

/** Saved maps of the campaign (DMs). */
export async function GET(_request: Request, { params }: Context) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const { id } = await params;
  if (!isUuid(id)) return jsonError(404, "Not found.");
  const result = await listMapSaves(user, id);
  return result.ok ? NextResponse.json({ saves: result.value }) : dataErrorResponse(result.error);
}

/** Save the map as it is now under a name: `{ name }` (DMs). */
export async function POST(request: Request, { params }: Context) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const limited = rateLimit(user, WRITE_LIMIT);
  if (limited) return limited;
  const { id } = await params;
  if (!isUuid(id)) return jsonError(404, "Not found.");
  const body = await readJson(request) as { name?: unknown } | null;
  const name = typeof body?.name === "string" ? body.name.replace(/\s+/g, " ").trim() : "";
  if (!name || name.length > MAP_SAVE_NAME_MAX) return jsonError(400, `Give the map a name of up to ${MAP_SAVE_NAME_MAX} characters.`);
  const result = await createMapSave(user, id, name);
  return result.ok ? NextResponse.json({ saves: result.value }) : dataErrorResponse(result.error);
}
