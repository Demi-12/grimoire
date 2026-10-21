import { describe, expect, it } from "vitest";
import type { Character } from "./api-client";
import { sheetFor, signed, startingItems } from "./character-view";
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
});
