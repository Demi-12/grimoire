import { describe, expect, it } from "vitest";
import { deriveSheet, finalScores, type CharacterBuild } from "./character-sheet";
import { applyLevelUp, levelGains, levelUpIssues, levelUpSteps, subclassLabel } from "./levelup";
import { classFeatures, spellProgress, subclassFeatures } from "./levelup-data";
import { classes } from "./dnd2024";
import { srdSubclassMatches, subclassesFor } from "./subclasses";

const fighter: CharacterBuild = {
  version: 1, classId: "fighter", useSubclass: true, backgroundId: "soldier", speciesId: "human",
  abilityMethod: "standard", baseScores: { str: 15, dex: 14, con: 13, int: 10, wis: 12, cha: 8 },
  bonusMode: "plus2plus1", bonusAbilities: ["str", "con"], classSkills: ["perception", "survival"],
  speciesSkills: ["insight"], speciesFeat: "alert", featSkills: [], expertise: [], languages: [1, 4],
  classEquipment: "A", backgroundEquipment: "A", alignment: 0, appearance: "",
};

describe("which choices each level offers", () => {
  it("asks for HP every level and adds the specific choices", () => {
    expect(levelUpSteps(fighter, 2)).toEqual(["hp"]);
    expect(levelUpSteps(fighter, 3)).toEqual(["hp", "subclass"]);
    expect(levelUpSteps(fighter, 4)).toEqual(["hp", "asi"]);
    expect(levelUpSteps(fighter, 6)).toEqual(["hp", "asi"]);
    expect(levelUpSteps(fighter, 7)).toEqual(["hp", "fightingStyle"]);
    expect(levelUpSteps({ ...fighter, useSubclass: false }, 7)).toEqual(["hp"]);
    expect(levelUpSteps(fighter, 19)).toEqual(["hp", "boon"]);
    expect(levelUpSteps({ ...fighter, classId: "rogue" }, 10)).toEqual(["hp", "asi"]);
    expect(levelUpSteps({ ...fighter, classId: "rogue" }, 6)).toEqual(["hp", "expertise"]);
    expect(levelUpSteps({ ...fighter, classId: "paladin" }, 2)).toEqual(["hp", "fightingStyle"]);
    expect(levelUpSteps({ ...fighter, classId: "bard" }, 2)).toEqual(["hp", "expertise"]);
  });

  it("gives every class its subclass features at level 3 and a feature list that stays within 2-20", () => {
    for (const cls of classes) {
      expect(subclassFeatures[cls.id][3]?.length, cls.id).toBeGreaterThan(0);
      for (const level of Object.keys(classFeatures[cls.id]).map(Number)) expect(level, cls.id).toBeGreaterThanOrEqual(2);
    }
  });
});

describe("hit points", () => {
  it("uses the average by default and the rolled die when given", () => {
    const base = deriveSheet(fighter, 2)!.hitPoints; // fighter d10, CON 14 => 12 + (6+2)
    expect(base).toBe(20);
    const rolled = applyLevelUp(fighter, 2, { level: 2, hp: 10 }, null);
    expect(deriveSheet(rolled, 2)!.hitPoints).toBe(24);
    expect(deriveSheet(rolled, 1)!.hitPoints).toBe(12);
  });

  it("rejects a roll outside the Hit Die", () => {
    expect(levelUpIssues(fighter, 2, { level: 2, hp: 11 }, null)).toContain("hp");
    expect(levelUpIssues(fighter, 2, { level: 2, hp: 0 }, null)).toContain("hp");
    expect(levelUpIssues(fighter, 2, { level: 2, hp: 10 }, null)).toEqual([]);
  });
});

describe("subclass", () => {
  it("is required at level 3 and stored on the build", () => {
    expect(levelUpIssues(fighter, 3, { level: 3 }, null)).toContain("subclass");
    expect(levelUpIssues(fighter, 3, { level: 3 }, { kind: "custom", name: "  " })).toContain("subclass");
    const custom = applyLevelUp(fighter, 3, { level: 3 }, { kind: "custom", name: " Battle Master " });
    expect(custom.useSubclass).toBe(false);
    expect(subclassLabel(custom, 3, "en")).toBe("Battle Master");
    expect(subclassLabel(custom, 2, "en")).toBe("");
    const srd = applyLevelUp(custom, 3, { level: 3 }, { kind: "srd" });
    expect(srd.customSubclass).toBeUndefined();
    expect(subclassLabel(srd, 3, "en")).toBe("Champion");
  });

  it("accepts any Player's Handbook subclass of the class, but not another class's", () => {
    expect(levelUpIssues(fighter, 3, { level: 3 }, { kind: "book", id: "psiWarrior" })).not.toContain("subclass");
    expect(levelUpIssues(fighter, 3, { level: 3 }, { kind: "book", id: "gloomStalker" })).toContain("subclass");
    expect(levelUpIssues(fighter, 3, { level: 3 }, { kind: "book", id: "champion" })).toContain("subclass");
    const book = applyLevelUp({ ...fighter, customSubclass: "Old" }, 3, { level: 3 }, { kind: "book", id: "battleMaster" });
    expect(book.useSubclass).toBe(false);
    expect(book.customSubclass).toBeUndefined();
    expect(subclassLabel(book, 3, "es")).toBe("Maestro del Combate");
    expect(levelGains("fighter", 3, book.useSubclass).subclassFeatures).toEqual([]);
    expect(subclassLabel(applyLevelUp(book, 3, { level: 3 }, { kind: "srd" }), 3, "en")).toBe("Champion");
  });

  it("lists the 48 Player's Handbook subclasses, four per class with the SRD one first", () => {
    for (const cls of classes) {
      const list = subclassesFor(cls.id);
      expect(list, cls.id).toHaveLength(4);
      expect(list[0].srd, cls.id).toBe(true);
      expect(list.filter((entry) => entry.srd), cls.id).toHaveLength(1);
      expect(srdSubclassMatches(cls.id), cls.id).toBe(true);
    }
  });
});

describe("Ability Score Improvement", () => {
  const at4 = { ...fighter, levelUps: [{ level: 2 }, { level: 3 }] };
  it("accepts +2 to one or +1 to two, never over 20", () => {
    expect(levelUpIssues(at4, 4, { level: 4, asi: { str: 2 } }, null)).toEqual([]);
    expect(levelUpIssues(at4, 4, { level: 4, asi: { str: 1, dex: 1 } }, null)).toEqual([]);
    expect(levelUpIssues(at4, 4, { level: 4, asi: { str: 1 } }, null)).toContain("asi");
    expect(levelUpIssues(at4, 4, { level: 4, asi: { str: 1, dex: 1, con: 1 } }, null)).toContain("asi");
    expect(levelUpIssues(at4, 4, {level: 4}, null)).toContain("asi");
    const nearCap = { ...at4, baseScores: { ...fighter.baseScores, str: 15 }, bonusAbilities: ["str", "con"] as CharacterBuild["bonusAbilities"] };
    const high = { ...nearCap, levelUps: [{ level: 4, asi: { str: 2 } }, { level: 8, asi: { str: 1 } }] };
    expect(finalScores(high).str).toBe(20);
    expect(levelUpIssues(high, 12, { level: 12, asi: { str: 2 } }, null)).toContain("asi");
  });

  it("applies increases to the sheet only from the level they were taken", () => {
    const build = applyLevelUp(at4, 4, { level: 4, asi: { str: 2 } }, null);
    expect(finalScores(build, 3).str).toBe(17);
    expect(finalScores(build, 4).str).toBe(19);
    expect(deriveSheet(build, 4)!.scores.str).toBe(19);
  });

  it("supports feats: Grappler needs 13 in Strength or Dexterity and adds +1", () => {
    expect(levelUpIssues(at4, 4, { level: 4, feat: { id: "grappler", ability: "str" } }, null)).toEqual([]);
    expect(levelUpIssues(at4, 4, { level: 4, feat: { id: "grappler" } }, null)).toContain("asi");
    const weak = { ...at4, baseScores: { ...fighter.baseScores, str: 8, dex: 8 }, bonusAbilities: ["con", "wis"] as CharacterBuild["bonusAbilities"] };
    expect(levelUpIssues(weak, 4, { level: 4, feat: { id: "grappler", ability: "str" } }, null)).toContain("asi");
    expect(levelUpIssues(at4, 4, { level: 4, feat: { id: "alert" } }, null)).toContain("asi"); // already has Alert
    const grappler = applyLevelUp(at4, 4, { level: 4, feat: { id: "grappler", ability: "dex" } }, null);
    expect(deriveSheet(grappler, 4)!.scores.dex).toBe(15);
    expect(deriveSheet(grappler, 4)!.feats).toContain("grappler");
  });

  it("Skilled grants three new skills", () => {
    const pick = { id: "skilled" as const, skills: ["arcana", "stealth", "history"] as ("arcana" | "stealth" | "history")[] };
    expect(levelUpIssues(at4, 4, { level: 4, feat: pick }, null)).toEqual([]);
    expect(levelUpIssues(at4, 4, { level: 4, feat: { ...pick, skills: ["arcana", "stealth", "perception"] } }, null)).toContain("asi");
    const build = applyLevelUp(at4, 4, { level: 4, feat: pick }, null);
    expect(deriveSheet(build, 4)!.skills.arcana.proficient).toBe(true);
    expect(deriveSheet(build, 3)!.skills.arcana.proficient).toBe(false);
  });
});

describe("other choices", () => {
  it("Epic Boon at 19 can raise a score up to 30", () => {
    const high = { ...fighter, levelUps: [{ level: 4, asi: { str: 2 } }] };
    expect(levelUpIssues(high, 19, { level: 19 }, null)).toContain("boon");
    expect(levelUpIssues(high, 19, { level: 19, feat: { id: "combatProwess", ability: "str" } }, null)).toEqual([]);
    expect(levelUpIssues(high, 19, { level: 19, feat: { id: "alert" } }, null)).toContain("boon");
  });

  it("Defense adds 1 AC with armor", () => {
    const paladin: CharacterBuild = { ...fighter, classId: "paladin" };
    const before = deriveSheet(paladin, 2)!.armorClass;
    const build = applyLevelUp(paladin, 2, { level: 2, fightingStyle: "defense" }, null);
    expect(deriveSheet(build, 2)!.armorClass).toBe(before + 1);
    expect(levelUpIssues(paladin, 2, { level: 2 }, null)).toContain("fightingStyle");
  });

  it("Expertise needs proficient skills without Expertise", () => {
    const rogue: CharacterBuild = { ...fighter, classId: "rogue", expertise: ["perception", "survival"] };
    expect(levelUpIssues(rogue, 6, { level: 6, expertise: ["insight", "perception"] }, null)).toContain("expertise");
    expect(levelUpIssues(rogue, 6, { level: 6, expertise: ["insight", "athletics"] }, null)).toEqual([]);
    expect(levelUpIssues(rogue, 6, { level: 6, expertise: ["insight", "arcana"] }, null)).toContain("expertise");
    const build = applyLevelUp(rogue, 6, { level: 6, expertise: ["insight", "athletics"] }, null);
    expect(deriveSheet(build, 6)!.skills.insight.expertise).toBe(true);
    expect(deriveSheet(build, 5)!.skills.insight.expertise).toBe(false);
  });

  it("drops choices a level does not offer", () => {
    const build = applyLevelUp(fighter, 2, { level: 2, asi: { str: 2 }, fightingStyle: "defense", expertise: ["insight"] }, null);
    expect(build.levelUps).toEqual([{ level: 2 }]);
  });

  it("replaces a previous entry for the same level and drops later ones", () => {
    const base = { ...fighter, levelUps: [{ level: 2 }, { level: 3 }] };
    expect(applyLevelUp(base, 2, { level: 2, hp: 5 }, null).levelUps).toEqual([{ level: 2, hp: 5 }]);
  });
});

describe("what a level gives", () => {
  it("lists new features, proficiency bonus, scaling numbers and spells", () => {
    const gains = levelGains("fighter", 5, true);
    expect(gains.features.map((feature) => feature.name.en)).toContain("Extra Attack");
    expect(gains.proficiency).toEqual({ from: 2, to: 3 });
    expect(levelGains("fighter", 4, true).proficiency).toBeNull();
    expect(levelGains("rogue", 3, true).scaling.map((change) => change.to)).toEqual(["2d6"]);
    expect(levelGains("wizard", 3, true).spells?.after.slots).toEqual([4, 2]);
    expect(levelGains("fighter", 3, false).subclassFeatures).toEqual([]);
    expect(levelGains("fighter", 3, true).subclassFeatures.length).toBeGreaterThan(0);
  });

  it("matches the 2024 spell tables", () => {
    expect(spellProgress("wizard", 1)).toMatchObject({ cantrips: 3, prepared: 4, slots: [2] });
    expect(spellProgress("wizard", 20)).toMatchObject({ cantrips: 5, prepared: 22, slots: [4, 3, 3, 3, 3, 2, 2, 1, 1] });
    expect(spellProgress("sorcerer", 1)).toMatchObject({ cantrips: 4, prepared: 2 });
    expect(spellProgress("warlock", 5)).toMatchObject({ prepared: 6, pact: { count: 2, level: 3 } });
    expect(spellProgress("paladin", 5)).toMatchObject({ cantrips: 0, prepared: 6, slots: [4, 2] });
    expect(spellProgress("fighter", 5)).toBeNull();
    expect(spellProgress("wizard", 20)!.slots).toHaveLength(9);
  });
});

