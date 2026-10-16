import { NextResponse } from "next/server";
import { fetchMonsterDetail, upstreamErrorResponse } from "@/lib/monster-upstream";

export async function GET(_request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  if (!/^[a-z0-9][a-z0-9-]*$/i.test(slug)) {
    return NextResponse.json({ error: "Invalid monster identifier." }, { status: 400 });
  }

  try {
    const monster = await fetchMonsterDetail(slug);
    if (!monster) return NextResponse.json({ error: "Monster not found in the SRD." }, { status: 404 });
    return NextResponse.json(monster, {
      headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800" },
    });
  } catch (cause) {
    const { error, status } = upstreamErrorResponse(cause);
    return NextResponse.json({ error }, { status });
  }
}
