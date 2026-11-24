/** Browser side of the bestiary: stat block types and calls to our /api/monsters routes, which read Open5e. */

/** Book a stat block comes from, as Open5e reports it. */
export type MonsterSource = {
  key: string;
  name: string;
  publisher?: string;
  /** Open5e game system key: "5e-2024", "5e-2014" or "a5e". */
  system?: string;
  url?: string;
  /** License keys, e.g. "cc-by-40" or "ogl-10a". */
  licenses?: string[];
};

export type MonsterAction = {
  name?: string;
  desc?: string | string[];
  attack_bonus?: number;
  damage?: Array<{ damage_type?: { name?: string }; damage_dice?: string }>;
  dc?: { dc_type?: { name?: string }; dc_value?: number; success_type?: string };
};

export type MonsterStatBlock = {
  index?: string;
  name: string;
  size?: string;
  type?: string;
  alignment?: string;
  armor_class?: number | Array<{ type?: string; value?: number; desc?: string }>;
  hit_points?: number;
  hit_dice?: string;
  hit_points_roll?: string;
  speed?: Record<string, string | undefined>;
  strength?: number;
  dexterity?: number;
  constitution?: number;
  intelligence?: number;
  wisdom?: number;
  charisma?: number;
  proficiencies?: Array<{ proficiency?: { name?: string }; value?: number }>;
  damage_vulnerabilities?: string[];
  damage_resistances?: string[];
  damage_immunities?: string[];
  condition_immunities?: Array<{ name?: string }>;
  senses?: Record<string, string | number | undefined>;
  languages?: string;
  challenge_rating?: number;
  proficiency_bonus?: number;
  xp?: number;
  special_abilities?: MonsterAction[];
  actions?: MonsterAction[];
  reactions?: MonsterAction[];
  bonus_actions?: MonsterAction[];
  legendary_actions?: MonsterAction[];
  /** Absolute image URL, when the book has an illustration. */
  image?: string;
  /** Book the stat block comes from. */
  source?: MonsterSource;
  /** Set instead of `source` when the stat block is a homebrew monster. */
  homebrew?: { ownerName: string };
};

export type MonsterListEntry = { index: string; name: string; cr?: number; type?: string; source?: string };
/** A book in the bestiary and how many of its creatures are listed. */
export type SourceSummary = { key: string; name: string; publisher?: string; count: number };
export type MonsterCatalog = { count: number; sources: SourceSummary[]; results: MonsterListEntry[] };

/** Tactical tags inferred from stat block data; Open5e does not provide these labels. */
export type MonsterRole = "frontline" | "damage" | "support" | "control" | "scouting";

export function inferMonsterRoles(monster: MonsterStatBlock): MonsterRole[] {
  const roles = new Set<MonsterRole>();
  const actions = [...(monster.special_abilities ?? []), ...(monster.actions ?? []), ...(monster.bonus_actions ?? []), ...(monster.reactions ?? [])];
  const actionText = actions.map((action) => `${action.name ?? ""} ${textValue(action.desc)}`).join(" ").toLowerCase();
  const ac = typeof monster.armor_class === "number"
    ? monster.armor_class
    : Math.max(0, ...(monster.armor_class ?? []).map((entry) => entry.value ?? 0));
  const hitPoints = monster.hit_points ?? 0;
  const crScale = Math.max(1, (monster.challenge_rating ?? 1) * 8);
  const speedText = Object.entries(monster.speed ?? {}).map(([key, value]) => `${key} ${value ?? ""}`).join(" ").toLowerCase();

  if (ac >= 16 || hitPoints >= crScale * 2.4) roles.add("frontline");
  if (/spellcasting|innate spell|spell slots|cantrip|spell attack|restrained|stunned|paralyzed|frightened|grappled|blinded|incapacitated/.test(actionText)) roles.add("control");
  if (/regains?\s+(?:\d+\s+)?hit points|regain hit points|heals?|restores? hit points|ally|allies|friendly creature/.test(actionText)) roles.add("support");
  if (/multiattack|attack roll|melee weapon attack|ranged weapon attack|damage|breath weapon/.test(actionText)) roles.add("damage");
  if (/fly|teleport|disengage|bonus action|nimble|pounce|move up to/.test(`${actionText} ${speedText}`)
    || /(?:fly|climb|swim)\s+(?:40|50|60|70|80|90|100)\s*ft/.test(speedText)) roles.add("scouting");
  return [...roles];
}

function textValue(value?: string | string[]) {
  return Array.isArray(value) ? value.join(" ") : value ?? "";
}

export class MonsterApiError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message);
    this.name = "MonsterApiError";
  }
}

/** GET one of our JSON routes; a failed answer raises its `error` text (or `fallback`) with the status. */
async function getJson(path: string, fallback: string, signal?: AbortSignal): Promise<unknown> {
  const response = await fetch(path, { headers: { Accept: "application/json" }, signal });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new MonsterApiError(body?.error ?? fallback, response.status);
  }
  return response.json();
}

const isObject = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object";
const isListEntry = (entry: unknown): entry is MonsterListEntry => isObject(entry) && typeof entry.index === "string" && typeof entry.name === "string";
const isSourceSummary = (entry: unknown): entry is SourceSummary => isObject(entry) && typeof entry.key === "string" && typeof entry.name === "string";

type CatalogOptions = { challengeRating?: string; source?: string; search?: string; page?: number; limit?: number };

/** The query string parseMonsterSearch (open5e.ts) reads on the server; unset filters are left out. */
function catalogQuery(options: CatalogOptions): string {
  const params = new URLSearchParams();
  const entries: [string, string | number | undefined][] = [
    ["challenge_rating", options.challengeRating], ["source", options.source], ["search", options.search?.trim()],
    ["page", options.page], ["limit", options.limit],
  ];
  for (const [name, value] of entries) if (value) params.set(name, String(value));
  return params.size ? `?${params.toString()}` : "";
}

/** One page of the bestiary, filtered by challenge rating, book and name. */
export async function fetchMonsterCatalog(options: CatalogOptions = {}, signal?: AbortSignal): Promise<MonsterCatalog> {
  const payload = await getJson(`/api/monsters${catalogQuery(options)}`, "Could not load the bestiary.", signal);
  if (!isObject(payload) || !Array.isArray(payload.results)) throw new MonsterApiError("The monster index returned an unexpected response.");
  const results = payload.results.filter(isListEntry);
  const sources = Array.isArray(payload.sources) ? payload.sources.filter(isSourceSummary) : [];
  return { count: typeof payload.count === "number" ? payload.count : results.length, sources, results };
}

/** Fetches through our same-origin route so browsers do not depend on the provider's CORS policy. */
export async function fetchMonster(slug: string, signal?: AbortSignal): Promise<MonsterStatBlock> {
  const data = await getJson(`/api/monsters/${encodeURIComponent(slug)}`, "Could not load this creature.", signal);
  if (!isObject(data) || typeof data.name !== "string") throw new MonsterApiError("The creature API returned an unexpected response.");
  return data as MonsterStatBlock;
}

/** Short label for where a stat block comes from: the book's name. */
export function sourceLabel(source?: Pick<MonsterSource, "name"> | string) {
  return typeof source === "string" ? source : source?.name ?? "Open5e";
}

/** Compact monster entry served by /api/monsters/catalog; `source` is the book's name. */
export type CatalogMonster = { index: string; name: string; cr: number; xp: number; type: string; size: string; roles: MonsterRole[]; source: string; sourceKey: string };

const isCatalogMonster = (entry: unknown): entry is CatalogMonster =>
  isObject(entry) && typeof entry.index === "string" && typeof entry.xp === "number" && typeof entry.cr === "number";

export async function fetchSrdCatalog(signal?: AbortSignal): Promise<{ sources: SourceSummary[]; monsters: CatalogMonster[] }> {
  const payload = await getJson("/api/monsters/catalog", "Could not load the bestiary.", signal);
  if (!isObject(payload) || !Array.isArray(payload.monsters)) throw new MonsterApiError("The bestiary returned an unexpected response.");
  const sources = Array.isArray(payload.sources) ? (payload.sources as SourceSummary[]) : [];
  return { sources, monsters: payload.monsters.filter(isCatalogMonster) };
}

export function formatChallenge(cr?: number) {
  if (cr === undefined) return "—";
  return cr === 0.125 ? "1/8" : cr === 0.25 ? "1/4" : cr === 0.5 ? "1/2" : String(cr);
}

const creatureTypes: Record<string, { en: string; es: string }> = {
  aberration: { en: "Aberration", es: "Aberración" }, beast: { en: "Beast", es: "Bestia" }, celestial: { en: "Celestial", es: "Celestial" },
  construct: { en: "Construct", es: "Constructo" }, dragon: { en: "Dragon", es: "Dragón" }, elemental: { en: "Elemental", es: "Elemental" },
  fey: { en: "Fey", es: "Feérico" }, fiend: { en: "Fiend", es: "Infernal" }, giant: { en: "Giant", es: "Gigante" },
  humanoid: { en: "Humanoid", es: "Humanoide" }, monstrosity: { en: "Monstrosity", es: "Monstruosidad" }, ooze: { en: "Ooze", es: "Cieno" },
  plant: { en: "Plant", es: "Planta" }, undead: { en: "Undead", es: "Muerto viviente" }, swarm: { en: "Swarm", es: "Enjambre" },
};

/** Key for a creature with no type. Kept out of `creatureTypes` so no real type is filed under it by prefix. */
const OTHER_TYPE = "other";
const otherLabel = { en: "Other", es: "Otro" };

/** Files a type under the known type it starts with ("swarm of tiny beasts" → "swarm", "humanoid (goblinoid)" → "humanoid"). */
export function creatureTypeKey(type: string) {
  const lower = type.toLowerCase().trim();
  return Object.keys(creatureTypes).find((key) => lower.startsWith(key)) ?? (lower || OTHER_TYPE);
}

/** Known types and the no-type bucket in the reader's language; other types (Open5e text is English) capitalised. */
export function creatureTypeLabel(key: string, locale: "en" | "es") {
  const label = key === OTHER_TYPE ? otherLabel : creatureTypes[key];
  return label?.[locale] ?? key.charAt(0).toUpperCase() + key.slice(1);
}
