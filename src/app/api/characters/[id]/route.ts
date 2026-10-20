import { NextResponse } from "next/server";
import { dataErrorResponse, jsonError, readJson, requireApproved } from "@/lib/access";
import { deleteCharacter, updateCharacter } from "@/lib/data";
import { isUuid, parseCharacterInput } from "@/lib/permissions";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export async function PUT(request: Request, { params }: Context) {
  const user = await requireApproved();
  if (user instanceof NextResponse) return user;
  const { id } = await params;
  if (!isUuid(id)) return jsonError(404, "Not found.");
  const input = parseCharacterInput(await readJson(request));
  if (!input) return jsonError(400, "Invalid character.");
  const result = await updateCharacter(user, id, input);
  return result.ok ? NextResponse.json({ character: result.value }) : dataErrorResponse(result.error);
}

export async function DELETE(_request: Request, { params }: Context) {
  const user = await requireApproved();
  if (user instanceof NextResponse) return user;
  const { id } = await params;
  if (!isUuid(id)) return jsonError(404, "Not found.");
  const result = await deleteCharacter(user, id);
  return result.ok ? new NextResponse(null, { status: 204 }) : dataErrorResponse(result.error);
}
