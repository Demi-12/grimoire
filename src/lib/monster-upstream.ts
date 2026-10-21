import "server-only";
import { inferMonsterRoles, type MonsterRole, type MonsterStatBlock } from "@/lib/monster-api";

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
    const detail: Record<string, unknown> = { ...(body as Record<string, unknown>), edition };
    if (typeof detail.image !== "string" && edition !== "2014") {
      const image = await legacyImage(slug);
      if (image) detail.image = image;
    }
    return detail;
  }
  return null;
}

/** The 2014 entry often has an illustration when the 2024 one does not; best effort only. */
async function legacyImage(slug: string): Promise<string | undefined> {
  try {
    const { body } = await getJson(`/monsters/${encodeURIComponent(slug)}`, "2014");
    const image = (body as { image?: unknown } | null)?.image;
    return typeof image === "string" ? image : undefined;
  } catch {
    return undefined;
  }
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

/** XP by challenge rating (SRD), used when a stat block omits its XP. */
export const XP_BY_CR: Record<string, number> = {
  "0": 10, "0.125": 25, "0.25": 50, "0.5": 100, "1": 200, "2": 450, "3": 700, "4": 1100, "5": 1800, "6": 2300,
  "7": 2900, "8": 3900, "9": 5000, "10": 5900, "11": 7200, "12": 8400, "13": 10000, "14": 11500, "15": 13000,
  "16": 15000, "17": 18000, "18": 20000, "19": 22000, "20": 25000, "21": 33000, "22": 41000, "23": 50000,
  "24": 62000, "25": 75000, "26": 90000, "27": 105000, "28": 120000, "29": 135000, "30": 155000,
};

export interface CompactMonster {
  index: string;
  name: string;
  cr: number;
  xp: number;
  type: string;
  size: string;
  roles: MonsterRole[];
}

const CATALOG_TTL_MS = 24 * 60 * 60 * 1000;
let catalogCache: { at: number; promise: Promise<{ edition: MonsterEdition; monsters: CompactMonster[] }> } | undefined;

async function mapLimited<T, R>(items: T[], limit: number, task: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const index = next++;
      results[index] = await task(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

async function buildCatalog() {
  const { edition, results } = await fetchMonsterIndex();
  const monsters = await mapLimited(results, 8, async (entry) => {
    if (!entry.index) return null;
    try {
      const { body } = await getJson(`/monsters/${encodeURIComponent(entry.index)}`, edition);
      if (!body || typeof body !== "object") return null;
      const stat = body as MonsterStatBlock;
      const cr = typeof stat.challenge_rating === "number" ? stat.challenge_rating : Number.NaN;
      const xp = typeof stat.xp === "number" && stat.xp > 0 ? stat.xp : XP_BY_CR[String(cr)];
      if (!Number.isFinite(cr) || !xp) return null;
      return { index: entry.index, name: stat.name, cr, xp, type: (stat.type ?? "").toLowerCase(), size: stat.size ?? "", roles: inferMonsterRoles(stat) };
    } catch {
      return null; // One failing stat block should not hide the rest of the bestiary.
    }
  });
  const list = monsters.filter((monster): monster is CompactMonster => monster !== null);
  if (!list.length) throw new UpstreamError("The monster service returned no usable stat blocks.", 502);
  return { edition, monsters: list.sort((a, b) => a.cr - b.cr || a.name.localeCompare(b.name)) };
}

/** Every SRD monster with CR, XP, type and inferred roles; cached in memory for a day. */
export function fetchMonsterCatalog() {
  if (!catalogCache || Date.now() - catalogCache.at > CATALOG_TTL_MS) {
    const promise = buildCatalog();
    catalogCache = { at: Date.now(), promise };
    promise.catch(() => { if (catalogCache?.promise === promise) catalogCache = undefined; });
  }
  return catalogCache.promise;
}
