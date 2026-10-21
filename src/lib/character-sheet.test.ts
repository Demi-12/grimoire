import { describe, expect, it } from "vitest";
import { backgrounds, canMasterWeapon, classes, masterableWeapons, masteryProperties, species, weaponIds, weaponMasteryCount, weaponTable } from "./dnd2024";
import { attackList, deriveSheet, finalScores, pointBuySpent, roll4d6DropLowest, stepIssues, validBaseScores, validBonuses, validWeaponMasteries, type CharacterBuild } from "./character-sheet";

const fighter: CharacterBuild = {
  version: 1, classId: "fighter", useSubclass: true, backgroundId: "soldier", speciesId: "human",
  abilityMethod: "standard", baseScores: { str: 15, dex: 14, con: 13, int: 10, wis: 12, cha: 8 },
  bonusMode: "plus2plus1", bonusAbilities: ["str", "con"], classSkills: ["perception", "survival"],
  speciesSkills: ["insight"], speciesFeat: "alert", featSkills: [], expertise: [], languages: [1, 4],
  weaponMasteries: ["greatsword", "flail", "javelin"], classEquipment: "A", backgroundEquipment: "A", alignment: 0, appearance: "",
};

describe("2024 ability scores", () => {
  it("applies the background +2/+1 only to its listed abilities, capped at 20", () => {
    expect(finalScores(fighter)).toMatchObject({ str: 17, con: 14, dex: 14 });
    expect(validBonuses({ ...fighter, bonusAbilities: ["str", "wis"] })).toBe(false);
    expect(finalScores({ ...fighter, abilityMethod: "rolled", baseScores: { ...fighter.baseScores, str: 19 } }).str).toBe(20);
  });

  it("validates the standard array and the 27-point buy", () => {
    expect(validBaseScores(fighter)).toBe(true);
    expect(validBaseScores({ ...fighter, baseScores: { ...fighter.baseScores, cha: 9 } })).toBe(false);
    const pointBuy = { abilityMethod: "pointBuy" as const, baseScores: { str: 15, dex: 15, con: 15, int: 8, wis: 8, cha: 8 } };
    expect(pointBuySpent(pointBuy.baseScores)).toBe(27);
    expect(validBaseScores(pointBuy)).toBe(true);
    expect(validBaseScores({ ...pointBuy, baseScores: { ...pointBuy.baseScores, int: 9 } })).toBe(false);
  });

  it("rolls 4d6 dropping the lowest die", () => {
    const dice = [0.99, 0.99, 0.99, 0];
    expect(roll4d6DropLowest(() => dice.shift() ?? 0)).toBe(18);
  });
});

describe("derived sheet", () => {
  it("computes HP, AC, initiative and skills for a level 1 fighter", () => {
    const sheet = deriveSheet(fighter, 1)!;
    expect(sheet.hitPoints).toBe(12); // d10 max + CON 14 (+2)
    expect(sheet.armorClass).toBe(16); // Chain Mail ignores Dexterity
    expect(sheet.initiative).toBe(4); // DEX +2 and Alert adds the proficiency bonus
    expect(sheet.skills.athletics).toEqual({ proficient: true, expertise: false, bonus: 5 }); // Soldier skill
    expect(sheet.saves.con.proficient).toBe(true);
    expect(sheet.passivePerception).toBe(13);
    expect(sheet.gold).toBe(4 + 14);
  });

  it("uses fixed Hit Point averages after level 1 and Dwarven Toughness", () => {
    expect(deriveSheet(fighter, 5)!.hitPoints).toBe(12 + 4 * (6 + 2));
    expect(deriveSheet({ ...fighter, speciesId: "dwarf", speciesSkills: [], speciesFeat: undefined }, 3)!.hitPoints).toBe(12 + 2 * 8 + 3);
  });

  it("applies Unarmored Defense, Rogue Expertise and spellcasting values", () => {
    const barbarian = deriveSheet({ ...fighter, classId: "barbarian", classEquipment: "A" }, 1)!;
    expect(barbarian.armorClass).toBe(10 + 2 + 2);
    const wizard = deriveSheet({ ...fighter, classId: "wizard", baseScores: { str: 8, dex: 14, con: 13, int: 15, wis: 12, cha: 10 }, backgroundId: "sage", bonusAbilities: ["int", "con"] }, 1)!;
    expect(wizard.spellSaveDc).toBe(8 + 2 + 3);
    const rogue = deriveSheet({ ...fighter, classId: "rogue", classSkills: ["stealth", "acrobatics", "deception", "perception"], expertise: ["stealth", "perception"] }, 1)!;
    expect(rogue.skills.stealth.bonus).toBe(2 + 4);
    expect(rogue.armorClass).toBe(13);
  });

  it("blocks steps with missing choices", () => {
    expect(stepIssues({ ...fighter, classSkills: ["perception"] }, 4)).toContain("classSkills");
    expect(stepIssues({ ...fighter, speciesId: "elf", speciesSkills: [] }, 2)).toEqual(expect.arrayContaining(["lineage", "speciesSkills"]));
    expect(stepIssues(fighter, 6)).toEqual([]);
  });
});

describe("2024 catalog", () => {
  it("offers the 16 Player's Handbook backgrounds, each with sane data", () => {
    expect(backgrounds).toHaveLength(16);
    for (const bg of backgrounds) {
      expect(new Set(bg.abilities).size).toBe(3);
      expect(new Set(bg.skills).size).toBe(2);
      expect(bg.equipment.map((option) => option.id)).toEqual(["A", "B"]);
      expect(bg.equipment[1].gold).toBe(50);
      expect(bg.feat === "magicInitiate").toBe(!!bg.featList);
    }
    expect(new Set(backgrounds.map((bg) => bg.id)).size).toBe(16);
    expect(species).toHaveLength(10);
  });

  it("Tough adds 2 Hit Points per level", () => {
    const farmer: CharacterBuild = { ...fighter, backgroundId: "farmer", bonusAbilities: ["str", "con"], speciesFeat: undefined };
    expect(deriveSheet(farmer, 1)!.hitPoints).toBe(12 + 2);
    expect(deriveSheet(farmer, 3)!.hitPoints).toBe(12 + 2 * 8 + 3 * 2);
  });
});


describe("attack list", () => {
  it("lists starting weapons with proficiency, ability and damage", () => {
    const sheet = deriveSheet(fighter, 1)!;
    const attacks = attackList(fighter, sheet);
    expect(attacks.length).toBeGreaterThan(0);
    for (const attack of attacks) expect(attack.bonus).toBe(attack.modifier + sheet.proficiency);
    const barbarian = { ...fighter, classId: "barbarian" as const, classEquipment: "A" as const, weaponMasteries: [] };
    const greataxe = attackList(barbarian, deriveSheet(barbarian, 1)!).find((attack) => attack.name.en === "Greataxe");
    expect(greataxe).toMatchObject({ dice: "1d12", modifier: 3, bonus: 5 }); // STR 17, proficient (+2)
    // Taking the gold instead of the class gear leaves only the background's weapons (Soldier: Spear, Shortbow).
    const goldOnly = { ...barbarian, classEquipment: "B" as const };
    expect(attackList(goldOnly, deriveSheet(goldOnly, 1)!).map((attack) => attack.name.en).sort()).toEqual(["Shortbow", "Spear"]);
  });
});

describe("weapon data", () => {
  it("lists every weapon named in the starting equipment by id", () => {
    const byName = new Map(Object.entries(weaponTable).map(([id, weapon]) => [weapon.name.en, id]));
    for (const option of [...classes, ...backgrounds].flatMap((entry) => entry.equipment)) {
      const named = option.items.map((item) => byName.get(item.en.replace(/^\d+ /, "").replace(/s$/, "").replace(/^.*Focus \((.*)\)$/, "$1")) ?? byName.get(item.en.replace(/^\d+ /, ""))).filter(Boolean);
      expect(option.weapons ?? []).toEqual(expect.arrayContaining(named as string[]));
    }
  });
});

describe("weapon mastery", () => {
  it("gives every 2024 weapon one of the eight mastery properties, checked against SRD 5.2", () => {
    expect(weaponIds).toHaveLength(38);
    for (const id of weaponIds) expect(masteryProperties[weaponTable[id].mastery], id).toBeDefined();
    expect(Object.fromEntries((["club", "dagger", "greatclub", "handaxe", "quarterstaff", "spear", "dart", "battleaxe", "glaive", "greataxe", "halberd", "lance", "longsword", "pike", "rapier", "scimitar", "shortsword", "whip", "heavyCrossbow", "longbow"] as const).map((id) => [id, weaponTable[id].mastery])))
      .toEqual({ club: "slow", dagger: "nick", greatclub: "push", handaxe: "vex", quarterstaff: "topple", spear: "sap", dart: "vex", battleaxe: "topple", glaive: "graze", greataxe: "cleave",
        halberd: "cleave", lance: "topple", longsword: "sap", pike: "push", rapier: "vex", scimitar: "nick", shortsword: "vex", whip: "slow", heavyCrossbow: "push", longbow: "slow" });
  });

  it("scales the number of masteries with level for Barbarians and Fighters only", () => {
    expect([1, 4, 10, 20].map((level) => weaponMasteryCount("barbarian", level))).toEqual([2, 3, 4, 4]);
    expect([1, 3, 4, 10, 16].map((level) => weaponMasteryCount("fighter", level))).toEqual([3, 3, 4, 5, 6]);
    expect(weaponMasteryCount("paladin", 20)).toBe(2);
    expect(weaponMasteryCount("wizard", 20)).toBe(0);
  });

  it("limits each class to the weapons its feature allows", () => {
    expect(canMasterWeapon("barbarian", "maul")).toBe(true);
    expect(canMasterWeapon("barbarian", "longbow")).toBe(false);
    expect(masterableWeapons("fighter")).toHaveLength(38);
    expect(masterableWeapons("ranger")).toHaveLength(38);
    expect(canMasterWeapon("rogue", "quarterstaff")).toBe(true);
    expect(canMasterWeapon("rogue", "rapier")).toBe(true);
    expect(canMasterWeapon("rogue", "handCrossbow")).toBe(true);
    expect(canMasterWeapon("rogue", "longsword")).toBe(false);
    expect(masterableWeapons("cleric")).toEqual([]);
  });

  it("requires exactly the class's number of distinct, allowed weapons in the creator", () => {
    expect(validWeaponMasteries(fighter, 1)).toBe(true);
    expect(validWeaponMasteries(fighter, 4)).toBe(false);
    expect(validWeaponMasteries({ ...fighter, weaponMasteries: ["greatsword", "greatsword", "flail"] }, 1)).toBe(false);
    expect(validWeaponMasteries({ classId: "barbarian", weaponMasteries: ["greataxe", "longbow"] }, 1)).toBe(false);
    expect(validWeaponMasteries({ classId: "wizard" }, 5)).toBe(true);
    expect(stepIssues({ ...fighter, weaponMasteries: undefined }, 4)).toContain("weaponMasteries");
    expect(stepIssues(fighter, 4)).not.toContain("weaponMasteries");
    expect(stepIssues(fighter, 4, 4)).toContain("weaponMasteries");
  });

  it("shows the mastery of chosen weapons on the attack list, including ones outside the starting gear", () => {
    const attacks = attackList({ ...fighter, weaponMasteries: ["greatsword", "flail", "rapier"] }, deriveSheet(fighter, 1)!);
    const byName = Object.fromEntries(attacks.map((attack) => [attack.name.en, attack]));
    expect(byName.Greatsword.mastery).toBe("graze");
    expect(byName.Javelin.mastery).toBeUndefined();
    expect(byName.Rapier).toMatchObject({ mastery: "vex", dice: "1d8" });
    expect(byName.Greatsword.masteryAlternatives).toBeUndefined();
    const veteran = attackList(fighter, deriveSheet(fighter, 9)!).find((attack) => attack.name.en === "Flail");
    expect(veteran?.masteryAlternatives).toEqual(["push", "slow"]); // Tactical Master; Flail already has Sap
  });
});
