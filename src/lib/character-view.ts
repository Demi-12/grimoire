/** Helpers shared by the character cards, the print sheet and the on-screen sheet view. */
import type { Character } from "./api-client";
import { deriveSheet, type CharacterBuild, type DerivedSheet } from "./character-sheet";
import { findBackground, findClass, say } from "./dnd2024";
import type { Locale } from "./i18n";

export const signed = (value: number) => `${value >= 0 ? "+" : "−"}${Math.abs(value)}`;

/** Starting gear chosen in the creator, without the coin entries. */
export function startingItems(build: CharacterBuild, locale: Locale): string[] {
  const cls = findClass(build.classId);
  const bg = findBackground(build.backgroundId);
  const options = [cls?.equipment.find((option) => option.id === build.classEquipment), bg?.equipment.find((option) => option.id === build.backgroundEquipment)];
  return options.flatMap((option) => option?.items ?? []).filter((item) => !/ GP$/.test(item.en)).map((item) => say(item, locale));
}

/** Derived stats for characters made with the step-by-step creator; quick-edit characters have none. */
export const sheetFor = (character: Character): DerivedSheet | null => character.build ? deriveSheet(character.build, character.level) : null;
