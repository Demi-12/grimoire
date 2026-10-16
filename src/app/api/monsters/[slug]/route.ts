import { NextResponse } from "next/server";

const API_BASE = "https://www.dnd5eapi.co/api/2024/monsters";

export async function GET(_request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  if (!/^[a-z0-9][a-z0-9-]*$/i.test(slug)) {
    return NextResponse.json({ error: "Invalid monster identifier." }, { status: 400 });
  }

  try {
    const upstream = await fetch(`${API_BASE}/${encodeURIComponent(slug)}?lang=en`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(10_000),
      next: { revalidate: 86_400 },
    });
    if (upstream.status === 404) {
      return NextResponse.json({ error: "Monster not found in the 2024 SRD." }, { status: 404 });
    }
    if (!upstream.ok) {
      return NextResponse.json({ error: "The monster service is temporarily unavailable." }, { status: 502 });
    }

    return NextResponse.json(await upstream.json(), {
      headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800" },
    });
  } catch (cause) {
    const timedOut = cause instanceof Error && cause.name === "TimeoutError";
    return NextResponse.json({ error: timedOut
      ? "The monster service took too long to respond."
      : "Could not reach the monster service. Check the server's internet connection." }, { status: 502 });
  }
}
