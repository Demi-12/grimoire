import { NextResponse } from "next/server";
import { dataErrorResponse, jsonError, readJson, requireUser, rateLimit } from "@/lib/access";
import { WRITE_LIMIT } from "@/lib/rate-limit";
import { createCreature, listCreatures } from "@/lib/data";
import { parseCreatureInput } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  return NextResponse.json({ creatures: await listCreatures(user) });
}

export async function POST(request: Request) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const limited = rateLimit(user, WRITE_LIMIT);
  if (limited) return limited;
  const input = parseCreatureInput(await readJson(request));
  if (!input) return jsonError(400, "Invalid creature.");
  const result = await createCreature(user, input);
  return result.ok ? NextResponse.json({ creature: result.value }, { status: 201 }) : dataErrorResponse(result.error);
}
