import { describe, expect, it } from "vitest";
import { backgrounds, classes, species, weaponTable } from "./dnd2024";
import { attackList, deriveSheet, duplicatesBackgroundFeat, finalScores, pointBuySpent, roll4d6DropLowest, rollAbilityPool, stepIssues, validBaseScores, validBonuses, type CharacterBuild } from "./character-sheet";

const fighter: CharacterBuild = {
  version: 1, classId: "fighter", useSubclass: true, backgroundId: "soldier", speciesId: "human",
  abilityMethod: "standard", baseScores: { str: 15, dex: 14, con: 13, int: 10, wis: 12, cha: 8 },
  bonusMode: "plus2plus1", bonusAbilities: ["str", "con"], classSkills: ["perception", "survival"],
  speciesSkills: ["insight"], speciesFeat: "alert", featSkills: [], expertise: [], languages: [1, 4],
  classEquipment: "A", backgroundEquipment: "A", alignment: 0, appearance: "",
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

  it("keeps the four dice of each of the six rolls", () => {
    const { pool, dice } = rollAbilityPool(() => 0.5); // every die shows 4
    expect(pool).toEqual([12, 12, 12, 12, 12, 12]);
    expect(dice).toHaveLength(6);
    for (const [index, roll] of dice.entries()) expect(roll[0] + roll[1] + roll[2]).toBe(pool[index]);
  });

  it("asks for the roll before validating rolled scores", () => {
    expect(stepIssues({ ...fighter, abilityMethod: "rolled", rolledPool: undefined }, 3)).toEqual(["roll"]);
    expect(stepIssues({ ...fighter, abilityMethod: "rolled", rolledPool: [15, 14, 13, 12, 10, 8] }, 3)).toEqual([]);
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

  it("rejects skills granted twice or Expertise in a skill the character lacks", () => {
    expect(stepIssues(fighter, 4)).toEqual([]);
    // Athletics already comes from the Soldier background.
    expect(stepIssues({ ...fighter, classSkills: ["athletics", "survival"] }, 4)).toContain("classSkills");
    expect(stepIssues({ ...fighter, classSkills: ["survival", "survival"] }, 4)).toContain("classSkills");
    expect(stepIssues({ ...fighter, classSkills: ["perception", "arcana"] }, 4)).toContain("classSkills"); // not a Fighter skill
    // The Eladrin already has Perception.
    expect(stepIssues({ ...fighter, speciesId: "eladrin", speciesSkills: [], speciesFeat: undefined }, 4)).toContain("classSkills");
    const rogue: CharacterBuild = { ...fighter, classId: "rogue", classSkills: ["stealth", "acrobatics", "deception", "perception"], expertise: ["stealth", "perception"] };
    expect(stepIssues(rogue, 4)).toEqual([]);
    expect(stepIssues({ ...rogue, expertise: ["stealth", "arcana"] }, 4)).toContain("expertise");
    const skilled: CharacterBuild = { ...fighter, backgroundId: "noble", featSkills: ["arcana", "medicine", "stealth"] };
    expect(stepIssues(skilled, 4)).toEqual([]);
    expect(stepIssues({ ...skilled, featSkills: ["arcana", "medicine", "perception"] }, 4)).toContain("featSkills");
  });

  it("does not let the Human take the background's Origin feat again", () => {
    const criminal: CharacterBuild = { ...fighter, backgroundId: "criminal", bonusAbilities: ["dex", "con"] };
    expect(duplicatesBackgroundFeat(criminal)).toBe(true); // Alert twice
    expect(stepIssues(criminal, 2)).toContain("duplicateFeat");
    expect(stepIssues({ ...criminal, speciesFeat: "tough" }, 2)).toEqual([]);
    const acolyte: CharacterBuild = { ...fighter, backgroundId: "acolyte", speciesFeat: "magicInitiate", magicInitiateList: "cleric" };
    expect(duplicatesBackgroundFeat(acolyte)).toBe(true);
    expect(duplicatesBackgroundFeat({ ...acolyte, magicInitiateList: "wizard" })).toBe(false);
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
    expect(species.filter((sp) => sp.source === "phb2024")).toHaveLength(10);
  });

  it("adds the Eberron and Monsters of the Multiverse species with sane data", () => {
    expect(species.length).toBeGreaterThan(30);
    expect(new Set(species.map((sp) => sp.id)).size).toBe(species.length);
    expect(species.map((sp) => sp.id)).toEqual(expect.arrayContaining(["changeling", "kalashtar", "khoravar", "shifter", "warforged", "tabaxi", "tortle"]));
    for (const sp of species) {
      expect(sp.traits.length).toBeGreaterThan(0);
      expect([25, 30, 35, 40]).toContain(sp.speed);
      if (sp.lineages) expect(new Set(sp.lineages.map((lineage) => lineage.id)).size).toBe(sp.lineages.length);
      if (sp.skillChoice?.options.length) expect(sp.skillChoice.options.length).toBeGreaterThan(sp.skillChoice.count);
    }
  });

  it("applies species mechanics: fixed skills, natural armor, initiative and AC bonuses", () => {
    const wizard: CharacterBuild = { ...fighter, classId: "wizard", classSkills: ["arcana", "history"], speciesSkills: [], speciesFeat: undefined };
    const human = deriveSheet({ ...wizard, speciesId: "human", speciesSkills: ["insight"] }, 1)!;
    expect(deriveSheet({ ...wizard, speciesId: "tabaxi" }, 1)!.skills.stealth.proficient).toBe(true);
    expect(deriveSheet({ ...wizard, speciesId: "lizardfolk" }, 1)!.armorClass).toBe(human.armorClass + 3); // 13 + Dex instead of 10 + Dex
    expect(deriveSheet({ ...wizard, speciesId: "tortle" }, 1)!.armorClass).toBe(17);
    expect(deriveSheet({ ...wizard, speciesId: "warforged" }, 1)!.armorClass).toBe(human.armorClass + 1);
    expect(deriveSheet({ ...wizard, speciesId: "harengon" }, 1)!.initiative).toBe(human.initiative + 2);
    expect(deriveSheet({ ...wizard, speciesId: "genasi", lineageId: "air" }, 1)!.speed).toBe(35);
    expect(stepIssues({ ...wizard, speciesId: "kenku", speciesSkills: ["arcana"] }, 2)).toContain("speciesSkills");
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
    const barbarian = { ...fighter, classId: "barbarian" as const, classEquipment: "A" as const };
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
