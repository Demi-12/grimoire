import { NextResponse } from "next/server";
import { dataErrorResponse, jsonError, requireUser, rateLimit } from "@/lib/access";
import { WRITE_LIMIT } from "@/lib/rate-limit";
import { readBattleMapBackground, setBattleMapBackground, type MapAudience } from "@/lib/battle-map-data";
import { sniffImageType } from "@/lib/battle-map";
import { MAX_IMAGE_BYTES, readBytesLimited } from "@/lib/request-body";
import { isUuid } from "@/lib/permissions";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

const audienceOf = (request: Request): MapAudience => new URL(request.url).searchParams.get("audience") === "players" ? "players" : "auto";

/** The map's background picture (any member). The page asks for it with `?k=<key>`, so a new upload gets a new URL. */
export async function GET(_request: Request, { params }: Context) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const { id } = await params;
  if (!isUuid(id)) return jsonError(404, "Not found.");
  const result = await readBattleMapBackground(user, id);
  if (!result.ok) return dataErrorResponse(result.error);
  if (!result.value) return jsonError(404, "Not found.");
  return new Response(new Uint8Array(result.value.image), {
    headers: {
      "Content-Type": result.value.mimeType,
      "Cache-Control": "private, max-age=86400",
      ETag: `"${result.value.key}"`,
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}

/** Upload a new background (DMs): the raw PNG, JPEG, WebP or GIF as the request body, up to 5 MB. */
export async function PUT(request: Request, { params }: Context) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const limited = rateLimit(user, WRITE_LIMIT);
  if (limited) return limited;
  const { id } = await params;
  if (!isUuid(id)) return jsonError(404, "Not found.");
  const bytes = await readBytesLimited(request, MAX_IMAGE_BYTES);
  if (!bytes) return jsonError(413, "Send a PNG, JPEG, WebP or GIF picture of 5 MB or less.");
  const mimeType = sniffImageType(bytes);
  if (!mimeType) return jsonError(415, "Use a PNG, JPEG, WebP or GIF picture.");
  const result = await setBattleMapBackground(user, id, { bytes, mimeType }, audienceOf(request));
  return result.ok ? NextResponse.json({ map: result.value }) : dataErrorResponse(result.error);
}

/** Remove the background (DMs). */
export async function DELETE(request: Request, { params }: Context) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const limited = rateLimit(user, WRITE_LIMIT);
  if (limited) return limited;
  const { id } = await params;
  if (!isUuid(id)) return jsonError(404, "Not found.");
  const result = await setBattleMapBackground(user, id, null, audienceOf(request));
  return result.ok ? NextResponse.json({ map: result.value }) : dataErrorResponse(result.error);
}
