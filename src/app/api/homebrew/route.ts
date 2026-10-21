import { NextResponse } from "next/server";
import { dataErrorResponse, jsonError, readJson, requireUser, rateLimit } from "@/lib/access";
import { createHomebrew, listHomebrew } from "@/lib/data";
import { parseHomebrewInput } from "@/lib/homebrew";
import { WRITE_LIMIT } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 100_000;

export async function GET() {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  return NextResponse.json({ monsters: await listHomebrew(user) });
}

export async function POST(request: Request) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const limited = rateLimit(user, WRITE_LIMIT);
  if (limited) return limited;
  if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) return jsonError(413, "That monster is too large.");
  const parsed = parseHomebrewInput(await readJson(request));
  if (!parsed.ok) return jsonError(400, parsed.error);
  const result = await createHomebrew(user, parsed.value, parsed.summary);
  return result.ok ? NextResponse.json({ monster: result.value }, { status: 201 }) : dataErrorResponse(result.error);
}
