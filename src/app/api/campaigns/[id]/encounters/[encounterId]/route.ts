import { NextResponse } from "next/server";
import { dataErrorResponse, jsonError, readJson, requireUser } from "@/lib/access";
import { deleteEncounter, updateEncounter } from "@/lib/data";
import { encounterStatuses, isUuid, type EncounterStatus } from "@/lib/permissions";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string; encounterId: string }> };

/** Edit title, notes or status (planned/played) of a saved encounter. */
export async function PATCH(request: Request, { params }: Context) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const { encounterId } = await params;
  if (!isUuid(encounterId)) return jsonError(404, "Not found.");
  const body = await readJson(request) as { title?: unknown; notes?: unknown; status?: unknown } | null;
  if (!body || typeof body !== "object") return jsonError(400, "Invalid encounter.");
  const title = body.title === undefined ? undefined : typeof body.title === "string" ? body.title.trim() : null;
  const notes = body.notes === undefined ? undefined : typeof body.notes === "string" ? body.notes.trim() : null;
  const status = body.status === undefined ? undefined : encounterStatuses.includes(body.status as EncounterStatus) ? body.status as EncounterStatus : null;
  if (title === null || notes === null || status === null || title === "" || (title?.length ?? 0) > 80 || (notes?.length ?? 0) > 2000
    || (title === undefined && notes === undefined && status === undefined)) return jsonError(400, "Invalid encounter.");
  const result = await updateEncounter(user, encounterId, { title, notes, status });
  return result.ok ? NextResponse.json({ encounter: result.value }) : dataErrorResponse(result.error);
}

export async function DELETE(_request: Request, { params }: Context) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const { encounterId } = await params;
  if (!isUuid(encounterId)) return jsonError(404, "Not found.");
  const result = await deleteEncounter(user, encounterId);
  return result.ok ? new NextResponse(null, { status: 204 }) : dataErrorResponse(result.error);
}
