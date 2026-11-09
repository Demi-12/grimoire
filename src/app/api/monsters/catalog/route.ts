import { NextResponse } from "next/server";
import { fetchMonsterCatalog, upstreamErrorResponse } from "@/lib/monster-upstream";

// Built at request time on the server; the first call after a restart reads the whole Open5e bestiary.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const catalog = await fetchMonsterCatalog();
    return NextResponse.json(catalog, {
      headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800" },
    });
  } catch (cause) {
    const { error, status } = upstreamErrorResponse(cause);
    return NextResponse.json({ error }, { status });
  }
}
