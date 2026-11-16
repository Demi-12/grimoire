/** Spells a character knows: the catalogue, what each class may pick at each level, and the choices stored in the build. */
import type { CharacterBuild } from "./character-sheet.js";
import { findClass, type ClassId, type Text } from "./dnd2024.js";
import { chosenSubclassId } from "./levelup.js";
import { spellProgress, SUBCLASS_LEVEL } from "./levelup-data.js";
import type { AbilityKey } from "./rules.js";
import { spellRows } from "./spell-data.js";

export type CastingTime = "A" | "B" | "R" | "1m" | "10m" | "1h";

export interface Spell {
  id: string;
  name: Text;
  /** 0 for cantrips. */
  level: number;
  school: string;
  classes: ClassId[];
  time: CastingTime;
  range: string;
  /** "V", "S" and "M" in that order. */
  components: string;
  duration: string;
  concentration: boolean;
  ritual: boolean;
}

const classLetters: Record<string, ClassId> = { B: "bard", C: "cleric", D: "druid", P: "paladin", R: "ranger", S: "sorcerer", K: "warlock", W: "wizard" };

export const spells: Spell[] = spellRows.map(([id, en, es, level, school, classes, time, range, components, duration, flags]) => ({
  id, name: { en, es }, level, school, classes: [...classes].map((letter) => classLetters[letter]), time: time as CastingTime, range, components, duration,
  concentration: flags.includes("c"), ritual: flags.includes("r"),
}));

const byId = new Map(spells.map((spell) => [spell.id, spell]));
export const findSpell = (id: string): Spell | undefined => byId.get(id);

export const MAX_SPELL_LEVEL = 9;
export const MAX_CUSTOM_SPELLS = 40;
export const MAX_SPELL_NAME = 60;

/** A spell from another book, typed by the player. */
export interface CustomSpell {
  name: string;
  level: number;
  /** From a feat, the species or an item instead of the class: it doesn't count against the class limits. */
  other?: boolean;
}

/** The spells picked for a character. Everything is optional so sheets saved before spells existed keep working. */
export interface SpellChoices {
  /** Class cantrips and prepared spells (catalogue ids); they count against the class limits. */
  known: string[];
  /** Wizards: spells written in the spellbook that aren't prepared right now. */
  book?: string[];
  /** Spells from elsewhere (feats, species, subclass, magic items): no limit. */
  extra?: string[];
  custom?: CustomSpell[];
  /** Spell slots spent, by spell level (index 0 = level 1). Reset on a Long Rest. */
  used?: number[];
}

export const emptySpells: SpellChoices = { known: [] };

/** How the character casts at `level`: ability, spell lists and how much they can pick. */
export interface Casting {
  ability: AbilityKey;
  /** Classes whose lists the character prepares from. */
  lists: ClassId[];
  cantrips: number;
  prepared: number;
  /** Slots per spell level (index 0 = level 1). Pact Magic slots sit at their single level. */
  slots: number[];
  /** Warlock: every slot has this level and comes back on a Short Rest. */
  pact: boolean;
  /** Highest spell level the character can prepare. */
  maxLevel: number;
  /** Wizards keep a spellbook with more spells than they prepare. */
  spellbook: boolean;
}

// Eldritch Knight and Arcane Trickster (levels 3-20): a third of a full caster's progression, from the Wizard list.
const thirdPrepared = [3, 4, 4, 4, 5, 6, 6, 7, 8, 8, 9, 10, 10, 11, 11, 11, 12, 13];
const thirdSlots: number[][] = [[2], [3], [3], [3], [4, 2], [4, 2], [4, 2], [4, 3], [4, 3], [4, 3], [4, 3, 2], [4, 3, 2], [4, 3, 2], [4, 3, 3], [4, 3, 3], [4, 3, 3], [4, 3, 3, 1], [4, 3, 3, 1]];

export function castingFor(build: Pick<CharacterBuild, "classId" | "useSubclass" | "subclassId">, level: number): Casting | null {
  const safe = Math.min(20, Math.max(1, Math.floor(level)));
  const cls = findClass(build.classId);
  const progress = spellProgress(build.classId, safe);
  if (cls?.spellcasting && progress) {
    const slots = progress.pact ? Array.from({ length: progress.pact.level }, (_, index) => (index === progress.pact!.level - 1 ? progress.pact!.count : 0)) : progress.slots;
    // Magical Secrets (Bard 10) opens the Cleric, Druid and Wizard lists.
    const lists: ClassId[] = build.classId === "bard" && safe >= 10 ? ["bard", "cleric", "druid", "wizard"] : [build.classId];
    return { ability: cls.spellcasting.ability, lists, cantrips: progress.cantrips, prepared: progress.prepared, slots, pact: !!progress.pact, maxLevel: slots.length, spellbook: build.classId === "wizard" };
  }
  const subclass = safe >= SUBCLASS_LEVEL ? chosenSubclassId(build as CharacterBuild) : null;
  if (subclass === "eldritchKnight" || subclass === "arcaneTrickster") {
    const slots = thirdSlots[safe - 3];
    // The Arcane Trickster's count includes Mage Hand.
    const cantrips = (subclass === "arcaneTrickster" ? 3 : 2) + (safe >= 10 ? 1 : 0);
    return { ability: "int", lists: ["wizard"], cantrips, prepared: thirdPrepared[safe - 3], slots, pact: false, maxLevel: slots.length, spellbook: false };
  }
  return null;
}

/** Spells of the character's lists that they could prepare at this level, cantrips included. */
export const classSpells = (casting: Casting): Spell[] =>
  spells.filter((spell) => spell.level <= casting.maxLevel && (spell.level > 0 || casting.cantrips > 0) && spell.classes.some((id) => casting.lists.includes(id)));

/** How many cantrips and prepared spells are picked; spells typed by hand count too. */
export function spellCounts(choices: SpellChoices | undefined): { cantrips: number; prepared: number } {
  let cantrips = 0;
  let prepared = 0;
  for (const id of choices?.known ?? []) { if (findSpell(id)?.level === 0) cantrips += 1; else prepared += 1; }
  for (const custom of choices?.custom ?? []) { if (custom.other) continue; if (custom.level === 0) cantrips += 1; else prepared += 1; }
  return { cantrips, prepared };
}

/** Whether one more cantrip (level 0) or prepared spell fits in the class limits. */
export function hasRoom(choices: SpellChoices | undefined, casting: Casting, level: number): boolean {
  const counts = spellCounts(choices);
  return level === 0 ? counts.cantrips < casting.cantrips : counts.prepared < casting.prepared;
}

/** Problems with the class picks: "cantrips" or "prepared" when there are more than the class allows. */
export function spellIssues(build: Pick<CharacterBuild, "classId" | "useSubclass" | "subclassId" | "spells">, level: number): string[] {
  const casting = castingFor(build, level);
  if (!casting) return [];
  const counts = spellCounts(build.spells);
  return [...(counts.cantrips > casting.cantrips ? ["cantrips"] : []), ...(counts.prepared > casting.prepared ? ["prepared"] : [])];
}

/** Cantrips and prepared spells still to choose. */
export function spellsLeft(build: Pick<CharacterBuild, "classId" | "useSubclass" | "subclassId" | "spells">, level: number): { cantrips: number; prepared: number } {
  const casting = castingFor(build, level);
  const counts = spellCounts(build.spells);
  return { cantrips: Math.max(0, (casting?.cantrips ?? 0) - counts.cantrips), prepared: Math.max(0, (casting?.prepared ?? 0) - counts.prepared) };
}

const unique = (ids: unknown): string[] => [...new Set(Array.isArray(ids) ? ids.filter((id): id is string => typeof id === "string" && byId.has(id)) : [])];

/**
 * The choices without anything that no longer applies: unknown ids, class picks outside the character's lists or above the spell
 * level they can cast, and duplicates. Returns undefined when nothing is left, so non-casters store nothing.
 */
export function cleanSpells(build: Pick<CharacterBuild, "classId" | "useSubclass" | "subclassId" | "spells">, level: number): SpellChoices | undefined {
  const choices = build.spells;
  if (!choices || typeof choices !== "object") return undefined;
  const casting = castingFor(build, level);
  const allowed = new Set(casting ? classSpells(casting).map((spell) => spell.id) : []);
  const known = unique(choices.known).filter((id) => allowed.has(id));
  const book = casting?.spellbook ? unique(choices.book).filter((id) => allowed.has(id) && findSpell(id)!.level > 0 && !known.includes(id)) : [];
  const extra = unique(choices.extra).filter((id) => !known.includes(id) && !book.includes(id));
  const custom = (Array.isArray(choices.custom) ? choices.custom : [])
    .filter((entry) => entry && typeof entry.name === "string" && entry.name.trim() && Number.isInteger(entry.level) && entry.level >= 0 && entry.level <= MAX_SPELL_LEVEL)
    .slice(0, MAX_CUSTOM_SPELLS).map((entry) => ({ name: entry.name.trim().slice(0, MAX_SPELL_NAME), level: entry.level, ...(entry.other || !casting ? { other: true } : {}) }));
  const used = (casting?.slots ?? []).map((total, index) => Math.min(total, Math.max(0, Math.floor(Number(choices.used?.[index]) || 0))));
  if (!known.length && !book.length && !extra.length && !custom.length) return undefined;
  return { known, ...(book.length ? { book } : {}), ...(extra.length ? { extra } : {}), ...(custom.length ? { custom } : {}), ...(used.some(Boolean) ? { used } : {}) };
}

export type SpellSource = "class" | "book" | "extra" | "custom";
export interface SheetSpell { key: string; name: Text; level: number; source: SpellSource; spell?: Spell }

/** Every spell on the sheet grouped by spell level (0 first), each group sorted by name in the given language. */
export function sheetSpells(choices: SpellChoices | undefined, locale: "en" | "es"): { level: number; spells: SheetSpell[] }[] {
  const entries: SheetSpell[] = [];
  const add = (ids: string[] | undefined, source: SpellSource) => {
    for (const id of ids ?? []) {
      const spell = findSpell(id);
      if (spell && !entries.some((entry) => entry.key === id)) entries.push({ key: id, name: spell.name, level: spell.level, source, spell });
    }
  };
  add(choices?.known, "class"); add(choices?.book, "book"); add(choices?.extra, "extra");
  (choices?.custom ?? []).forEach((custom, index) => entries.push({ key: `custom-${index}`, name: { en: custom.name, es: custom.name }, level: custom.level, source: custom.other ? "extra" : "custom" }));
  const levels = [...new Set(entries.map((entry) => entry.level))].sort((a, b) => a - b);
  return levels.map((level) => ({ level, spells: entries.filter((entry) => entry.level === level).sort((a, b) => a.name[locale].localeCompare(b.name[locale], locale)) }));
}

/** Slot levels the character has, with how many are spent. */
export function slotRows(casting: Casting, choices: SpellChoices | undefined): { level: number; total: number; used: number }[] {
  return casting.slots.map((total, index) => ({ level: index + 1, total, used: Math.min(total, Math.max(0, choices?.used?.[index] ?? 0)) })).filter((row) => row.total > 0);
}

/** The choices after spending (or recovering) one slot of `level`. */
export function withSlotUsed(choices: SpellChoices | undefined, casting: Casting, level: number, used: number): SpellChoices {
  const next = casting.slots.map((total, index) => Math.min(total, Math.max(0, index === level - 1 ? used : choices?.used?.[index] ?? 0)));
  return { ...(choices ?? emptySpells), used: next };
}

// --- Wording ---------------------------------------------------------------------------------------------------------

const schools: Record<string, Text> = {
  abjuration: { en: "Abjuration", es: "Abjuración" }, conjuration: { en: "Conjuration", es: "Conjuración" }, divination: { en: "Divination", es: "Adivinación" },
  enchantment: { en: "Enchantment", es: "Encantamiento" }, evocation: { en: "Evocation", es: "Evocación" }, illusion: { en: "Illusion", es: "Ilusión" },
  necromancy: { en: "Necromancy", es: "Nigromancia" }, transmutation: { en: "Transmutation", es: "Transmutación" },
};
const times: Record<CastingTime, Text> = {
  A: { en: "Action", es: "Acción" }, B: { en: "Bonus action", es: "Acción adicional" }, R: { en: "Reaction", es: "Reacción" },
  "1m": { en: "1 minute", es: "1 minuto" }, "10m": { en: "10 minutes", es: "10 minutos" }, "1h": { en: "1 hour", es: "1 hora" },
};
const words: [RegExp, string][] = [
  [/^instantaneous$/i, "Instantánea"], [/^until dispelled or triggered$/i, "Hasta que se disipe o se active"], [/^until dispelled$/i, "Hasta que se disipe"],
  [/^special$/i, "Especial"], [/^self$/i, "Personal"], [/^touch$/i, "Toque"], [/^sight$/i, "Vista"], [/^unlimited$/i, "Ilimitado"],
  [/\bfeet\b/, "pies"], [/\bmiles\b/, "millas"], [/\bmile\b/, "milla"], [/\bhours\b/, "horas"], [/\bhour\b/, "hora"], [/\bminutes\b/, "minutos"], [/\bminute\b/, "minuto"],
  [/\bdays\b/, "días"], [/\bday\b/, "día"], [/\brounds\b/, "asaltos"], [/\bround\b/, "asalto"],
];
const capital = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);
/** Range or duration as the catalogue stores it ("60 feet", "1 hour"), in the reader's language. */
export const spellMeasure = (value: string, locale: "en" | "es"): string =>
  locale === "en" ? capital(value) : words.reduce((text, [pattern, replacement]) => text.replace(pattern, replacement), value);

export const schoolName = (spell: Spell, locale: "en" | "es"): string => schools[spell.school]?.[locale] ?? spell.school;
export const castingTimeName = (spell: Spell, locale: "en" | "es"): string => times[spell.time][locale];
export const spellLevelName = (level: number, locale: "en" | "es"): string =>
  level === 0 ? (locale === "es" ? "Trucos" : "Cantrips") : locale === "es" ? `Nivel ${level}` : `Level ${level}`;

/** "Evocación · Acción · 150 pies · V, S, M · Instantánea". */
export function spellFacts(spell: Spell, locale: "en" | "es"): string {
  const duration = `${spell.concentration ? (locale === "es" ? "Concentración, " : "Concentration, ") : ""}${spellMeasure(spell.duration, locale)}`;
  return [schoolName(spell, locale), `${castingTimeName(spell, locale)}${spell.ritual ? (locale === "es" ? " o ritual" : " or Ritual") : ""}`,
    spellMeasure(spell.range, locale), [...spell.components].join(", "), duration].join(" · ");
}
