/** D&D 5e SRD monster API adapter (2024 preferred, 2014 fallback). No API key or client secret is used. */
export type MonsterEdition = "2024" | "2014";

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
  legendary_actions?: MonsterAction[];
  image?: string;
  /** Ruleset the stat block came from, added by our API route. */
  edition?: MonsterEdition;
  /** Set instead of `edition` when the stat block is a homebrew monster. */
  homebrew?: { ownerName: string };
};

export type MonsterListEntry = { index: string; name: string; url?: string };
export type MonsterCatalog = { count: number; edition?: MonsterEdition; results: MonsterListEntry[] };

/** Tactical tags inferred from SRD stat block data; the upstream API does not provide these labels. */
export type MonsterRole = "frontline" | "damage" | "support" | "control" | "scouting";

export function inferMonsterRoles(monster: MonsterStatBlock): MonsterRole[] {
  const roles = new Set<MonsterRole>();
  const actions = [...(monster.special_abilities ?? []), ...(monster.actions ?? []), ...(monster.reactions ?? [])];
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

/** Retrieves the API's compact monster index, optionally filtered by challenge rating upstream. */
export async function fetchMonsterCatalog(
  options: { challengeRating?: string; search?: string; page?: number; limit?: number } = {},
  signal?: AbortSignal,
): Promise<MonsterCatalog> {
  const params = new URLSearchParams();
  if (options.challengeRating) params.set("challenge_rating", options.challengeRating);
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
  const catalog = payload as { count?: unknown; edition?: unknown; results?: unknown };
  if (!Array.isArray(catalog.results)) throw new MonsterApiError("The monster index returned an unexpected response.");
  const results = catalog.results.filter((entry): entry is MonsterListEntry =>
    !!entry && typeof entry === "object"
    && typeof (entry as MonsterListEntry).index === "string"
    && typeof (entry as MonsterListEntry).name === "string",
  );
  const edition = catalog.edition === "2024" || catalog.edition === "2014" ? catalog.edition : undefined;
  return { count: typeof catalog.count === "number" ? catalog.count : results.length, edition, results };
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

/** Human-readable SRD label for an edition. */
export function srdLabel(edition?: MonsterEdition) {
  return edition === "2014" ? "SRD 5.1 · 2014" : "SRD 5.2 · 2024";
}

/** Compact SRD monster entry served by /api/monsters/catalog. */
export type SrdMonster = { index: string; name: string; cr: number; xp: number; type: string; size: string; roles: MonsterRole[] };

export async function fetchSrdCatalog(signal?: AbortSignal): Promise<{ edition?: MonsterEdition; monsters: SrdMonster[] }> {
  const response = await fetch("/api/monsters/catalog", { headers: { Accept: "application/json" }, signal });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new MonsterApiError(body?.error ?? "Could not load the bestiary.", response.status);
  }
  const payload = (await response.json()) as { edition?: unknown; monsters?: unknown };
  if (!Array.isArray(payload.monsters)) throw new MonsterApiError("The bestiary returned an unexpected response.");
  const monsters = payload.monsters.filter((entry): entry is SrdMonster => !!entry && typeof entry === "object"
    && typeof (entry as SrdMonster).index === "string" && typeof (entry as SrdMonster).xp === "number" && typeof (entry as SrdMonster).cr === "number");
  const edition = payload.edition === "2024" || payload.edition === "2014" ? payload.edition : undefined;
  return { edition, monsters };
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
