import { NextResponse } from "next/server";
import { dataErrorResponse, jsonError, readJson, requireUser } from "@/lib/access";
import { createCharacter, listCharacters } from "@/lib/data";
import { parseCharacterInput } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  return NextResponse.json({ characters: await listCharacters(user) });
}

export async function POST(request: Request) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const input = parseCharacterInput(await readJson(request));
  if (!input) return jsonError(400, "Invalid character.");
  const result = await createCharacter(user, input);
  return result.ok ? NextResponse.json({ character: result.value }, { status: 201 }) : dataErrorResponse(result.error);
}
