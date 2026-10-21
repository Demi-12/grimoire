import { NextResponse } from "next/server";
import { dataErrorResponse, jsonError, readJson, requireUser } from "@/lib/access";
import { deleteHomebrew, readHomebrewForUser, setHomebrewLocked, updateHomebrew } from "@/lib/data";
import { isHomebrewId, parseHomebrewInput } from "@/lib/homebrew";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

const MAX_BODY_BYTES = 100_000;

export async function GET(_request: Request, { params }: Context) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const { id } = await params;
  if (!isHomebrewId(id)) return jsonError(404, "Not found.");
  const monster = await readHomebrewForUser(user, id);
  return monster ? NextResponse.json({ monster }) : jsonError(404, "Not found.");
}

export async function PUT(request: Request, { params }: Context) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const { id } = await params;
  if (!isHomebrewId(id)) return jsonError(404, "Not found.");
  if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) return jsonError(413, "That monster is too large.");
  const parsed = parseHomebrewInput(await readJson(request));
  if (!parsed.ok) return jsonError(400, parsed.error);
  const result = await updateHomebrew(user, id, parsed.value, parsed.summary);
  return result.ok ? NextResponse.json({ monster: result.value }) : dataErrorResponse(result.error);
}

/** Admin moderation: `{ "locked": true }` pulls a published monster back to private and blocks republishing. */
export async function PATCH(request: Request, { params }: Context) {
  const user = await requireUser(["admin"]);
  if (user instanceof NextResponse) return user;
  const { id } = await params;
  if (!isHomebrewId(id)) return jsonError(404, "Not found.");
  const body = await readJson(request);
  if (!body || typeof body !== "object" || typeof (body as { locked?: unknown }).locked !== "boolean") return jsonError(400, "Expected { locked: boolean }.");
  const result = await setHomebrewLocked(user, id, (body as { locked: boolean }).locked);
  return result.ok ? NextResponse.json({ monster: result.value }) : dataErrorResponse(result.error);
}

export async function DELETE(_request: Request, { params }: Context) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const { id } = await params;
  if (!isHomebrewId(id)) return jsonError(404, "Not found.");
  const result = await deleteHomebrew(user, id);
  return result.ok ? new NextResponse(null, { status: 204 }) : dataErrorResponse(result.error);
}
