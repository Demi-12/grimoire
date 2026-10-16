import { NextResponse } from "next/server";

const API_BASE = "https://www.dnd5eapi.co/api/2024/monsters";
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

  const upstreamUrl = new URL(API_BASE);
  if (requestedRating) upstreamUrl.searchParams.set("challenge_rating", requestedRating);
  try {
    const upstream = await fetch(upstreamUrl, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(10_000),
      next: { revalidate: 86_400 },
    });
    if (!upstream.ok) {
      return NextResponse.json({ error: "The monster service is temporarily unavailable." }, { status: 502 });
    }
    const payload: unknown = await upstream.json();
    if (!payload || typeof payload !== "object" || !Array.isArray((payload as { results?: unknown }).results)) {
      return NextResponse.json({ error: "The monster service returned an unexpected index." }, { status: 502 });
    }
    const apiPayload = payload as { count?: unknown; results: Array<{ index?: string; name?: string; url?: string }> };
    const matches = apiPayload.results.filter((entry) => !search
      || `${entry.name ?? ""} ${entry.index ?? ""}`.toLocaleLowerCase("en-US").includes(search));
    const results = matches.slice((page - 1) * limit, page * limit);
    return NextResponse.json({ count: matches.length, results }, {
      headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800" },
    });
  } catch (cause) {
    const timedOut = cause instanceof Error && cause.name === "TimeoutError";
    return NextResponse.json({ error: timedOut
      ? "The monster service took too long to respond."
      : "Could not reach the monster service. Check the server's internet connection." }, { status: 502 });
  }
}
