/**
 * Mechanics of a feature, feat or species trait, written as data so the creator, the level-up guide and the
 * sheet share one engine instead of special cases per class. A feature without effects is shown but changes nothing.
 * Kinds are added when some feature needs one; character-sheet.ts applies them.
 */
import type { AbilityKey } from "./rules";
import type { SkillKey } from "./dnd2024";

export type Effect =
  // Choices: each one becomes a step of the level-up guide at the level the feature is gained.
  | { kind: "chooseSkills"; count: number; from?: SkillKey[] }
  | { kind: "chooseExpertise"; count: number; from?: SkillKey[] }
  | { kind: "chooseFightingStyle" }
  // Modifiers: applied to the sheet from the level the feature is gained.
  /** Hit Point maximum + amount × character level (Dwarven Toughness, Tough, Draconic Resilience). */
  | { kind: "hpPerLevel"; amount: number }
  /** Without armor, AC = 10 + Dexterity + these modifiers; the best formula the character has is used. */
  | { kind: "unarmoredDefense"; add: AbilityKey[] }
  | { kind: "acBonus"; amount: number; whileArmored?: boolean }
  | { kind: "initiativeBonus"; add: "proficiency" }
  | { kind: "saveProficiency"; abilities: AbilityKey[] };

export type EffectKind = Effect["kind"];
export type EffectOf<K extends EffectKind> = Extract<Effect, { kind: K }>;

/** Effects of one kind, in order. */
export const effectsOf = <K extends EffectKind>(effects: readonly Effect[], kind: K): EffectOf<K>[] =>
  effects.filter((effect): effect is EffectOf<K> => effect.kind === kind);
