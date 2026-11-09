import { NextResponse } from "next/server";
import { fetchMonsterCatalog, upstreamErrorResponse } from "@/lib/monster-upstream";

const CHALLENGE_RATINGS = new Set([
  "0", "0.125", "0.25", "0.5", ...Array.from({ length: 30 }, (_, index) => String(index + 1)),
]);

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const requestedRating = params.get("challenge_rating")?.trim() ?? "";
  const source = params.get("source")?.trim() ?? "";
  const search = (params.get("search") ?? "").trim().toLocaleLowerCase("en-US");
  const page = Number(params.get("page") ?? "1");
  const limit = Number(params.get("limit") ?? "12");
  if (search.length > 100) return NextResponse.json({ error: "Search text is too long." }, { status: 400 });
  if (source.length > 60 || !/^[a-z0-9-]*$/i.test(source)) return NextResponse.json({ error: "Invalid book filter." }, { status: 400 });
  if (requestedRating && !CHALLENGE_RATINGS.has(requestedRating)) {
    return NextResponse.json({ error: "Invalid challenge rating filter." }, { status: 400 });
  }
  if (!Number.isInteger(page) || page < 1 || !Number.isInteger(limit) || limit < 1 || limit > 50) {
    return NextResponse.json({ error: "Invalid pagination values." }, { status: 400 });
  }

  try {
    const { monsters, sources } = await fetchMonsterCatalog();
    const rating = requestedRating ? Number(requestedRating) : undefined;
    const matches = monsters.filter((monster) => (rating === undefined || monster.cr === rating)
      && (!source || monster.sourceKey === source)
      && (!search || monster.name.toLocaleLowerCase("en-US").includes(search)));
    const results = matches.slice((page - 1) * limit, page * limit)
      .map(({ index, name, cr, type, source: book }) => ({ index, name, cr, type, source: book }));
    return NextResponse.json({ count: matches.length, sources, results }, {
      headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800" },
    });
  } catch (cause) {
    const { error, status } = upstreamErrorResponse(cause);
    return NextResponse.json({ error }, { status });
  }
}
