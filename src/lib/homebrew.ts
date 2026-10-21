/**
 * Homebrew monsters: input validation, XP by challenge rating and access rules.
 * Pure (no database), so route handlers and tests share the same rules.
 */
import { inferMonsterRoles, type MonsterAction, type MonsterRole, type MonsterStatBlock } from "./monster-api";
import type { AppUser } from "./permissions";

export const homebrewVisibilities = ["private", "campaign", "instance"] as const;
export type HomebrewVisibility = (typeof homebrewVisibilities)[number];

/** Homebrew monsters reach encounters and the stat block viewer through this slug prefix. */
export const HOMEBREW_SLUG_PREFIX = "homebrew:";
export const homebrewSlug = (id: string) => `${HOMEBREW_SLUG_PREFIX}${id}`;
export function parseHomebrewSlug(slug: string): string | null {
  return slug.startsWith(HOMEBREW_SLUG_PREFIX) ? slug.slice(HOMEBREW_SLUG_PREFIX.length) : null;
}

/** Experience points by challenge rating (SRD 5.1 / 5.2). */
const XP_BY_CR: Record<string, number> = {
  "0": 10, "0.125": 25, "0.25": 50, "0.5": 100, "1": 200, "2": 450, "3": 700, "4": 1100, "5": 1800, "6": 2300,
  "7": 2900, "8": 3900, "9": 5000, "10": 5900, "11": 7200, "12": 8400, "13": 10000, "14": 11500, "15": 13000,
  "16": 15000, "17": 18000, "18": 20000, "19": 22000, "20": 25000, "21": 33000, "22": 41000, "23": 50000,
  "24": 62000, "25": 75000, "26": 90000, "27": 105000, "28": 120000, "29": 135000, "30": 155000,
};
export const challengeRatings = Object.keys(XP_BY_CR).map(Number);
export const xpForChallengeRating = (cr: number): number | null => XP_BY_CR[String(cr)] ?? null;
/** Proficiency bonus by challenge rating: +2 up to CR 4, then +1 every four ratings. */
export const proficiencyBonusFor = (cr: number): number => (cr < 5 ? 2 : Math.floor((cr - 1) / 4) + 2);

export interface HomebrewInput {
  visibility: HomebrewVisibility;
  /** Campaigns the monster is shared with; only meaningful for `campaign` visibility. */
  campaignIds: string[];
  statBlock: MonsterStatBlock;
}

/** Fields derived from the stat block that the database keeps beside it for listings and encounters. */
export interface HomebrewSummary { name: string; cr: number; xp: number; type: string; roleTags: MonsterRole[] }

export type HomebrewParse = { ok: true; value: HomebrewInput; summary: HomebrewSummary } | { ok: false; error: string };

const MAX_STAT_BLOCK_CHARS = 40_000;
const MAX_ENTRIES = 30;
const SPEED_KEYS = ["walk", "fly", "swim", "climb", "burrow"] as const;
const SENSE_KEYS = ["blindsight", "darkvision", "tremorsense", "truesight", "passive_perception"] as const;
const ABILITY_FIELDS = ["strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma"] as const;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

class Invalid extends Error {}
const bad = (message: string): never => { throw new Invalid(message); };

function str(value: unknown, field: string, max: number, required = false): string {
  if (value === undefined || value === null || value === "") {
    if (required) bad(`${field} is required.`);
    return "";
  }
  if (typeof value !== "string") return bad(`${field} must be text.`);
  const trimmed = value.trim();
  if (required && !trimmed) bad(`${field} is required.`);
  if (trimmed.length > max) bad(`${field} is too long (max ${max}).`);
  return trimmed;
}

function int(value: unknown, field: string, min: number, max: number, required = false): number | undefined {
  if (value === undefined || value === null || value === "") {
    if (required) bad(`${field} is required.`);
    return undefined;
  }
  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) return bad(`${field} must be a whole number from ${min} to ${max}.`);
  return value;
}

function list<T>(value: unknown, field: string, max: number, each: (item: unknown, index: number) => T): T[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) return bad(`${field} must be a list.`);
  if (value.length > max) return bad(`${field} has too many entries (max ${max}).`);
  return value.map((item, index) => each(item, index));
}

function record(value: unknown, field: string): Record<string, unknown> {
  if (value === undefined || value === null) return {};
  if (typeof value !== "object" || Array.isArray(value)) return bad(`${field} must be an object.`);
  return value as Record<string, unknown>;
}

function action(item: unknown, field: string): MonsterAction {
  const value = record(item, field);
  const name = str(value.name, `${field} name`, 80, true);
  const desc = str(typeof value.desc === "string" ? value.desc : Array.isArray(value.desc) ? value.desc.join("\n") : value.desc, `${field} description`, 2000);
  const attackBonus = int(value.attack_bonus, `${field} attack bonus`, -10, 30);
  return { name, desc, ...(attackBonus === undefined ? {} : { attack_bonus: attackBonus }) };
}

function strings(value: unknown, field: string, max = 20, length = 60): string[] {
  return list(value, field, max, (item) => str(item, field, length, true));
}

function statBlockFrom(raw: unknown): MonsterStatBlock {
  const source = record(raw, "statBlock");
  const cr = source.challenge_rating;
  if (typeof cr !== "number" || xpForChallengeRating(cr) === null) bad("Challenge rating must be a standard rating (0, 1/8, 1/4, 1/2, 1 to 30).");
  const rating = cr as number;
  // Accepts a plain number (the editor) or the stored SRD shape, a list whose first entry holds the value.
  const armor = Array.isArray(source.armor_class) ? record(source.armor_class[0], "Armor class") : { value: source.armor_class, type: source.armor_type };
  const armorClass = int(armor.value, "Armor class", 0, 40, true) as number;
  const armorType = str(armor.type, "Armor type", 60);
  const hitPoints = int(source.hit_points, "Hit points", 1, 10_000, true) as number;

  const speedSource = record(source.speed, "Speed");
  const speed: Record<string, string> = {};
  for (const key of SPEED_KEYS) { const text = str(speedSource[key], `Speed ${key}`, 20); if (text) speed[key] = text; }

  const sensesSource = record(source.senses, "Senses");
  const senses: Record<string, string | number> = {};
  for (const key of SENSE_KEYS) {
    const sense = sensesSource[key];
    if (sense === undefined || sense === null || sense === "") continue;
    if (key === "passive_perception") senses[key] = int(sense, "Passive perception", 0, 60) as number;
    else senses[key] = str(sense, `Sense ${key}`, 20);
  }

  const abilities: Partial<Record<(typeof ABILITY_FIELDS)[number], number>> = {};
  for (const key of ABILITY_FIELDS) abilities[key] = int(source[key], `Ability ${key}`, 1, 30, true);

  const block: MonsterStatBlock = {
    name: str(source.name, "Name", 80, true),
    size: str(source.size, "Size", 20),
    type: str(source.type, "Type", 40),
    alignment: str(source.alignment, "Alignment", 60),
    armor_class: [{ ...(armorType ? { type: armorType } : {}), value: armorClass }],
    hit_points: hitPoints,
    hit_points_roll: str(source.hit_points_roll, "Hit dice", 40),
    speed,
    ...abilities,
    proficiencies: list(source.proficiencies, "Proficiencies", MAX_ENTRIES, (item, index) => {
      const entry = record(item, `Proficiency ${index + 1}`);
      return { proficiency: { name: str(record(entry.proficiency, "Proficiency").name, "Proficiency name", 60, true) }, value: int(entry.value, "Proficiency bonus", -10, 30, true) as number };
    }),
    damage_vulnerabilities: strings(source.damage_vulnerabilities, "Damage vulnerabilities"),
    damage_resistances: strings(source.damage_resistances, "Damage resistances"),
    damage_immunities: strings(source.damage_immunities, "Damage immunities"),
    condition_immunities: strings(Array.isArray(source.condition_immunities) ? source.condition_immunities.map((entry) => (entry && typeof entry === "object" ? (entry as { name?: unknown }).name : entry)) : undefined, "Condition immunities").map((name) => ({ name })),
    senses,
    languages: str(source.languages, "Languages", 200),
    challenge_rating: rating,
    proficiency_bonus: proficiencyBonusFor(rating),
    xp: xpForChallengeRating(rating) as number,
    special_abilities: list(source.special_abilities, "Traits", MAX_ENTRIES, (item, index) => action(item, `Trait ${index + 1}`)),
    actions: list(source.actions, "Actions", MAX_ENTRIES, (item, index) => action(item, `Action ${index + 1}`)),
    reactions: list(source.reactions, "Reactions", MAX_ENTRIES, (item, index) => action(item, `Reaction ${index + 1}`)),
    legendary_actions: list(source.legendary_actions, "Legendary actions", MAX_ENTRIES, (item, index) => action(item, `Legendary action ${index + 1}`)),
  };
  return block;
}

/** Validate a homebrew payload from the browser. Never throws; returns a readable error instead. */
export function parseHomebrewInput(body: unknown): HomebrewParse {
  try {
    const value = record(body, "Body");
    const visibility = value.visibility === undefined ? "private" : value.visibility;
    if (!homebrewVisibilities.includes(visibility as HomebrewVisibility)) bad("Visibility must be private, campaign or instance.");
    const rawIds = value.campaignIds === undefined ? [] : value.campaignIds;
    if (!Array.isArray(rawIds) || rawIds.length > 50 || !rawIds.every((id) => typeof id === "string" && UUID.test(id))) bad("campaignIds must be a list of campaign ids.");
    const campaignIds = visibility === "campaign" ? [...new Set(rawIds as string[])] : [];
    if (visibility === "campaign" && campaignIds.length === 0) bad("Pick at least one campaign to share with.");

    const statBlock = statBlockFrom(value.statBlock);
    if (JSON.stringify(statBlock).length > MAX_STAT_BLOCK_CHARS) bad("The stat block is too large.");
    const summary: HomebrewSummary = {
      name: statBlock.name,
      cr: statBlock.challenge_rating as number,
      xp: statBlock.xp as number,
      type: statBlock.type ?? "",
      roleTags: inferMonsterRoles(statBlock),
    };
    return { ok: true, value: { visibility: visibility as HomebrewVisibility, campaignIds, statBlock }, summary };
  } catch (error) {
    if (error instanceof Invalid) return { ok: false, error: error.message };
    throw error;
  }
}

type Actor = Pick<AppUser, "id" | "role" | "status">;
export interface HomebrewAccess { ownerId: string; visibility: HomebrewVisibility; locked: boolean; campaignIds: readonly string[] }

/**
 * Owners see their own monsters. Everyone approved sees `instance` ones, campaign members see the
 * ones shared with their campaign, and admins can open anything published or locked so they can moderate
 * it (and unlock it). An admin never sees someone else's other private work.
 */
export function canViewHomebrew(user: Actor, monster: HomebrewAccess, memberCampaignIds: ReadonlySet<string>): boolean {
  if (user.status !== "approved") return false;
  if (monster.ownerId === user.id) return true;
  if (user.role === "admin" && monster.locked) return true;
  if (monster.visibility === "private") return false;
  if (user.role === "admin" || monster.visibility === "instance") return true;
  return monster.campaignIds.some((id) => memberCampaignIds.has(id));
}

export const canEditHomebrew = (user: Actor, monster: Pick<HomebrewAccess, "ownerId">): boolean =>
  user.status === "approved" && monster.ownerId === user.id;

/** The owner or an admin may delete; admins use it to remove abusive published content. */
export const canDeleteHomebrew = (user: Actor, monster: Pick<HomebrewAccess, "ownerId" | "visibility">): boolean =>
  user.status === "approved" && (monster.ownerId === user.id || (user.role === "admin" && monster.visibility !== "private"));

/** Publishing (anything but private) is blocked while an admin has the monster locked. */
export const canPublishHomebrew = (monster: Pick<HomebrewAccess, "locked">, visibility: HomebrewVisibility): boolean =>
  visibility === "private" || !monster.locked;

export const canModerateHomebrew = (user: Actor): boolean => user.status === "approved" && user.role === "admin";

export const isHomebrewId = (value: unknown): value is string => typeof value === "string" && UUID.test(value);
