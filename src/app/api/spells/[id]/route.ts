import { NextResponse } from "next/server";
import { upstreamErrorResponse } from "@/lib/monster-upstream";
import { fetchSpellDetail } from "@/lib/spell-upstream";

/** Description of one SRD spell, proxied from Open5e and cached for a day like the bestiary's stat blocks. */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (id.length > 80 || !/^[a-z0-9][a-z0-9-]*$/.test(id)) return NextResponse.json({ error: "Invalid spell identifier." }, { status: 400 });
  try {
    const spell = await fetchSpellDetail(id);
    if (!spell) return NextResponse.json({ error: "Spell not found." }, { status: 404 });
    return NextResponse.json(spell, { headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800" } });
  } catch (cause) {
    const { error, status } = upstreamErrorResponse(cause);
    return NextResponse.json({ error }, { status });
  }
}
