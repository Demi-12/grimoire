import { describe, expect, it } from "vitest";
import { deriveSheet, finalScores, type CharacterBuild } from "./character-sheet";
import { applyLevelUp, asiFeatOptions, chosenSubclassId, fightingStyleOptions, levelGains, levelUpIssues, levelUpSteps, skillOptions, subclassLabel, unlockedFeatures, withSubclass } from "./levelup";
import { asiFeats, classFeatures, epicBoons, fightingStyles, spellProgress, subclassFeatures } from "./levelup-data";
import { classes } from "./dnd2024";
import { srdSubclassMatches, subclassesFor, subclassTracked } from "./subclasses";

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
  it("is required at level 3 and stored on the build; an old typed-in one still shows", () => {
    expect(levelUpIssues(fighter, 3, { level: 3 }, null)).toContain("subclass");
    const old = { ...fighter, useSubclass: false, customSubclass: "Rune Knight" };
    expect(subclassLabel(old, 3, "en")).toBe("Rune Knight");
    expect(subclassLabel(old, 2, "en")).toBe("");
    expect(chosenSubclassId(old)).toBeNull();
    const srd = applyLevelUp(old, 3, { level: 3 }, { kind: "srd" });
    expect(srd.customSubclass).toBeUndefined();
    expect(subclassLabel(srd, 3, "en")).toBe("Champion");
    expect(chosenSubclassId(srd)).toBe("champion");
  });

  it("accepts any Player's Handbook subclass of the class, but not another class's", () => {
    expect(levelUpIssues(fighter, 3, { level: 3 }, { kind: "book", id: "psiWarrior" })).not.toContain("subclass");
    expect(levelUpIssues(fighter, 3, { level: 3 }, { kind: "book", id: "gloomStalker" })).toContain("subclass");
    expect(levelUpIssues(fighter, 3, { level: 3 }, { kind: "book", id: "champion" })).toContain("subclass");
    const book = applyLevelUp({ ...fighter, customSubclass: "Old" }, 3, { level: 3 }, { kind: "book", id: "battleMaster" });
    expect(book.useSubclass).toBe(false);
    expect(book.customSubclass).toBeUndefined();
    expect(subclassLabel(book, 3, "es")).toBe("Maestro del Combate");
    expect(levelGains(book, 3).subclassFeatures.map((feature) => feature.name.en)).toEqual(["Combat Superiority", "Student of War"]);
    expect(levelGains(book, 7).subclassFeatures.map((feature) => feature.name.en)).toEqual(["Know Your Enemy"]);
    expect(unlockedFeatures(book, 3).map((feature) => feature.name.en)).toContain("Student of War");
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

  it("tracks the features of all 48, gained at the same levels within each class", () => {
    for (const cls of classes) {
      const list = subclassesFor(cls.id);
      for (const entry of list) expect(subclassTracked(entry), entry.id).toBe(true);
      const progressions = list.map((entry) => entry.srd ? subclassFeatures[cls.id] : entry.features!);
      for (const [index, progression] of progressions.entries()) expect(progression[3]?.length, list[index].id).toBeGreaterThan(0);
      expect(new Set(progressions.map((progression) => Object.keys(progression).join())).size, `${cls.id} feature levels`).toBe(1);
    }
  });

  it("applies the effects of Player's Handbook subclass features", () => {
    const fighter2 = { ...fighter, levelUps: [{ level: 2 }] };
    expect(levelUpSteps(withSubclass(fighter2, { kind: "book", id: "battleMaster" }), 3)).toContain("skills");
    expect(skillOptions(withSubclass(fighter2, { kind: "book", id: "battleMaster" }), 3)).not.toContain("arcana");
    const ranger2 = { ...fighter2, classId: "ranger" as const, useSubclass: false, classSkills: ["survival", "stealth", "nature"] as CharacterBuild["classSkills"] };
    expect(skillOptions(withSubclass(ranger2, { kind: "book", id: "feyWanderer" }), 3)).toEqual(["deception", "performance", "persuasion"]);
    const dancer = { ...fighter2, classId: "bard" as const, classEquipment: "B" as const, baseScores: { str: 8, dex: 15, con: 13, int: 10, wis: 12, cha: 14 } };
    const plain = deriveSheet(applyLevelUp(dancer, 3, { level: 3, skills: [] }, { kind: "srd" }), 3)!.armorClass;
    const dancing = deriveSheet(applyLevelUp(dancer, 3, { level: 3 }, { kind: "book", id: "dance" }), 3)!.armorClass;
    expect(dancing - plain).toBe(2);
  });
});

describe("Ability Score Improvement", () => {
  const at4 = { ...fighter, levelUps: [{ level: 2 }, { level: 3 }] };
  it("offers every Player's Handbook feat and checks armor and spellcasting prerequisites", () => {
    expect(asiFeats.length).toBe(52);
    expect(fightingStyles.length).toBe(10);
    expect(epicBoons.length).toBe(12);
    const blocked = (build: CharacterBuild, id: string) => asiFeatOptions(build, 4).find((option) => option.id === id)?.blocked;
    expect(blocked(at4, "heavyArmorMaster")).toBe(false);
    expect(blocked(at4, "warCaster")).toBe(true);
    const wizard = { ...at4, classId: "wizard" as const };
    expect(blocked(wizard, "warCaster")).toBe(false);
    expect(blocked(wizard, "moderatelyArmored")).toBe(true);
    const knight = applyLevelUp({ ...at4, levelUps: [{ level: 2 }] }, 3, { level: 3, skills: ["athletics"] }, { kind: "book", id: "eldritchKnight" });
    expect(blocked(knight, "warCaster")).toBe(false);
    const withSkilled = { ...at4, levelUps: [{ level: 2 }, { level: 3 }, { level: 4, feat: { id: "skilled" as const, skills: ["arcana", "history", "nature"] as CharacterBuild["classSkills"] } }] };
    expect(asiFeatOptions(withSkilled, 6).find((option) => option.id === "skilled")?.blocked).toBe(false);
  });

  it("applies the Hit Point and speed bonuses of feats and boons", () => {
    const at19 = { ...fighter, levelUps: Array.from({ length: 17 }, (_, index) => ({ level: index + 2 })) };
    const base = deriveSheet(at19, 18)!;
    const boon = deriveSheet({ ...at19, levelUps: [...at19.levelUps, { level: 19, feat: { id: "fortitude" as const, ability: "con" as const } }] }, 19)!;
    expect(boon.hitPoints - deriveSheet({ ...at19, levelUps: [...at19.levelUps, { level: 19, feat: { id: "truesight" as const, ability: "con" as const } }] }, 19)!.hitPoints).toBe(40);
    const speedy = deriveSheet({ ...at4, levelUps: [...at4.levelUps, { level: 4, feat: { id: "speedy" as const, ability: "dex" as const } }] }, 4)!;
    expect(speedy.speed - base.speed).toBe(10);
  });

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
    const gains = levelGains(fighter, 5);
    expect(gains.features.map((feature) => feature.name.en)).toContain("Extra Attack");
    expect(gains.proficiency).toEqual({ from: 2, to: 3 });
    expect(levelGains(fighter, 4).proficiency).toBeNull();
    expect(levelGains({ ...fighter, classId: "rogue" }, 3).scaling.map((change) => change.to)).toEqual(["2d6"]);
    expect(levelGains({ ...fighter, classId: "wizard" }, 3).spells?.after.slots).toEqual([4, 2]);
    expect(levelGains({ ...fighter, useSubclass: false }, 3).subclassFeatures).toEqual([]);
    expect(levelGains(fighter, 3).subclassFeatures.length).toBeGreaterThan(0);
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


describe("feature effects", () => {
  const bard: CharacterBuild = { ...fighter, classId: "bard", useSubclass: false, classSkills: ["perception", "survival", "history"] };

  it("turns a subclass's choice into a step once that subclass is picked", () => {
    expect(levelUpSteps(bard, 3)).toEqual(["hp", "subclass"]);
    expect(levelUpSteps(withSubclass(bard, { kind: "srd" }), 3)).toEqual(["hp", "subclass", "skills"]);
    expect(levelUpIssues(bard, 3, { level: 3 }, { kind: "srd" })).toEqual(["skills"]);
    expect(levelUpIssues(bard, 3, { level: 3 }, { kind: "book", id: "valor" })).toEqual([]);
    expect(levelUpIssues(bard, 3, { level: 3, skills: ["arcana", "nature", "perception"] }, { kind: "srd" })).toEqual(["skills"]); // already proficient
    const lore = applyLevelUp(bard, 3, { level: 3, skills: ["arcana", "nature", "stealth"] }, { kind: "srd" });
    expect(lore.useSubclass).toBe(true);
    expect(lore.levelUps?.at(-1)?.skills).toEqual(["arcana", "nature", "stealth"]);
    expect(deriveSheet(lore, 3)!.skills.stealth.proficient).toBe(true);
    expect(deriveSheet(lore, 2)!.skills.stealth.proficient).toBe(false);
  });

  it("limits a class's skill pick to its list (Primal Knowledge)", () => {
    const barbarian: CharacterBuild = { ...fighter, classId: "barbarian", classSkills: ["athletics", "survival"] };
    expect(levelUpSteps(barbarian, 3)).toEqual(["hp", "subclass", "skills"]);
    expect(skillOptions(barbarian, 3)).toEqual(["animalHandling", "nature", "perception"]); // Soldier already gives Intimidation
    expect(levelUpIssues(barbarian, 3, { level: 3, skills: ["arcana"] }, { kind: "srd" })).toEqual(["skills"]);
    expect(levelUpIssues(barbarian, 3, { level: 3, skills: ["nature"] }, { kind: "srd" })).toEqual([]);
  });

  it("offers the Champion's second Fighting Style, minus the one already taken", () => {
    const champion = { ...fighter, levelUps: [{ level: 2, fightingStyle: "defense" as const }] };
    expect(fightingStyleOptions(champion, 7).find((option) => option.id === "defense")?.blocked).toBe(true);
    expect(levelUpIssues(champion, 7, { level: 7, fightingStyle: "defense" }, null)).toEqual(["fightingStyle"]);
    expect(levelUpIssues(champion, 7, { level: 7, fightingStyle: "archery" }, null)).toEqual([]);
  });

  it("applies Draconic Resilience: Hit Points from level 3 and scaly Armor Class", () => {
    const sorcerer: CharacterBuild = {
      ...fighter, classId: "sorcerer", useSubclass: false, baseScores: { str: 8, dex: 14, con: 13, int: 10, wis: 12, cha: 15 }, bonusAbilities: ["dex", "con"],
    };
    expect(deriveSheet(sorcerer, 3)!.armorClass).toBe(13); // DEX 16
    const draconic = applyLevelUp(sorcerer, 3, { level: 3 }, { kind: "srd" });
    expect(deriveSheet(draconic, 2)!.hitPoints).toBe(8 + 6);
    expect(deriveSheet(draconic, 3)!.hitPoints).toBe(8 + 2 * 6 + 3);
    expect(deriveSheet(draconic, 3)!.armorClass).toBe(10 + 3 + 2);
    expect(deriveSheet(draconic, 3)!.armorNote).toBe("Draconic Resilience");
    expect(deriveSheet({ ...draconic, useSubclass: false }, 3)!.armorClass).toBe(13);
  });

  it("grants saving throw proficiencies from class features", () => {
    const rogue = deriveSheet({ ...fighter, classId: "rogue" }, 15)!;
    expect(rogue.saves.wis.proficient).toBe(true);
    expect(deriveSheet({ ...fighter, classId: "rogue" }, 14)!.saves.wis.proficient).toBe(false);
    const monk = deriveSheet({ ...fighter, classId: "monk" }, 14)!;
    expect(Object.values(monk.saves).every((save) => save.proficient)).toBe(true);
  });

  it("lists features from the tracked subclass only", () => {
    const names = (build: CharacterBuild) => unlockedFeatures(build, 7).map((feature) => feature.name.en);
    expect(names(fighter)).toContain("Additional Fighting Style");
    expect(names({ ...fighter, useSubclass: false, subclassId: "battleMaster" })).not.toContain("Additional Fighting Style");
  });
});
