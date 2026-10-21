import { NextResponse } from "next/server";
import { dataErrorResponse, jsonError, readJson, requireApproved } from "@/lib/access";
import { createCreature, listCreatures } from "@/lib/data";
import { parseCreatureInput } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await requireApproved();
  if (user instanceof NextResponse) return user;
  return NextResponse.json({ creatures: await listCreatures(user) });
}

export async function POST(request: Request) {
  const user = await requireApproved();
  if (user instanceof NextResponse) return user;
  const input = parseCreatureInput(await readJson(request));
  if (!input) return jsonError(400, "Invalid creature.");
  const result = await createCreature(user, input);
  return result.ok ? NextResponse.json({ creature: result.value }, { status: 201 }) : dataErrorResponse(result.error);
}
