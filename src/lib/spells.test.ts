import { describe, expect, it } from "vitest";
import type { CharacterBuild } from "./character-sheet";
import {
  castingFor, classSpells, cleanSpells, findSpell, sheetSpells, slotRows, spellCounts, spellFacts, spellIssues, spellMeasure, spells, spellsLeft, withSlotUsed,
} from "./spells";

const base: CharacterBuild = {
  version: 1, classId: "wizard", useSubclass: true, backgroundId: "sage", speciesId: "human", abilityMethod: "standard",
  baseScores: { str: 8, dex: 14, con: 13, int: 15, wis: 12, cha: 10 }, bonusMode: "plus2plus1", bonusAbilities: ["int", "con"],
  classSkills: [], speciesSkills: [], featSkills: [], expertise: [], languages: [0, 1], classEquipment: "A", backgroundEquipment: "A", alignment: 4, appearance: "",
};

describe("spell catalogue", () => {
  it("holds the SRD 5.2 spells with unique ids and both names", () => {
    expect(spells).toHaveLength(339);
    expect(new Set(spells.map((spell) => spell.id)).size).toBe(spells.length);
    expect(new Set(spells.map((spell) => spell.name.es)).size).toBe(spells.length);
    expect(spells.every((spell) => spell.name.en && spell.name.es && spell.classes.length > 0 && spell.level >= 0 && spell.level <= 9)).toBe(true);
    expect(findSpell("fireball")).toMatchObject({ name: { en: "Fireball", es: "Bola de fuego" }, level: 3, classes: ["sorcerer", "wizard"], concentration: false });
    expect(findSpell("detect-magic")).toMatchObject({ ritual: true, concentration: true });
  });

  it("words the facts in both languages", () => {
    const fireball = findSpell("fireball")!;
    expect(spellFacts(fireball, "es")).toBe("Evocación · Acción · 150 pies · V, S, M · Instantánea");
    expect(spellFacts(findSpell("detect-magic")!, "en")).toBe("Divination · Action or Ritual · Self · V, S · Concentration, 10 minutes");
    expect(spellMeasure("1 mile", "es")).toBe("1 milla");
    expect(spellMeasure("until dispelled", "es")).toBe("Hasta que se disipe");
  });
});

describe("castingFor", () => {
  it("follows each class's progression", () => {
    expect(castingFor(base, 1)).toMatchObject({ ability: "int", cantrips: 3, prepared: 4, slots: [2], maxLevel: 1, spellbook: true, pact: false });
    expect(castingFor({ ...base, classId: "paladin" }, 5)).toMatchObject({ ability: "cha", cantrips: 0, prepared: 6, slots: [4, 2], maxLevel: 2 });
    expect(castingFor({ ...base, classId: "warlock" }, 5)).toMatchObject({ pact: true, slots: [0, 0, 2], maxLevel: 3, prepared: 6 });
    expect(castingFor({ ...base, classId: "barbarian" }, 20)).toBeNull();
  });

  it("gives Eldritch Knights and Arcane Tricksters wizard spells from level 3", () => {
    const knight = { ...base, classId: "fighter" as const, useSubclass: false, subclassId: "eldritchKnight" };
    expect(castingFor(knight, 2)).toBeNull();
    expect(castingFor(knight, 3)).toMatchObject({ ability: "int", lists: ["wizard"], cantrips: 2, prepared: 3, slots: [2] });
    expect(castingFor(knight, 20)).toMatchObject({ cantrips: 3, prepared: 13, slots: [4, 3, 3, 1] });
    expect(castingFor({ ...base, classId: "rogue", useSubclass: false, subclassId: "arcaneTrickster" }, 3)?.cantrips).toBe(3);
    expect(castingFor({ ...base, classId: "fighter" }, 5)).toBeNull();
  });

  it("offers only spells the character can cast", () => {
    const options = classSpells(castingFor(base, 1)!);
    expect(options.every((spell) => spell.level <= 1 && spell.classes.includes("wizard"))).toBe(true);
    expect(options.some((spell) => spell.id === "fire-bolt")).toBe(true);
    // Paladins have no cantrips.
    expect(classSpells(castingFor({ ...base, classId: "paladin" }, 1)!).every((spell) => spell.level === 1)).toBe(true);
    // Magical Secrets opens other lists to bards.
    expect(classSpells(castingFor({ ...base, classId: "bard" }, 9)!).some((spell) => spell.id === "fireball")).toBe(false);
    expect(classSpells(castingFor({ ...base, classId: "bard" }, 10)!).some((spell) => spell.id === "fireball")).toBe(true);
  });
});

describe("spell choices", () => {
  const picks = { known: ["fire-bolt", "light", "mage-hand", "magic-missile", "shield"], book: ["sleep"], extra: ["cure-wounds"], custom: [{ name: "Toll the Dead", level: 0 }] };

  it("counts class picks against the limits", () => {
    expect(spellCounts(picks)).toEqual({ cantrips: 4, prepared: 2 });
    expect(spellCounts({ known: [], custom: [{ name: "Guidance", level: 0, other: true }] })).toEqual({ cantrips: 0, prepared: 0 });
    expect(spellIssues({ ...base, spells: picks }, 1)).toEqual(["cantrips"]);
    expect(spellIssues({ ...base, spells: { ...picks, custom: [] } }, 1)).toEqual([]);
    expect(spellsLeft({ ...base, spells: { ...picks, custom: [] } }, 1)).toEqual({ cantrips: 0, prepared: 2 });
    expect(spellIssues({ ...base, classId: "fighter", spells: picks }, 1)).toEqual([]);
  });

  it("drops what no longer applies", () => {
    expect(cleanSpells(base, 1)).toBeUndefined();
    expect(cleanSpells({ ...base, spells: { known: [] } }, 1)).toBeUndefined();
    const cleaned = cleanSpells({ ...base, spells: { known: ["fire-bolt", "fire-bolt", "fireball", "cure-wounds", "nope"], book: ["fire-bolt", "sleep", "light"], extra: ["sleep", "cure-wounds"], used: [5] } }, 1);
    // Fireball is level 3, Cure Wounds isn't a wizard spell, cantrips don't go in the book, and a spell lives in one list.
    expect(cleaned).toEqual({ known: ["fire-bolt"], book: ["sleep"], extra: ["cure-wounds"], used: [2] });
    // A class that doesn't cast keeps only the spells from other sources.
    expect(cleanSpells({ ...base, classId: "fighter", spells: picks }, 1)).toEqual({ known: [], extra: ["cure-wounds"], custom: [{ name: "Toll the Dead", level: 0, other: true }] });
    expect(cleanSpells({ ...base, spells: { known: ["shield"], custom: [{ name: "  ", level: 1 }, { name: "Hex", level: 12 }] } }, 1)).toEqual({ known: ["shield"] });
    expect(cleanSpells({ ...base, spells: "x" as never }, 1)).toBeUndefined();
  });

  it("groups the sheet's spells by level", () => {
    const groups = sheetSpells(picks, "es");
    expect(groups.map((group) => group.level)).toEqual([0, 1]);
    expect(groups[0].spells.map((entry) => entry.name.es)).toEqual(["Descarga de fuego", "Luz", "Mano de mago", "Toll the Dead"]);
    expect(groups[1].spells.map((entry) => [entry.key, entry.source])).toEqual([["cure-wounds", "extra"], ["sleep", "book"], ["shield", "class"], ["magic-missile", "class"]]);
    expect(sheetSpells(undefined, "en")).toEqual([]);
  });

  it("tracks spent slots", () => {
    const casting = castingFor(base, 3)!;
    expect(slotRows(casting, undefined)).toEqual([{ level: 1, total: 4, used: 0 }, { level: 2, total: 2, used: 0 }]);
    const spent = withSlotUsed(undefined, casting, 2, 5);
    expect(spent).toEqual({ known: [], used: [0, 2] });
    expect(slotRows(casting, withSlotUsed(spent, casting, 1, 1))).toEqual([{ level: 1, total: 4, used: 1 }, { level: 2, total: 2, used: 2 }]);
    // Pact Magic: one row at the pact's level.
    expect(slotRows(castingFor({ ...base, classId: "warlock" }, 5)!, undefined)).toEqual([{ level: 3, total: 2, used: 0 }]);
  });
});
