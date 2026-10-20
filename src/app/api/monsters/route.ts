import { NextResponse } from "next/server";
import { fetchMonsterIndex, upstreamErrorResponse } from "@/lib/monster-upstream";

const CHALLENGE_RATINGS = new Set([
  "0", "0.125", "0.25", "0.5", ...Array.from({ length: 30 }, (_, index) => String(index + 1)),
]);

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const requestedRating = params.get("challenge_rating")?.trim() ?? "";
  const search = (params.get("search") ?? "").trim().toLocaleLowerCase("en-US");
  const page = Number(params.get("page") ?? "1");
  const limit = Number(params.get("limit") ?? "12");
  if (requestedRating && !CHALLENGE_RATINGS.has(requestedRating)) {
    return NextResponse.json({ error: "Invalid challenge rating filter." }, { status: 400 });
  }
  if (!Number.isInteger(page) || page < 1 || !Number.isInteger(limit) || limit < 1 || limit > 50) {
    return NextResponse.json({ error: "Invalid pagination values." }, { status: 400 });
  }

  try {
    const { edition, results: index } = await fetchMonsterIndex(requestedRating || undefined);
    const matches = index.filter((entry) => !search
      || `${entry.name ?? ""} ${entry.index ?? ""}`.toLocaleLowerCase("en-US").includes(search));
    const results = matches.slice((page - 1) * limit, page * limit);
    return NextResponse.json({ count: matches.length, edition, results }, {
      headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800" },
    });
  } catch (cause) {
    const { error, status } = upstreamErrorResponse(cause);
    return NextResponse.json({ error }, { status });
  }
}
