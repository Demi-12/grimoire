/** Helpers shared by the character cards, the print sheet and the on-screen sheet view. */
import type { Character } from "./api-client";
import { allFeats, chosenSize, deriveSheet, type CharacterBuild, type DerivedSheet } from "./character-sheet";
import { findBackground, findClass, findSpecies, say, speciesNeedsSpellAbility, speciesSizeNames, speciesSizeOptions, type Feature, type Text } from "./dnd2024";
import type { AbilityKey } from "./rules";
import type { Locale } from "./i18n";
import { unlockedFeatures } from "./levelup";
import { featInfo } from "./levelup-data";

const abilityNames: Record<AbilityKey, Text> = {
  str: { en: "Strength", es: "Fuerza" }, dex: { en: "Dexterity", es: "Destreza" }, con: { en: "Constitution", es: "Constitución" },
  int: { en: "Intelligence", es: "Inteligencia" }, wis: { en: "Wisdom", es: "Sabiduría" }, cha: { en: "Charisma", es: "Carisma" },
};

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

/**
 * Species traits with their summaries. The chosen lineage or ancestry leads, merged with the species trait of the same name
 * when there is one; then the chosen size and the ability for the species' spells, when the species lets the player pick them.
 */
export function speciesTraits(build: CharacterBuild): Feature[] {
  const sp = findSpecies(build.speciesId);
  if (!sp) return [];
  const lineage = sp.lineages?.find((item) => item.id === build.lineageId);
  const label = sp.lineageLabel;
  const general = lineage && label ? sp.traits.find((trait) => trait.name.en === label.en) : undefined;
  const traits = sp.traits.filter((trait) => trait !== general);
  const extra: Feature[] = [];
  if (speciesSizeOptions(sp).length) {
    const size = speciesSizeNames[chosenSize(build)];
    extra.push({ name: { en: `Size: ${size.en}`, es: `Tamaño: ${size.es}` }, tip: { en: "Chosen when the character was created.", es: "Elegido al crear el personaje." } });
  }
  const ability = speciesNeedsSpellAbility(sp, build.lineageId) ? build.speciesSpellAbility : undefined;
  if (ability) {
    const name = abilityNames[ability];
    extra.push({ name: { en: `Spellcasting ability: ${name.en}`, es: `Característica para lanzar conjuros: ${name.es}` },
      tip: { en: "Used for the spells your species or lineage grants, including their save DC and attack bonus.", es: "Se usa para los conjuros que te da tu especie o linaje, también para su CD de salvación y su bonificador de ataque." } });
  }
  if (!lineage || !label) return [...traits, ...extra];
  const detail = lineage.description ?? lineage.detail ?? { en: "", es: "" };
  const tip = general ? { en: `${general.tip.en} ${detail.en}`.trim(), es: `${general.tip.es} ${detail.es}`.trim() } : detail;
  return [{ name: { en: `${label.en}: ${lineage.name.en}`, es: `${label.es}: ${lineage.name.es}` }, tip }, ...traits, ...extra];
}
