import "server-only";

/**
 * Server-side access to the public D&D 5e SRD API (https://www.dnd5eapi.co).
 * The 2024 ruleset (SRD 5.2) is preferred; when its monster data is missing the
 * 2014 ruleset (SRD 5.1) is used so the bestiary keeps working.
 */
const API_ROOT = "https://www.dnd5eapi.co/api";
export const MONSTER_EDITIONS = ["2024", "2014"] as const;
export type MonsterEdition = (typeof MONSTER_EDITIONS)[number];

export class UpstreamError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = "UpstreamError";
  }
}

async function getJson(path: string, edition: MonsterEdition): Promise<{ status: number; body: unknown }> {
  const upstream = await fetch(`${API_ROOT}/${edition}${path}`, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(10_000),
    next: { revalidate: 86_400 },
  });
  if (upstream.status === 404) return { status: 404, body: null };
  if (!upstream.ok) throw new UpstreamError("The monster service is temporarily unavailable.", 502);
  return { status: upstream.status, body: await upstream.json() };
}

function hasResults(body: unknown): body is { results: Array<{ index?: string; name?: string; url?: string }> } {
  return !!body && typeof body === "object" && Array.isArray((body as { results?: unknown }).results);
}

/** Newest edition whose (cached) unfiltered monster index has entries. */
async function preferredEdition(): Promise<MonsterEdition> {
  for (const edition of MONSTER_EDITIONS) {
    const { body } = await getJson("/monsters", edition);
    if (hasResults(body) && body.results.length) return edition;
  }
  throw new UpstreamError("The monster service returned an unexpected index.", 502);
}

/** Monster index of the preferred edition, optionally filtered by challenge rating upstream. */
export async function fetchMonsterIndex(challengeRating?: string) {
  const edition = await preferredEdition();
  const query = challengeRating ? `?challenge_rating=${encodeURIComponent(challengeRating)}` : "";
  const { body } = await getJson(`/monsters${query}`, edition);
  if (!hasResults(body)) throw new UpstreamError("The monster service returned an unexpected index.", 502);
  return { edition, results: body.results };
}

/** One stat block, preferring the 2024 edition. Returns null when no edition has it. */
export async function fetchMonsterDetail(slug: string) {
  for (const edition of MONSTER_EDITIONS) {
    const { status, body } = await getJson(`/monsters/${encodeURIComponent(slug)}`, edition);
    if (status === 404) continue;
    if (!body || typeof body !== "object" || typeof (body as { name?: unknown }).name !== "string") {
      throw new UpstreamError("The creature API returned an unexpected response.", 502);
    }
    return { ...(body as Record<string, unknown>), edition };
  }
  return null;
}

export function upstreamErrorResponse(cause: unknown) {
  if (cause instanceof UpstreamError) return { error: cause.message, status: cause.status };
  const timedOut = cause instanceof Error && cause.name === "TimeoutError";
  return {
    error: timedOut
      ? "The monster service took too long to respond."
      : "Could not reach the monster service. Check the server's internet connection.",
    status: 502,
  };
}
