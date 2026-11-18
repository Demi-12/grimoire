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

/** One page of the bestiary, filtered by challenge rating, book and name. */
export async function fetchMonsterCatalog(
  options: { challengeRating?: string; source?: string; search?: string; page?: number; limit?: number } = {},
  signal?: AbortSignal,
): Promise<MonsterCatalog> {
  const params = new URLSearchParams();
  if (options.challengeRating) params.set("challenge_rating", options.challengeRating);
  if (options.source) params.set("source", options.source);
  if (options.search?.trim()) params.set("search", options.search.trim());
  if (options.page) params.set("page", String(options.page));
  if (options.limit) params.set("limit", String(options.limit));
  const query = params.size ? `?${params.toString()}` : "";
  const response = await fetch(`/api/monsters${query}`, {
    headers: { Accept: "application/json" },
    signal,
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new MonsterApiError(body?.error ?? "Could not load the bestiary.", response.status);
  }

  const payload: unknown = await response.json();
  if (!payload || typeof payload !== "object") throw new MonsterApiError("The monster index returned an unexpected response.");
  const catalog = payload as { count?: unknown; sources?: unknown; results?: unknown };
  if (!Array.isArray(catalog.results)) throw new MonsterApiError("The monster index returned an unexpected response.");
  const results = catalog.results.filter((entry): entry is MonsterListEntry =>
    !!entry && typeof entry === "object"
    && typeof (entry as MonsterListEntry).index === "string"
    && typeof (entry as MonsterListEntry).name === "string",
  );
  const sources = Array.isArray(catalog.sources) ? catalog.sources.filter((entry): entry is SourceSummary =>
    !!entry && typeof entry === "object" && typeof (entry as SourceSummary).key === "string" && typeof (entry as SourceSummary).name === "string") : [];
  return { count: typeof catalog.count === "number" ? catalog.count : results.length, sources, results };
}

/** Fetches through our same-origin route so browsers do not depend on the provider's CORS policy. */
export async function fetchMonster(slug: string, signal?: AbortSignal): Promise<MonsterStatBlock> {
  const response = await fetch(`/api/monsters/${encodeURIComponent(slug)}`, {
    headers: { Accept: "application/json" },
    signal,
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new MonsterApiError(body?.error ?? "Could not load this creature.", response.status);
  }

  const data: unknown = await response.json();
  if (!data || typeof data !== "object" || typeof (data as { name?: unknown }).name !== "string") {
    throw new MonsterApiError("The creature API returned an unexpected response.");
  }
  return data as MonsterStatBlock;
}

/** Short label for where a stat block comes from: the book's name. */
export function sourceLabel(source?: Pick<MonsterSource, "name"> | string) {
  return typeof source === "string" ? source : source?.name ?? "Open5e";
}

/** Compact monster entry served by /api/monsters/catalog; `source` is the book's name. */
export type CatalogMonster = { index: string; name: string; cr: number; xp: number; type: string; size: string; roles: MonsterRole[]; source: string; sourceKey: string };

export async function fetchSrdCatalog(signal?: AbortSignal): Promise<{ sources: SourceSummary[]; monsters: CatalogMonster[] }> {
  const response = await fetch("/api/monsters/catalog", { headers: { Accept: "application/json" }, signal });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new MonsterApiError(body?.error ?? "Could not load the bestiary.", response.status);
  }
  const payload = (await response.json()) as { sources?: unknown; monsters?: unknown };
  if (!Array.isArray(payload.monsters)) throw new MonsterApiError("The bestiary returned an unexpected response.");
  const monsters = payload.monsters.filter((entry): entry is CatalogMonster => !!entry && typeof entry === "object"
    && typeof (entry as CatalogMonster).index === "string" && typeof (entry as CatalogMonster).xp === "number" && typeof (entry as CatalogMonster).cr === "number");
  const sources = Array.isArray(payload.sources) ? (payload.sources as SourceSummary[]) : [];
  return { sources, monsters };
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

/** Groups "swarm of tiny beasts" and similar variants under one filter key. */
export function creatureTypeKey(type: string) {
  const lower = type.toLowerCase().trim();
  if (lower.startsWith("swarm")) return "swarm";
  return Object.keys(creatureTypes).find((key) => lower.startsWith(key)) ?? (lower || "other");
}

export function creatureTypeLabel(key: string, locale: "en" | "es") {
  return creatureTypes[key]?.[locale] ?? key.charAt(0).toUpperCase() + key.slice(1);
}
