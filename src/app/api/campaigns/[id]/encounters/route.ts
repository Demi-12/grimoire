import { NextResponse } from "next/server";
import { dataErrorResponse, jsonError, readJson, requireUser } from "@/lib/access";
import { createEncounter, listEncounters } from "@/lib/data";
import { isUuid, parseEncounterInput } from "@/lib/permissions";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Context) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const { id } = await params;
  if (!isUuid(id)) return jsonError(404, "Not found.");
  const result = await listEncounters(user, id);
  return result.ok ? NextResponse.json({ encounters: result.value }) : dataErrorResponse(result.error);
}

export async function POST(request: Request, { params }: Context) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const { id } = await params;
  if (!isUuid(id)) return jsonError(404, "Not found.");
  const input = parseEncounterInput(await readJson(request));
  if (!input) return jsonError(400, "Invalid encounter.");
  const result = await createEncounter(user, id, input);
  return result.ok ? NextResponse.json({ encounter: result.value }, { status: 201 }) : dataErrorResponse(result.error);
}
