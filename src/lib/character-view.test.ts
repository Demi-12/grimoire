import { describe, expect, it } from "vitest";
import type { Character } from "./api-client";
import { featureList, sheetFor, signed, speciesTraits, startingItems } from "./character-view";
import { classes, species } from "./dnd2024";
import type { CharacterBuild } from "./character-sheet";

const fighter: CharacterBuild = {
  version: 1, classId: "fighter", useSubclass: true, backgroundId: "soldier", speciesId: "human",
  abilityMethod: "standard", baseScores: { str: 15, dex: 14, con: 13, int: 10, wis: 12, cha: 8 },
  bonusMode: "plus2plus1", bonusAbilities: ["str", "con"], classSkills: ["perception", "survival"],
  speciesSkills: ["insight"], speciesFeat: "alert", featSkills: [], expertise: [], languages: [1, 4],
  classEquipment: "A", backgroundEquipment: "A", alignment: 0, appearance: "",
};

const character = (overrides: Partial<Character> = {}): Character => ({
  id: "c1", ownerId: "u1", ownerName: "Alice", campaignId: null, name: "Brom", level: 3, className: "Fighter", species: "Human", background: "Soldier",
  scores: { str: 17, dex: 14, con: 14, int: 10, wis: 12, cha: 8 }, notes: "", editable: true, ...overrides,
});

describe("character view helpers", () => {
  it("formats bonuses with a sign and a true minus", () => {
    expect(signed(3)).toBe("+3");
    expect(signed(0)).toBe("+0");
    expect(signed(-1)).toBe("−1");
  });

  it("derives a sheet only for characters made with the step-by-step creator", () => {
    expect(sheetFor(character())).toBeNull();
    const sheet = sheetFor(character({ build: fighter }));
    expect(sheet).toMatchObject({ level: 3, armorClass: 16, proficiency: 2 });
    expect(sheet?.saves.str.proficient).toBe(true);
  });

  it("lists the starting gear in both languages without coin entries", () => {
    const english = startingItems(fighter, "en");
    const spanish = startingItems(fighter, "es");
    expect(english.length).toBeGreaterThan(0);
    expect(english.length).toBe(spanish.length);
    expect(english.some((item) => / GP$/.test(item))).toBe(false);
    expect(english).not.toEqual(spanish);
  });

  it("describes every class feature and species trait in both languages", () => {
    for (const entry of [...classes.flatMap((cls) => cls.features), ...species.flatMap((sp) => sp.traits)]) {
      expect(entry.tip.en.length, entry.name.en).toBeGreaterThan(10);
      expect(entry.tip.es.length, entry.name.en).toBeGreaterThan(10);
    }
  });

  it("lists features up to the character's level followed by its feats", () => {
    const names = (level: number) => featureList(fighter, level).map((feature) => feature.name.en);
    expect(names(1)).toContain("Second Wind");
    expect(names(1)).not.toContain("Action Surge");
    expect(names(2)).toContain("Action Surge");
    expect(names(1).at(-1)).toBe("Alert");
    expect(featureList(fighter, 5).every((feature) => feature.tip.en && feature.tip.es)).toBe(true);
  });

  it("puts the chosen lineage first among the species traits, then the chosen size and spellcasting ability", () => {
    expect(speciesTraits(fighter).map((trait) => trait.name.en)).toEqual(["Resourceful", "Skillful", "Versatile", "Size: Medium"]);
    expect(speciesTraits({ ...fighter, size: "small" }).at(-1)).toMatchObject({ name: { es: "Tamaño: Pequeño" } });
    // The Elven Lineage trait merges with the chosen lineage instead of being listed twice.
    const elf = speciesTraits({ ...fighter, speciesId: "elf", lineageId: "wood", speciesSpellAbility: "wis" });
    expect(elf[0].name.es).toBe("Linaje élfico: Elfo de los bosques");
    expect(elf[0].tip.en).toContain("Pass without Trace");
    expect(elf.filter((trait) => trait.name.en.startsWith("Elven Lineage"))).toHaveLength(1);
    expect(elf.at(-1)).toMatchObject({ name: { en: "Spellcasting ability: Wisdom" } });
    expect(elf).toHaveLength(5);
  });

  it("describes every Player's Handbook lineage in full", () => {
    for (const sp of species.filter((item) => item.source === "phb2024")) {
      for (const trait of sp.traits) expect(trait.tip.en && trait.tip.es).toBeTruthy();
      for (const lineage of sp.lineages ?? []) expect((lineage.description ?? lineage.detail)?.es).toBeTruthy();
    }
  });
});
