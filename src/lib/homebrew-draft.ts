/**
 * Form state for the homebrew editor and its conversions. Kept apart from the component so the
 * mapping between text inputs, the API payload and a stored stat block can be unit tested.
 */
import { proficiencyBonusFor, xpForChallengeRating, type HomebrewVisibility } from "./homebrew";
import type { MonsterAction, MonsterStatBlock } from "./monster-api";

export const speedKinds = ["walk", "fly", "swim", "climb", "burrow"] as const;
export const senseKinds = ["darkvision", "blindsight", "tremorsense", "truesight"] as const;
export const abilityFields = ["strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma"] as const;
export const entryKinds = ["traits", "actions", "reactions", "legendary"] as const;
export const sizes = ["Tiny", "Small", "Medium", "Large", "Huge", "Gargantuan"] as const;

export interface EntryDraft { name: string; desc: string }

export interface HomebrewDraft {
  name: string; size: string; type: string; alignment: string;
  armorClass: string; armorType: string; hitPoints: string; hitDice: string;
  speed: Record<(typeof speedKinds)[number], string>;
  abilities: Record<(typeof abilityFields)[number], string>;
  senses: Record<(typeof senseKinds)[number], string>;
  passivePerception: string; languages: string;
  /** Comma-separated lists. */
  vulnerabilities: string; resistances: string; immunities: string; conditionImmunities: string;
  cr: string;
  traits: EntryDraft[]; actions: EntryDraft[]; reactions: EntryDraft[]; legendary: EntryDraft[];
  visibility: HomebrewVisibility; campaignIds: string[];
}

const blankRecord = <K extends string>(keys: readonly K[], value = ""): Record<K, string> =>
  Object.fromEntries(keys.map((key) => [key, value])) as Record<K, string>;

export function emptyDraft(): HomebrewDraft {
  return {
    name: "", size: "Medium", type: "", alignment: "", armorClass: "12", armorType: "", hitPoints: "20", hitDice: "",
    speed: { ...blankRecord(speedKinds), walk: "30 ft." },
    abilities: blankRecord(abilityFields, "10"),
    senses: blankRecord(senseKinds), passivePerception: "10", languages: "",
    vulnerabilities: "", resistances: "", immunities: "", conditionImmunities: "",
    cr: "1",
    traits: [], actions: [{ name: "", desc: "" }], reactions: [], legendary: [],
    visibility: "private", campaignIds: [],
  };
}

const entriesToDraft = (items: MonsterAction[] | undefined): EntryDraft[] =>
  (items ?? []).map((item) => ({ name: item.name ?? "", desc: Array.isArray(item.desc) ? item.desc.join("\n") : item.desc ?? "" }));

/** Fill the form from a stored monster (edit) or leave defaults for anything it does not have. */
export function draftFromMonster(monster: { statBlock: MonsterStatBlock; visibility: HomebrewVisibility; campaignIds: string[] }): HomebrewDraft {
  const block = monster.statBlock;
  const draft = emptyDraft();
  const armor = Array.isArray(block.armor_class) ? block.armor_class[0] : { value: block.armor_class };
  const text = (value: unknown) => (value === undefined || value === null ? "" : String(value));
  for (const key of speedKinds) draft.speed[key] = text(block.speed?.[key]);
  for (const key of senseKinds) draft.senses[key] = text(block.senses?.[key]);
  for (const key of abilityFields) draft.abilities[key] = text(block[key]);
  return {
    ...draft,
    name: block.name, size: block.size || draft.size, type: block.type ?? "", alignment: block.alignment ?? "",
    armorClass: text(armor?.value), armorType: armor && "type" in armor ? text(armor.type) : "",
    hitPoints: text(block.hit_points), hitDice: block.hit_points_roll ?? block.hit_dice ?? "",
    passivePerception: text(block.senses?.passive_perception), languages: block.languages ?? "",
    vulnerabilities: (block.damage_vulnerabilities ?? []).join(", "),
    resistances: (block.damage_resistances ?? []).join(", "),
    immunities: (block.damage_immunities ?? []).join(", "),
    conditionImmunities: (block.condition_immunities ?? []).map((item) => item.name ?? "").filter(Boolean).join(", "),
    cr: text(block.challenge_rating),
    traits: entriesToDraft(block.special_abilities), actions: entriesToDraft(block.actions),
    reactions: entriesToDraft(block.reactions), legendary: entriesToDraft(block.legendary_actions),
    visibility: monster.visibility, campaignIds: [...monster.campaignIds],
  };
}

const splitList = (value: string) => value.split(/[,;]/).map((item) => item.trim()).filter(Boolean);
const numberOrUndefined = (value: string) => (value.trim() === "" ? undefined : Number(value));
const keepEntries = (items: EntryDraft[]) => items.filter((item) => item.name.trim() || item.desc.trim());

/** The body for POST/PUT /api/homebrew. Blank numeric inputs are left out so the server reports them as missing. */
export function draftToPayload(draft: HomebrewDraft) {
  const speed = Object.fromEntries(speedKinds.map((key) => [key, draft.speed[key].trim()]).filter(([, value]) => value));
  const senses: Record<string, string | number> = Object.fromEntries(senseKinds.map((key) => [key, draft.senses[key].trim()]).filter(([, value]) => value));
  const passive = numberOrUndefined(draft.passivePerception);
  if (passive !== undefined) senses.passive_perception = passive;
  return {
    visibility: draft.visibility,
    campaignIds: draft.visibility === "campaign" ? draft.campaignIds : [],
    statBlock: {
      name: draft.name, size: draft.size, type: draft.type, alignment: draft.alignment,
      armor_class: numberOrUndefined(draft.armorClass), armor_type: draft.armorType,
      hit_points: numberOrUndefined(draft.hitPoints), hit_points_roll: draft.hitDice,
      speed, senses, languages: draft.languages,
      ...Object.fromEntries(abilityFields.map((key) => [key, numberOrUndefined(draft.abilities[key])])),
      damage_vulnerabilities: splitList(draft.vulnerabilities), damage_resistances: splitList(draft.resistances),
      damage_immunities: splitList(draft.immunities), condition_immunities: splitList(draft.conditionImmunities),
      challenge_rating: numberOrUndefined(draft.cr),
      special_abilities: keepEntries(draft.traits), actions: keepEntries(draft.actions),
      reactions: keepEntries(draft.reactions), legendary_actions: keepEntries(draft.legendary),
    },
  };
}

/** A stat block good enough to preview in the sheet while typing; invalid numbers just show as blanks. */
export function draftToPreview(draft: HomebrewDraft): MonsterStatBlock {
  const payload = draftToPayload(draft).statBlock;
  const cr = payload.challenge_rating;
  const rating = cr !== undefined && xpForChallengeRating(cr) !== null ? cr : undefined;
  const finite = (value: number | undefined) => (value !== undefined && Number.isFinite(value) ? value : undefined);
  return {
    name: draft.name.trim() || "—",
    size: payload.size, type: payload.type, alignment: payload.alignment,
    armor_class: finite(payload.armor_class) === undefined ? undefined : [{ ...(draft.armorType.trim() ? { type: draft.armorType.trim() } : {}), value: payload.armor_class as number }],
    hit_points: finite(payload.hit_points), hit_points_roll: payload.hit_points_roll || undefined,
    speed: payload.speed as Record<string, string>,
    ...Object.fromEntries(abilityFields.map((key) => [key, finite(numberOrUndefined(draft.abilities[key]))])),
    damage_vulnerabilities: payload.damage_vulnerabilities, damage_resistances: payload.damage_resistances,
    damage_immunities: payload.damage_immunities, condition_immunities: payload.condition_immunities.map((name) => ({ name })),
    senses: payload.senses, languages: payload.languages || undefined,
    challenge_rating: rating, xp: rating === undefined ? undefined : (xpForChallengeRating(rating) as number),
    proficiency_bonus: rating === undefined ? undefined : proficiencyBonusFor(rating),
    special_abilities: payload.special_abilities, actions: payload.actions, reactions: payload.reactions, legendary_actions: payload.legendary_actions,
  };
}

/** Next empty row for a list, capped like the server (30 entries). */
export const MAX_ENTRIES = 30;
