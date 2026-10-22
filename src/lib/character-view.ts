/** Helpers shared by the character cards, the print sheet and the on-screen sheet view. */
import type { Character } from "./api-client";
import { allFeats, deriveSheet, type CharacterBuild, type DerivedSheet } from "./character-sheet";
import { findBackground, findClass, findSpecies, say, type Feature } from "./dnd2024";
import type { Locale } from "./i18n";
import { unlockedFeatures } from "./levelup";
import { featInfo } from "./levelup-data";

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

/** Class and subclass features earned by `level`, then every feat, each with its one-line summary. */
export function featureList(build: CharacterBuild, level: number): Feature[] {
  const feats = allFeats(build, level).map((id) => ({ name: featInfo(id).name, tip: featInfo(id).summary }));
  return [...unlockedFeatures(build, level), ...feats];
}

/** Species traits with their summaries, led by the chosen lineage or ancestry when the species has one. */
export function speciesTraits(build: CharacterBuild): Feature[] {
  const sp = findSpecies(build.speciesId);
  if (!sp) return [];
  const lineage = sp.lineages?.find((item) => item.id === build.lineageId);
  if (!lineage || !sp.lineageLabel) return sp.traits;
  const label = sp.lineageLabel;
  return [{ name: { en: `${label.en}: ${lineage.name.en}`, es: `${label.es}: ${lineage.name.es}` }, tip: lineage.detail ?? { en: "", es: "" } }, ...sp.traits];
}
