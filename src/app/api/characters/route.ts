import { NextResponse } from "next/server";
import { recordEvent } from "@/lib/analytics-server";
import { dataErrorResponse, jsonError, readJson, requireUser, rateLimit } from "@/lib/access";
import { WRITE_LIMIT } from "@/lib/rate-limit";
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
  const limited = rateLimit(user, WRITE_LIMIT);
  if (limited) return limited;
  const input = parseCharacterInput(await readJson(request));
  if (!input) return jsonError(400, "Invalid character.");
  const result = await createCharacter(user, input);
  if (result.ok) await recordEvent(user.id, "character.created", { mode: input.build ? "creator" : "manual", level: input.level });
  return result.ok ? NextResponse.json({ character: result.value }, { status: 201 }) : dataErrorResponse(result.error);
}
