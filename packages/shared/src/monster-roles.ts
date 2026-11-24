/**
 * Tactical roles guessed from a monster's stat block (Open5e does not label them): frontline, support, control
 * and scouting. Each role is one small rule below, measured against the whole Open5e catalog so that a tag
 * means something (about 1.5 roles per creature instead of 3.2). Monsters never get `damage`: every monster
 * deals damage, so the tag told nothing; parties still use it (`PartyRoleProfile` in rules.ts).
 *
 * Reads only the stat block (traits, actions, bonus actions, reactions and legendary actions, speed, senses,
 * skills, size, HP, AC and CR). Pure: the catalog, the bestiary, homebrew and the encounter builder share it.
 * Not here: the stat block types (monster-api.ts) and the mapping from Open5e (open5e.ts).
 */
import type { MonsterAction, MonsterRole, MonsterStatBlock } from "./monster-api.js";

/** Roles a monster can get: every role but `damage`. */
export type InferredMonsterRole = Exclude<MonsterRole, "damage">;
const ROLE_ORDER: InferredMonsterRole[] = ["frontline", "support", "control", "scouting"];

/**
 * Median hit points and AC per challenge rating: [HP, AC]. Measured on 2026-11-24 over the 2,922 creatures with
 * a CR that the bestiary lists from the Open5e v2 API (every book, copies replaced by a newer edition removed).
 */
const MEDIAN_HP_AC_BY_CR: Record<number, readonly [number, number]> = {
  0: [4, 11], 0.125: [9, 12], 0.25: [14, 13], 0.5: [22, 13], 1: [34, 13], 2: [47, 13], 3: [66, 14], 4: [79, 14], 5: [97, 15],
  6: [112, 15], 7: [123, 15], 8: [130, 16], 9: [149, 16], 10: [153, 17], 11: [172, 17], 12: [178, 17], 13: [189, 17], 14: [194, 18],
  15: [212, 18], 16: [242, 19], 17: [253, 19], 18: [270, 19], 19: [275, 19], 20: [328, 19], 21: [315, 20], 22: [407, 20], 23: [468, 21],
  24: [422, 21], 25: [444, 21], 26: [526, 22], 27: [526, 22], 28: [580, 23], 29: [630, 24], 30: [688, 25],
};
const RATINGS = Object.keys(MEDIAN_HP_AC_BY_CR).map(Number);

/** Proficiency bonus by challenge rating: +2 up to CR 4, then +1 every four ratings. */
export const proficiencyBonusFor = (cr: number): number => (cr < 5 ? 2 : Math.floor((cr - 1) / 4) + 2);

/** The median creature of the nearest listed rating. */
function medianFor(cr: number): { hp: number; ac: number } {
  const nearest = RATINGS.reduce((best, rating) => (Math.abs(rating - cr) < Math.abs(best - cr) ? rating : best), RATINGS[0]);
  const [hp, ac] = MEDIAN_HP_AC_BY_CR[nearest];
  return { hp, ac };
}

/** What the rules read, worked out once per stat block. */
interface RoleFacts {
  monster: MonsterStatBlock;
  /** A missing rating counts as CR 1. */
  cr: number;
  hp: number;
  ac: number;
  features: MonsterAction[];
  /** Names and text of every feature, lower case. */
  text: string;
  sentences: Sentence[];
}
type Sentence = { feature: string; text: string };

const textOf = (value?: string | string[]) => (Array.isArray(value) ? value.join(" ") : value ?? "");
const feetOf = (value: unknown) => { const feet = parseInt(String(value ?? ""), 10); return Number.isFinite(feet) ? feet : 0; };
const armorOf = (monster: MonsterStatBlock) => typeof monster.armor_class === "number"
  ? monster.armor_class
  : Math.max(0, ...(monster.armor_class ?? []).map((entry) => entry.value ?? 0));

function factsOf(monster: MonsterStatBlock): RoleFacts {
  const features = [...(monster.special_abilities ?? []), ...(monster.actions ?? []), ...(monster.bonus_actions ?? []), ...(monster.reactions ?? []), ...(monster.legendary_actions ?? [])];
  return {
    monster, cr: monster.challenge_rating ?? 1, hp: monster.hit_points ?? 0, ac: armorOf(monster), features,
    text: features.map((feature) => `${feature.name ?? ""} ${textOf(feature.desc)}`).join(" ").toLowerCase(),
    sentences: features.flatMap((feature) => textOf(feature.desc).split(/(?<=[.!?])\s+|\n+/)
      .map((text) => ({ feature: (feature.name ?? "").toLowerCase(), text: text.toLowerCase() }))),
  };
}

// ---------- frontline ----------

const isLargeOrBigger = (monster: MonsterStatBlock) => /^(large|huge|gargantuan|titanic)/i.test(monster.size ?? "");
const hasMeleeAttack = (text: string) => /\bmelee\b/.test(text) || /\breach \d+ ?f(?:ee)?t/.test(text);
const regenerates = (monster: MonsterStatBlock) => (monster.special_abilities ?? []).some((trait) => /^regenerat/i.test(trait.name ?? ""));

/** Hits it takes to drop, next to the median creature of its CR: each AC point is ~8% more attacks that miss. */
const durability = ({ hp, ac, cr }: RoleFacts) => { const median = medianFor(cr); return (hp / median.hp) * Math.pow(1.08, ac - median.ac); };

/** Tougher than a typical creature of its CR, an armoured soldier, a big melee brute, a regenerator or a big legend. */
function isFrontline(facts: RoleFacts): boolean {
  const { monster, hp, ac } = facts;
  const median = medianFor(facts.cr);
  const big = isLargeOrBigger(monster);
  return durability(facts) >= 1.2
    || (ac >= median.ac + 3 && hp >= 0.7 * median.hp)
    || (big && hasMeleeAttack(facts.text) && hp >= median.hp)
    || (regenerates(monster) && hp >= 0.8 * median.hp)
    // A big legendary creature is built to stand alone against the whole party.
    || (big && (monster.legendary_actions ?? []).length > 0 && hp >= 0.8 * median.hp);
}

// ---------- support ----------

/** Spells that heal or strengthen others, as Spellcasting lists them. */
const SUPPORT_SPELLS = /\b(cure wounds|healing word|mass healing word|mass cure wounds|heal|mass heal|aid|bless|heroism|beacon of hope|haste|shield of faith|sanctuary|warding bond|aura of vitality|aura of life|healing spirit)\b/;
/** Features where allies only help the creature itself. */
const SELF_BENEFIT_FEATURES = /pack tactics|sneak attack|martial advantage|surprise attack/;
/** "An ally within 5 feet of the target": the creature profits from its allies, it doesn't help them. */
const SELF_BENEFIT = /\b(?:allies|ally)\b[^.]*\bwithin 5 (?:feet|ft)\b[^.]*\b(?:of the target|of the creature|of it|of that creature|isn't incapacitated|doesn't have the incapacitated)|\bif at least one of (?:its|the [a-z' -]+'s) allies\b/;
/** Summoned creatures fight for it, which doesn't make it a supporter. */
const SUMMONS = /\bact(?:s|ing)? as (?:an )?all(?:y|ies) of\b|\barrives? in \d|\bsummons?\b/;
/** "Can't regain", "if … regains hit points": healing mentioned, not given. */
const NOT_GIVEN = /\b(?:can['’]t|cannot|can not|doesn['’]t|don['’]t|no longer|unable to)\s+(?:regain|heal)|\beven if\b|\b(?:if|when|whenever)\b[^.]*\bregains?\b[^.]*\b(?:hp|hit points)\b|\bonly half the benefit/;
const FOR_OTHERS = /\bcreatures? of its choice\b|\ballies\b|\bally\b|\ballied\b|\bfriendly\b|\banother creature\b|\bwilling\b/;
const OTHERS_HEAL = /\b(?:creature|ally|allies|target|another|willing)s?\b[^.]*\b(?:regains?|gains?)\b[^.]*\b(?:hit points|temporary hit points|hp)\b/;
const ALLIES = /\b(?:ally|allies|allied|friendly creatures?|nonhostile creatures?|its companions)\b/;
const HELPS = /\b(regains?|heal(?:s|ed)?|restores?|temporary hit points|advantage on|bonus to|bonus on|add (?:a |an |its |the )?(?:\d*d\d+|bonus)|adds? \d*d\d+|can't be (?:frightened|charmed)|immune to|resistance to|extra damage|can use (?:its|their|it) reaction|uses? (?:its|their) reaction|can make (?:one|an?) (?:melee |weapon )?attack|bonus to (?:its )?ac|adds? \d+ to (?:its|the target's) ac|disadvantage on the attack|reroll|re-roll|inspir|bolster|rally|empower)/;

/** "It regains…" or "the troll regains…", unless the sentence also lets another creature benefit. */
function healsOnlyItself(text: string, selfHeal: RegExp): boolean {
  return selfHeal.test(text) && !FOR_OTHERS.test(text) && !(/\b(?:one|a|another|each|any|target) creature\b/.test(text) && !/\bdamage\b/.test(text));
}

/** Help aimed at others: support spells, healing someone else, or a benefit for its allies. */
function supportsOthers({ monster, sentences }: RoleFacts): boolean {
  const names = (monster.name ?? "").toLowerCase().split(/[^a-z]+/).filter((word) => word.length > 2);
  const selfHeal = new RegExp(`\\b(?:it|itself|(?:the )?(?:${names.join("|") || "x"}))\\b[^.]*?\\b(?:regains?|gains?)\\b`);
  return sentences.some(({ feature, text }) => {
    if (SELF_BENEFIT_FEATURES.test(feature) || SELF_BENEFIT.test(text) || SUMMONS.test(text)) return false;
    if ((/spellcasting|innate/.test(feature) || /\bcasts?\b/.test(text)) && SUPPORT_SPELLS.test(text)) return true;
    if (NOT_GIVEN.test(text) || healsOnlyItself(text, selfHeal)) return false;
    return OTHERS_HEAL.test(text) || (ALLIES.test(text) && HELPS.test(text));
  });
}

// ---------- control ----------

const CONTROL = /spellcasting|innate spell|spell slots|cantrip|spell attack|restrained|stunned|paralyzed|frightened|grappled|blinded|incapacitated/;
/** Features that name a condition only to say the creature resists it or profits from it. */
const MENTION_FEATURES = /pack tactics|martial advantage|sneak attack|magic resistance|brave|fearless|mind ward/;

/** The sentence without the parts that only mention a condition: immunities, "can't be", saves against it. */
const withoutMentions = (text: string) => text
  .replace(/\b(?:doesn['’]t have|isn['’]t|is not|without) the [a-z, ]+ conditions?/g, "")
  .replace(/\b(?:isn['’]t|is not|not) incapacitated\b/g, "")
  .replace(/\b(?:can['’]t|cannot) be [a-z, ]+/g, "")
  .replace(/\b(?:immune|immunity) to [a-z, ]+/g, "")
  .replace(/\b(?:advantage|disadvantage) on [a-z ]*saving throws? (?:against|to avoid|made to avoid) (?:being )?[a-z, ]+/g, "")
  .replace(/\bwhile (?:it is|it's|the [a-z' -]+ is) [a-z]+/g, "");

/** It casts spells or imposes conditions on others. */
const controls = ({ sentences }: RoleFacts) =>
  sentences.some(({ feature, text }) => !MENTION_FEATURES.test(feature) && CONTROL.test(`${feature} ${withoutMentions(text)}`));

// ---------- scouting ----------

const skillBonus = (monster: MonsterStatBlock, skill: string) =>
  (monster.proficiencies ?? []).find((entry) => (entry.proficiency?.name ?? "").toLowerCase() === `skill: ${skill}`)?.value;
const feetIn = (record: Record<string, unknown> | undefined, key: string) => feetOf(record?.[key]);

/** Flies 60 ft., climbs 40 ft. or burrows 30 ft.: slower fliers, fast walkers and swimmers don't count. */
const movesFastOrOddly = ({ monster }: RoleFacts) =>
  feetIn(monster.speed, "fly") >= 60 || feetIn(monster.speed, "climb") >= 40 || feetIn(monster.speed, "burrow") >= 30;
/** An expert in Stealth (proficiency bonus + 4), or it turns invisible, hides or blends in. */
function hides({ monster, cr, text }: RoleFacts): boolean {
  const stealth = skillBonus(monster, "stealth");
  return (stealth !== undefined && stealth >= proficiencyBonusFor(cr) + 4) || /\binvisib|\bhide action|\btakes the hide|\bcamouflage/.test(text);
}
const slipsAway = ({ text }: RoleFacts) => /\bteleports?\b|\bmisty step\b|\bdimension door\b|\bincorporeal movement\b|\bdisengage\b/.test(text);
/** Sees what others can't: truesight, or tremorsense of 60 ft. (darkvision and blindsight are too common). */
const seesTheUnseen = ({ monster }: RoleFacts) => feetIn(monster.senses, "truesight") > 0 || feetIn(monster.senses, "tremorsense") >= 60;

/** It tests the party's own scouting: it moves fast or oddly, hides, slips away or sees what others can't. */
const scouts = (facts: RoleFacts) => movesFastOrOddly(facts) || hides(facts) || slipsAway(facts) || seesTheUnseen(facts);

const RULES: Record<InferredMonsterRole, (facts: RoleFacts) => boolean> = {
  frontline: isFrontline, support: supportsOthers, control: controls, scouting: scouts,
};

/** The tactical roles of a stat block, in a fixed order; never `damage`. */
export function inferMonsterRoles(monster: MonsterStatBlock): InferredMonsterRole[] {
  const facts = factsOf(monster);
  return ROLE_ORDER.filter((role) => RULES[role](facts));
}

// ---------- tags already saved ----------

/**
 * The role tags to show for a saved creature (the `creature` table, which copies them when a creature is added).
 * A custom creature, without `monsterSlug`, keeps what its owner gave it. One from the bestiary or homebrew takes
 * the roles its stat block has today (`fresh`), so tags saved under older rules don't stick; when that stat block
 * can't be read (catalog not loaded yet, homebrew deleted or no longer shared), it keeps its stored tags but
 * `damage`, which monsters no longer get. The stored tags are never changed, so nothing is lost.
 */
export function currentRoleTags(creature: { monsterSlug: string | null; roleTags: readonly string[] }, fresh: readonly InferredMonsterRole[] | undefined): string[] {
  if (!creature.monsterSlug) return [...creature.roleTags];
  return fresh ? [...fresh] : creature.roleTags.filter((role) => role !== "damage");
}
