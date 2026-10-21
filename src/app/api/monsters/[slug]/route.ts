import { NextResponse } from "next/server";
import { jsonError, requireUser } from "@/lib/access";
import { readHomebrewForUser } from "@/lib/data";
import { isHomebrewId, parseHomebrewSlug } from "@/lib/homebrew";
import { fetchMonsterDetail, upstreamErrorResponse } from "@/lib/monster-upstream";

export async function GET(_request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  if (slug.length > 100) return NextResponse.json({ error: "Invalid monster identifier." }, { status: 400 });

  // Homebrew monsters are per-account data: signed-in users only, never cached by shared caches.
  const homebrewId = parseHomebrewSlug(slug);
  if (homebrewId !== null) {
    const user = await requireUser();
    if (user instanceof NextResponse) return user;
    if (!isHomebrewId(homebrewId)) return jsonError(404, "Monster not found.");
    const monster = await readHomebrewForUser(user, homebrewId);
    if (!monster) return jsonError(404, "Monster not found.");
    return NextResponse.json(
      { ...monster.statBlock, index: slug, homebrew: { ownerName: monster.ownerName } },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  }

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
