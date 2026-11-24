import { inferMonsterRoles, type SourceSummary } from "@grimoire/shared/monster-api";
import type { InferredMonsterRole } from "@grimoire/shared/monster-roles";
import {
  challengeOf, legacySlugCandidates, OPEN5E_ROOT, toSource, toStatBlock, withoutSupersededCopies, type Open5eCreature,
} from "@grimoire/shared/open5e";

/**
 * Server-side access to the Open5e API (https://open5e.com), which serves every openly licensed 5e book:
 * the SRD 5.1 and 5.2 plus third-party bestiaries such as Tome of Beasts or the Level Up Monstrous Menagerie.
 * The whole compact catalog is built once a day and kept in memory; single stat blocks are kept for a day too (see getJson).
 */
const API_ROOT = `${OPEN5E_ROOT}/v2`;
const PAGE_SIZE = 200;
/** A single stat block is small and quick. */
const DETAIL_TIMEOUT_MS = 20_000;
/** Catalog pages are ~400 KB each and Open5e can take 15-30 s to serve them when several are requested at once. */
const CATALOG_PAGE_TIMEOUT_MS = 90_000;
const CATALOG_PAGE_ATTEMPTS = 2;

export class UpstreamError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = "UpstreamError";
  }
}

type UpstreamReply = { status: number; body: unknown };

/** How long a stat block or spell text is kept: Open5e data changes with book releases, not by the hour. */
const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_CACHED_REPLIES = 2_000;
const dayCache = new Map<string, { at: number; reply: UpstreamReply }>();

function cached(path: string): UpstreamReply | undefined {
  const entry = dayCache.get(path);
  if (!entry) return undefined;
  if (Date.now() - entry.at > DAY_MS) { dayCache.delete(path); return undefined; }
  return entry.reply;
}

function remember(path: string, reply: UpstreamReply) {
  // Oldest entries go first (a Map keeps insertion order).
  for (const key of dayCache.keys()) {
    if (dayCache.size < MAX_CACHED_REPLIES) break;
    dayCache.delete(key);
  }
  dayCache.set(path, { at: Date.now(), reply });
}

/** GET a path of the Open5e API. `"day"` keeps the answer (found or 404) in this process's memory for a day. */
export async function getJson(path: string, cache: "day" | "none" = "day", timeoutMs = DETAIL_TIMEOUT_MS): Promise<UpstreamReply> {
  const hit = cache === "day" ? cached(path) : undefined;
  if (hit) return hit;
  const upstream = await fetch(`${API_ROOT}${path}`, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!upstream.ok && upstream.status !== 404) throw new UpstreamError("The monster service is temporarily unavailable.", 502);
  const reply: UpstreamReply = upstream.status === 404 ? { status: 404, body: null } : { status: upstream.status, body: await upstream.json() };
  if (cache === "day") remember(path, reply);
  return reply;
}

function isCreature(body: unknown): body is Open5eCreature {
  return !!body && typeof body === "object" && typeof (body as Open5eCreature).key === "string" && typeof (body as Open5eCreature).name === "string";
}

/** One stat block by Open5e key. Old dnd5eapi slugs ("goblin") resolve to the SRD 5.2, then the SRD 5.1. */
export async function fetchMonsterDetail(slug: string) {
  for (const key of legacySlugCandidates(slug)) {
    const { status, body } = await getJson(`/creatures/${encodeURIComponent(key)}/`);
    if (status === 404) continue;
    if (!isCreature(body)) throw new UpstreamError("The creature API returned an unexpected response.", 502);
    return toStatBlock(body);
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

/** XP by challenge rating, used when a stat block omits its XP. */
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
  roles: InferredMonsterRole[];
  /** Book name, shown next to the creature. */
  source: string;
  sourceKey: string;
}

export interface MonsterCatalogData { monsters: CompactMonster[]; sources: SourceSummary[] }

/**
 * Only what the catalog needs: Open5e trims the rest of each creature server-side. The role rules
 * (monster-roles.ts) read size, HP, AC, speed, Stealth, truesight, tremorsense, traits and every action,
 * legendary ones included (`action_type`), so catalog roles match the roles of the full stat block.
 */
const CATALOG_FIELDS = [
  "fields=key,name,document,type,size,challenge_rating,experience_points,armor_class,hit_points,speed,skill_bonuses,truesight_range,tremorsense_range,actions,traits",
  "document__fields=key,name,display_name,publisher",
  "document__publisher__fields=name",
  "actions__fields=name,desc,action_type",
  "traits__fields=name,desc",
].join("&");

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

function compact(creature: Open5eCreature): CompactMonster | null {
  const cr = challengeOf(creature);
  if (cr === undefined) return null;
  const stat = toStatBlock(creature);
  const xp = typeof creature.experience_points === "number" && creature.experience_points > 0 ? creature.experience_points : XP_BY_CR[String(cr)];
  if (!xp) return null;
  const source = toSource(creature.document);
  return {
    index: creature.key, name: creature.name, cr, xp, type: stat.type ?? "", size: stat.size ?? "", roles: inferMonsterRoles(stat),
    source: source?.name ?? "Open5e", sourceKey: source?.key ?? "",
  };
}

type Page = { count?: unknown; results?: unknown };

async function fetchCatalogPage(page: number) {
  // Not cached per page: pages are large and the whole catalog is kept in memory below.
  const { body } = await getJson(`/creatures/?${CATALOG_FIELDS}&limit=${PAGE_SIZE}&page=${page}`, "none", CATALOG_PAGE_TIMEOUT_MS);
  const data = body as Page | null;
  if (!data || !Array.isArray(data.results)) throw new UpstreamError("The monster service returned an unexpected index.", 502);
  return { count: typeof data.count === "number" ? data.count : 0, results: data.results.filter(isCreature) };
}

/** One slow or dropped page should not sink the whole catalog, so each page is tried more than once. */
async function catalogPage(page: number) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fetchCatalogPage(page);
    } catch (cause) {
      if (attempt >= CATALOG_PAGE_ATTEMPTS) throw cause;
    }
  }
}

async function buildCatalog(): Promise<MonsterCatalogData> {
  const first = await catalogPage(1);
  const pages = Math.ceil(first.count / PAGE_SIZE);
  const rest = await mapLimited(Array.from({ length: Math.max(0, pages - 1) }, (_, index) => index + 2), 4, catalogPage);
  const creatures = [first, ...rest].flatMap((page) => page.results);
  const listed = withoutSupersededCopies(creatures.map((creature) => ({ creature, name: creature.name, source: creature.document })))
    .map(({ creature }) => compact(creature))
    .filter((monster): monster is CompactMonster => monster !== null);
  if (!listed.length) throw new UpstreamError("The monster service returned no usable stat blocks.", 502);

  const sources = new Map<string, SourceSummary>();
  for (const creature of creatures) {
    const source = toSource(creature.document);
    if (source && !sources.has(source.key)) sources.set(source.key, { key: source.key, name: source.name, ...(source.publisher ? { publisher: source.publisher } : {}), count: 0 });
  }
  for (const monster of listed) {
    const summary = sources.get(monster.sourceKey);
    if (summary) summary.count += 1;
  }
  return {
    monsters: listed.sort((a, b) => a.cr - b.cr || a.name.localeCompare(b.name)),
    sources: [...sources.values()].filter((source) => source.count > 0).sort((a, b) => a.name.localeCompare(b.name)),
  };
}

const CATALOG_TTL_MS = 24 * 60 * 60 * 1000;
/** After a failed refresh the previous catalog keeps being served and the refresh is tried again after this long. */
const CATALOG_RETRY_MS = 5 * 60 * 1000;
let catalogCache: { at: number; promise: Promise<MonsterCatalogData> } | undefined;
let lastCatalog: MonsterCatalogData | undefined;

/**
 * Every Open5e creature with CR, XP, type, book and inferred roles; rebuilt at most once a day.
 * Once a catalog has been built it is always served from memory: refreshes run in the background and a failed one
 * leaves the previous catalog in place instead of turning every request into a 502.
 */
export function fetchMonsterCatalog(): Promise<MonsterCatalogData> {
  if (!catalogCache || Date.now() - catalogCache.at > CATALOG_TTL_MS) {
    const entry = { at: Date.now(), promise: undefined as unknown as Promise<MonsterCatalogData> };
    entry.promise = buildCatalog().then(
      (catalog) => { lastCatalog = catalog; return catalog; },
      (cause) => {
        if (lastCatalog) {
          if (catalogCache === entry) entry.at = Date.now() - CATALOG_TTL_MS + CATALOG_RETRY_MS;
          return lastCatalog;
        }
        if (catalogCache === entry) catalogCache = undefined;
        throw cause;
      },
    );
    catalogCache = entry;
  }
  return lastCatalog ? Promise.resolve(lastCatalog) : catalogCache.promise;
}

/** Roles by Open5e key, worked out once per catalog build. */
const rolesByKey = new WeakMap<MonsterCatalogData, Map<string, InferredMonsterRole[]>>();

/**
 * Today's roles of a catalog creature (old dnd5eapi slugs resolve as in fetchMonsterDetail), read from the
 * catalog in memory. Never fetches: undefined until a catalog has been built, or when the slug isn't listed.
 */
export function catalogRolesFor(slug: string): InferredMonsterRole[] | undefined {
  if (!lastCatalog) return undefined;
  let roles = rolesByKey.get(lastCatalog);
  if (!roles) rolesByKey.set(lastCatalog, roles = new Map(lastCatalog.monsters.map((monster) => [monster.index, monster.roles])));
  return legacySlugCandidates(slug).map((key) => roles.get(key)).find(Boolean);
}
