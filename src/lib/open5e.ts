/**
 * Maps creatures from the Open5e API (https://api.open5e.com/v2/creatures/) onto Grimoire's stat block shape.
 * Open5e only serves openly licensed content (SRD 5.1/5.2 under CC-BY-4.0, third-party books under the OGL),
 * and every creature carries the book it comes from, which the bestiary shows next to it.
 */
import type { MonsterAction, MonsterSource, MonsterStatBlock } from "./monster-api";

export const OPEN5E_ROOT = "https://api.open5e.com";

type Named = { name?: string; key?: string };
type Scores = Partial<Record<"strength" | "dexterity" | "constitution" | "intelligence" | "wisdom" | "charisma", number>>;

export interface Open5eAttack {
  to_hit_mod?: number | null;
  damage_die_count?: number | null;
  damage_die_type?: string | null;
  damage_bonus?: number | null;
  damage_type?: Named | null;
}

export interface Open5eAction {
  name?: string;
  desc?: string;
  action_type?: "ACTION" | "BONUS_ACTION" | "REACTION" | "LEGENDARY_ACTION" | "LAIR_ACTION" | string;
  order_in_statblock?: number | null;
  legendary_action_cost?: number | null;
  usage_limits?: { type?: string; param?: number } | null;
  attacks?: Open5eAttack[];
}

export interface Open5eDocument {
  key: string;
  name?: string;
  display_name?: string;
  publisher?: Named;
  gamesystem?: Named;
  permalink?: string;
  licenses?: Named[];
}

export interface Open5eCreature {
  key: string;
  name: string;
  document?: Open5eDocument;
  type?: Named;
  size?: Named;
  subcategory?: string | null;
  alignment?: string;
  challenge_rating?: number | string;
  proficiency_bonus?: number | null;
  experience_points?: number | null;
  speed?: Partial<Record<"walk" | "fly" | "swim" | "climb" | "burrow" | "crawl", number | null>> & { unit?: string; hover?: boolean };
  armor_class?: number;
  armor_detail?: string;
  hit_points?: number;
  hit_dice?: string;
  ability_scores?: Scores;
  modifiers?: Scores;
  saving_throws?: Scores;
  skill_bonuses?: Record<string, number>;
  passive_perception?: number;
  languages?: { as_string?: string };
  resistances_and_immunities?: {
    damage_immunities_display?: string;
    damage_resistances_display?: string;
    damage_vulnerabilities_display?: string;
    condition_immunities?: Named[];
  };
  darkvision_range?: number | null;
  blindsight_range?: number | null;
  tremorsense_range?: number | null;
  truesight_range?: number | null;
  actions?: Open5eAction[];
  traits?: Array<{ name?: string; desc?: string }>;
  illustration?: { file_url?: string } | null;
}

const ABILITIES = [["strength", "STR"], ["dexterity", "DEX"], ["constitution", "CON"], ["intelligence", "INT"], ["wisdom", "WIS"], ["charisma", "CHA"]] as const;

/** Open5e text uses Markdown emphasis; the stat block shows plain text. */
const plain = (text?: string) => (text ?? "")
  .replace(/\*\*([^*]+)\*\*/g, "$1")
  .replace(/\*([^*\n]+)\*/g, "$1")
  .replace(/(^|\s)_([^_]+)_(?=\s|$|[.,;:])/g, "$1$2")
  .trim();

const feet = (value?: number | null, unit = "feet") => (value ? `${Number.isInteger(value) ? value : Number(value.toFixed(1))} ${unit === "feet" ? "ft." : unit}` : undefined);

function limitSuffix(action: Open5eAction): string {
  const limit = action.usage_limits;
  const parts: string[] = [];
  if (limit?.type === "PER_DAY" && limit.param) parts.push(`${limit.param}/Day`);
  if (limit?.type === "RECHARGE_ON_ROLL" && limit.param) parts.push(limit.param >= 6 ? "Recharge 6" : `Recharge ${limit.param}–6`);
  if (limit?.type === "RECHARGE_AFTER_REST") parts.push("Recharges after a Short or Long Rest");
  if (limit?.type === "RECHARGE") parts.push("Recharge");
  if (action.legendary_action_cost && action.legendary_action_cost > 1) parts.push(`Costs ${action.legendary_action_cost} Actions`);
  return parts.length ? ` (${parts.join("; ")})` : "";
}

function toAction(action: Open5eAction): MonsterAction {
  const attack = action.attacks?.[0];
  const dice = attack?.damage_die_count && attack.damage_die_type ? `${attack.damage_die_count}${attack.damage_die_type.toLowerCase()}${attack.damage_bonus ? `${attack.damage_bonus > 0 ? "+" : ""}${attack.damage_bonus}` : ""}` : undefined;
  return {
    name: `${action.name ?? ""}${limitSuffix(action)}`,
    desc: plain(action.desc),
    ...(typeof attack?.to_hit_mod === "number" ? { attack_bonus: attack.to_hit_mod } : {}),
    ...(dice ? { damage: [{ damage_dice: dice, damage_type: { name: attack?.damage_type?.name } }] } : {}),
  };
}

const byOrder = (a: Open5eAction, b: Open5eAction) => (a.order_in_statblock ?? 0) - (b.order_in_statblock ?? 0);
const actionsOf = (creature: Open5eCreature, ...types: string[]) =>
  (creature.actions ?? []).filter((action) => types.includes(action.action_type ?? "ACTION")).sort(byOrder).map(toAction);

const splitList = (display?: string) => (display?.trim() ? [display.trim()] : []);

export function toSource(document?: Open5eDocument): MonsterSource | undefined {
  if (!document?.key) return undefined;
  return {
    key: document.key,
    name: document.display_name || document.name || document.key,
    ...(document.publisher?.name ? { publisher: document.publisher.name } : {}),
    ...(document.gamesystem?.key ? { system: document.gamesystem.key } : {}),
    ...(document.permalink ? { url: document.permalink } : {}),
    ...(document.licenses?.length ? { licenses: document.licenses.map((license) => license.key ?? license.name ?? "").filter(Boolean) } : {}),
  };
}

export const challengeOf = (creature: Pick<Open5eCreature, "challenge_rating">) => {
  const value = Number(creature.challenge_rating);
  return Number.isFinite(value) ? value : undefined;
};

/** Converts one Open5e creature into the stat block the monster sheet, bestiary and encounter builder use. */
export function toStatBlock(creature: Open5eCreature): MonsterStatBlock {
  const unit = creature.speed?.unit ?? "feet";
  const speed: Record<string, string | undefined> = {};
  for (const kind of ["walk", "burrow", "climb", "fly", "swim"] as const) {
    const value = feet(creature.speed?.[kind], unit);
    if (value) speed[kind] = value;
  }
  if (creature.speed?.hover && speed.fly) speed.fly = `${speed.fly} (hover)`;

  const scores = creature.ability_scores ?? {};
  const modifiers = creature.modifiers ?? {};
  // 2024 stat blocks list a save for every ability; only the ones above the plain modifier are proficiencies.
  const saves = ABILITIES
    .filter(([key]) => typeof creature.saving_throws?.[key] === "number" && creature.saving_throws[key] !== modifiers[key])
    .map(([key, short]) => ({ proficiency: { name: `Saving Throw: ${short}` }, value: creature.saving_throws![key] }));
  const skills = Object.entries(creature.skill_bonuses ?? {})
    .map(([skill, value]) => ({ proficiency: { name: `Skill: ${skill.split("_").map((word) => word[0].toUpperCase() + word.slice(1)).join(" ")}` }, value }));

  const senses: Record<string, string | number | undefined> = {
    blindsight: feet(creature.blindsight_range, unit),
    darkvision: feet(creature.darkvision_range, unit),
    tremorsense: feet(creature.tremorsense_range, unit),
    truesight: feet(creature.truesight_range, unit),
    passive_perception: creature.passive_perception,
  };
  const defenses = creature.resistances_and_immunities ?? {};
  const legendary = actionsOf(creature, "LEGENDARY_ACTION");
  const lair = actionsOf(creature, "LAIR_ACTION");
  const image = creature.illustration?.file_url;
  const type = [creature.type?.name?.toLowerCase(), creature.subcategory ? `(${creature.subcategory})` : ""].filter(Boolean).join(" ");

  return {
    index: creature.key,
    name: creature.name,
    size: creature.size?.name,
    type,
    alignment: creature.alignment,
    armor_class: [{ type: "armor", value: creature.armor_class, ...(creature.armor_detail ? { desc: creature.armor_detail } : {}) }],
    hit_points: creature.hit_points,
    hit_points_roll: creature.hit_dice,
    speed,
    strength: scores.strength,
    dexterity: scores.dexterity,
    constitution: scores.constitution,
    intelligence: scores.intelligence,
    wisdom: scores.wisdom,
    charisma: scores.charisma,
    proficiencies: [...saves, ...skills],
    damage_vulnerabilities: splitList(defenses.damage_vulnerabilities_display),
    damage_resistances: splitList(defenses.damage_resistances_display),
    damage_immunities: splitList(defenses.damage_immunities_display),
    condition_immunities: (defenses.condition_immunities ?? []).map((condition) => ({ name: condition.name?.toLowerCase() })),
    senses: Object.fromEntries(Object.entries(senses).filter(([, value]) => value !== undefined && value !== null)),
    languages: creature.languages?.as_string || "—",
    challenge_rating: challengeOf(creature),
    ...(creature.proficiency_bonus != null ? { proficiency_bonus: creature.proficiency_bonus } : {}),
    ...(typeof creature.experience_points === "number" ? { xp: creature.experience_points } : {}),
    special_abilities: (creature.traits ?? []).map((trait) => ({ name: trait.name, desc: plain(trait.desc) })),
    actions: actionsOf(creature, "ACTION"),
    bonus_actions: actionsOf(creature, "BONUS_ACTION"),
    reactions: actionsOf(creature, "REACTION"),
    legendary_actions: [...legendary, ...lair],
    ...(image ? { image: image.startsWith("http") ? image : `${OPEN5E_ROOT}${image}` } : {}),
    source: toSource(creature.document),
  };
}

/**
 * Books that republish another one: when a creature with the same name is in both, only the newer copy is listed.
 * Keys are the newer document, values the older ones it replaces.
 */
export const SUPERSEDES: Record<string, string[]> = { "srd-2024": ["srd-2014"], "tob-2023": ["tob"] };

/** Drops entries whose name also appears in a book that supersedes theirs. */
export function withoutSupersededCopies<T extends { name: string; source?: { key: string } }>(entries: T[]): T[] {
  const namesBySource = new Map<string, Set<string>>();
  for (const entry of entries) {
    const key = entry.source?.key ?? "";
    if (!namesBySource.has(key)) namesBySource.set(key, new Set());
    namesBySource.get(key)!.add(entry.name.toLowerCase());
  }
  const replacedBy = Object.entries(SUPERSEDES).flatMap(([newer, older]) => older.map((old) => [old, newer] as const));
  return entries.filter((entry) => {
    const newer = replacedBy.filter(([old]) => old === entry.source?.key).map(([, key]) => key);
    return !newer.some((key) => namesBySource.get(key)?.has(entry.name.toLowerCase()));
  });
}

/** Old saved encounters store dnd5eapi slugs ("goblin"); Open5e keys carry the book ("srd-2024_goblin"). */
export function legacySlugCandidates(slug: string): string[] {
  return slug.includes("_") ? [slug] : [`srd-2024_${slug}`, `srd_${slug}`];
}
