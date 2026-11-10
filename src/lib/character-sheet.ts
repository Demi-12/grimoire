/** Derived character sheet values for characters built with the 2024 step-by-step creator. */
import { abilities, abilityModifier, proficiencyBonus, type AbilityKey, type AbilityScores } from "./rules";
import {
  armorTable, findBackground, findClass, findSpecies, POINT_BUY_BUDGET, pointBuyCost, skills, STANDARD_ARRAY,
  type BackgroundId, type ClassId, type FeatId, type MagicInitiateList, type SkillKey, type SpeciesId, type Text, type WeaponProperty, weaponTable,
} from "./dnd2024";
import { effectsOf, type Effect } from "./effects";
import { classFeatures, featInfo, SUBCLASS_LEVEL, subclassFeatures, type Feature, type FightingStyleId, type LevelFeatId, type Progression } from "./levelup-data";
import { findBookSubclass } from "./subclasses";

export type AbilityMethod = "standard" | "pointBuy" | "rolled";
export type BonusMode = "plus2plus1" | "plus1x3";

/** A feat picked while leveling up, with whatever it asks you to decide. */
export interface FeatPick {
  id: LevelFeatId;
  /** The +1 some feats give (Grappler, Epic Boons). */
  ability?: AbilityKey;
  /** Skilled: three extra skills. */
  skills?: SkillKey[];
  /** Magic Initiate: which spell list. */
  list?: MagicInitiateList;
}

/** Everything the player decided when reaching one level (2-20). Nothing is stored for choices that level does not offer. */
export interface LevelUpChoice {
  level: number;
  /** Hit Die result when the player rolled; omitted means the fixed average. */
  hp?: number;
  /** Ability Score Improvement: +2 to one score or +1 to two. */
  asi?: Partial<Record<AbilityKey, number>>;
  /** Feat taken instead of raising scores (or the Epic Boon at level 19). */
  feat?: FeatPick;
  fightingStyle?: FightingStyleId;
  expertise?: SkillKey[];
  /** New skill proficiencies a feature lets the player choose (Primal Knowledge, Bonus Proficiencies). */
  skills?: SkillKey[];
}

/** Choices made in the creator. Everything on the sheet is derived from these. */
export interface CharacterBuild {
  version: 1;
  classId: ClassId;
  useSubclass: boolean;
  /** Player's Handbook subclass picked from the list (an id in subclasses.ts); its features are tracked once subclasses.ts lists them. */
  subclassId?: string;
  /** Name of a subclass from outside the SRD, typed by the player. */
  customSubclass?: string;
  /** One entry per level gained after level 1, added by the level-up guide. */
  levelUps?: LevelUpChoice[];
  backgroundId: BackgroundId;
  speciesId: SpeciesId;
  lineageId?: string;
  abilityMethod: AbilityMethod;
  /** Scores before background increases. */
  baseScores: AbilityScores;
  /** Results of 4d6-drop-lowest rolls, kept so the assignment can be changed. Rolled once per character: never replaced. */
  rolledPool?: number[];
  /** The four dice behind each rolled score, in the same order as rolledPool. */
  rolledDice?: number[][];
  bonusMode: BonusMode;
  /** plus2plus1: [ability +2, ability +1]; plus1x3: the background's three abilities. */
  bonusAbilities: AbilityKey[];
  classSkills: SkillKey[];
  speciesSkills: SkillKey[];
  /** Human Versatile origin feat. */
  speciesFeat?: FeatId;
  featSkills: SkillKey[];
  magicInitiateList?: MagicInitiateList;
  expertise: SkillKey[];
  /** Two standard languages besides Common (indices into standardLanguages). */
  languages: number[];
  classEquipment: "A" | "B" | "C";
  backgroundEquipment: "A" | "B";
  alignment: number;
  appearance: string;
}

export const emptyScores: AbilityScores = { str: 8, dex: 8, con: 8, int: 8, wis: 8, cha: 8 };

/** Four d6, highest first; the score is the sum of the first three. */
export function roll4d6(random: () => number = Math.random): { dice: number[]; total: number } {
  const dice = Array.from({ length: 4 }, () => 1 + Math.floor(random() * 6)).sort((a, b) => b - a);
  return { dice, total: dice[0] + dice[1] + dice[2] };
}

export function roll4d6DropLowest(random: () => number = Math.random): number {
  return roll4d6(random).total;
}

/** The six rolls of the "Roll 4d6" method, in the order they were rolled. */
export function rollAbilityPool(random: () => number = Math.random): { pool: number[]; dice: number[][] } {
  const rolls = Array.from({ length: 6 }, () => roll4d6(random));
  return { pool: rolls.map((roll) => roll.total), dice: rolls.map((roll) => roll.dice) };
}

export function pointBuySpent(scores: AbilityScores): number {
  return abilities.reduce((total, { key }) => total + (pointBuyCost[scores[key]] ?? Infinity), 0);
}

/** Whether the base scores follow the chosen generation method. */
export function validBaseScores(build: Pick<CharacterBuild, "abilityMethod" | "baseScores" | "rolledPool">): boolean {
  const values = abilities.map(({ key }) => build.baseScores[key]);
  const sameMultiset = (pool: readonly number[]) => [...pool].sort((a, b) => a - b).join() === [...values].sort((a, b) => a - b).join();
  if (build.abilityMethod === "standard") return sameMultiset(STANDARD_ARRAY);
  if (build.abilityMethod === "rolled") return !!build.rolledPool && build.rolledPool.length === 6 && sameMultiset(build.rolledPool);
  return values.every((value) => value >= 8 && value <= 15) && pointBuySpent(build.baseScores) <= POINT_BUY_BUDGET;
}

/** Background increase per ability; maximum score at creation is 20. */
export function backgroundBonuses(build: Pick<CharacterBuild, "bonusMode" | "bonusAbilities" | "backgroundId">): Partial<Record<AbilityKey, number>> {
  const background = findBackground(build.backgroundId);
  const allowed = new Set(background?.abilities ?? []);
  const result: Partial<Record<AbilityKey, number>> = {};
  if (build.bonusMode === "plus2plus1") {
    const [plusTwo, plusOne] = build.bonusAbilities;
    if (plusTwo && allowed.has(plusTwo)) result[plusTwo] = 2;
    if (plusOne && plusOne !== plusTwo && allowed.has(plusOne)) result[plusOne] = 1;
  } else {
    for (const ability of background?.abilities ?? []) result[ability] = 1;
  }
  return result;
}

export function validBonuses(build: Pick<CharacterBuild, "bonusMode" | "bonusAbilities" | "backgroundId">): boolean {
  const total = Object.values(backgroundBonuses(build)).reduce((sum, value) => sum + (value ?? 0), 0);
  return total === 3;
}

/** Level-up choices that apply at the given level, lowest level first. */
export function levelChoices(build: Pick<CharacterBuild, "levelUps">, level = 20): LevelUpChoice[] {
  return (build.levelUps ?? []).filter((choice) => choice.level >= 2 && choice.level <= level).sort((a, b) => a.level - b.level);
}

/** Scores after the background bonus and every Ability Score Improvement up to `level` (20 cap, 30 for an Epic Boon). */
export function finalScores(build: CharacterBuild, level = 20): AbilityScores {
  const bonus = backgroundBonuses(build);
  const scores = Object.fromEntries(abilities.map(({ key }) => [key, Math.min(20, build.baseScores[key] + (bonus[key] ?? 0))])) as AbilityScores;
  for (const choice of levelChoices(build, level)) {
    const cap = choice.feat && featInfo(choice.feat.id).category === "epicBoon" ? 30 : 20;
    const gains: Partial<Record<AbilityKey, number>> = { ...choice.asi };
    if (choice.feat?.ability) gains[choice.feat.ability] = (gains[choice.feat.ability] ?? 0) + 1;
    for (const key of Object.keys(gains) as AbilityKey[]) scores[key] = Math.min(cap, scores[key] + (gains[key] ?? 0));
  }
  return scores;
}

/** Feat granted by the background plus the Human's Versatile feat, if any. */
export function characterFeats(build: CharacterBuild): FeatId[] {
  const feats: FeatId[] = [];
  const background = findBackground(build.backgroundId);
  if (background) feats.push(background.feat);
  if (findSpecies(build.speciesId)?.originFeat && build.speciesFeat) feats.push(build.speciesFeat);
  return feats;
}

/** Every feat the character has at `level`: origin feats, feats taken at level-ups, Fighting Styles and Epic Boons. */
export function allFeats(build: CharacterBuild, level = 20): LevelFeatId[] {
  return [...characterFeats(build), ...levelChoices(build, level).flatMap((choice) => [choice.feat?.id, choice.fightingStyle].filter((id): id is LevelFeatId => !!id))];
}

export function proficientSkills(build: CharacterBuild, level = 20): SkillKey[] {
  const background = findBackground(build.backgroundId);
  return [...new Set([...(background?.skills ?? []), ...build.speciesSkills, ...build.classSkills,
    ...(characterFeats(build).includes("skilled") ? build.featSkills : []),
    ...levelChoices(build, level).flatMap((choice) => [...(choice.feat?.id === "skilled" ? choice.feat.skills ?? [] : []), ...(choice.skills ?? [])])])];
}

// --- Features and their effects ------------------------------------------------------------------------------------

/** Features of the character's subclass by level: the SRD one, a Player's Handbook one whose features are listed, or none. */
export function subclassProgression(build: Pick<CharacterBuild, "classId" | "useSubclass" | "subclassId">): Progression | undefined {
  if (build.useSubclass) return subclassFeatures[build.classId];
  return findBookSubclass(build.classId, build.subclassId)?.features;
}

/** Class and subclass features gained exactly at `level` (2-20). */
export function featuresAt(build: CharacterBuild, level: number): { class: Feature[]; subclass: Feature[] } {
  return {
    class: level >= 2 ? classFeatures[build.classId][level] ?? [] : [],
    subclass: level >= SUBCLASS_LEVEL ? subclassProgression(build)?.[level] ?? [] : [],
  };
}

/** A mechanical effect together with the name of the feature, feat or species that grants it. */
export interface GrantedEffect { source: Text; effect: Effect }

/** Every effect the character has at `level`: class, subclass, species and feats. */
export function grantedEffects(build: CharacterBuild, level: number): GrantedEffect[] {
  const cls = findClass(build.classId);
  const sp = findSpecies(build.speciesId);
  const granted: GrantedEffect[] = [];
  const add = (source: Text, effects: Effect[] | undefined) => { for (const effect of effects ?? []) granted.push({ source, effect }); };
  for (const feature of [...(cls?.features ?? []), ...(sp?.traits ?? [])]) add(feature.name, feature.effects);
  for (let current = 2; current <= level; current += 1) {
    const gained = featuresAt(build, current);
    for (const feature of [...gained.class, ...gained.subclass]) add(feature.name, feature.effects);
  }
  for (const id of allFeats(build, level)) add(featInfo(id).name, featInfo(id).effects);
  return granted;
}

const hpPerLevel = (effects: Effect[]) => effectsOf(effects, "hpPerLevel").reduce((sum, effect) => sum + effect.amount, 0);

/** Hit Points added per character level on top of the Hit Die (Dwarven Toughness, Tough, Draconic Resilience). */
export const hpPerLevelBonus = (build: CharacterBuild, level: number): number =>
  hpPerLevel(grantedEffects(build, level).map((granted) => granted.effect));

export interface DerivedSheet {
  level: number;
  scores: AbilityScores;
  proficiency: number;
  hitPoints: number;
  hitDice: string;
  armorClass: number;
  armorNote: string;
  initiative: number;
  speed: number;
  darkvision?: number;
  passivePerception: number;
  saves: Record<AbilityKey, { proficient: boolean; bonus: number }>;
  skills: Record<SkillKey, { proficient: boolean; expertise: boolean; bonus: number }>;
  spellSaveDc?: number;
  spellAttack?: number;
  gold: number;
  feats: LevelFeatId[];
}

export function deriveSheet(build: CharacterBuild, level: number): DerivedSheet | null {
  const cls = findClass(build.classId);
  const bg = findBackground(build.backgroundId);
  const sp = findSpecies(build.speciesId);
  if (!cls || !bg || !sp) return null;
  const safeLevel = Math.min(20, Math.max(1, Math.floor(level)));
  const scores = finalScores(build, safeLevel);
  const mod = (key: AbilityKey) => abilityModifier(scores[key]);
  const pb = proficiencyBonus(safeLevel);
  const feats = allFeats(build, safeLevel);
  const choices = levelChoices(build, safeLevel);
  const granted = grantedEffects(build, safeLevel);
  const effects = granted.map((entry) => entry.effect);

  // Level 1: maximum Hit Die; later levels use what was rolled, or the fixed average (half the die + 1).
  const perLevel = cls.hitDie / 2 + 1;
  let hitPoints = Math.max(1, cls.hitDie + mod("con"));
  for (let current = 2; current <= safeLevel; current += 1) {
    const gained = choices.find((choice) => choice.level === current)?.hp ?? perLevel;
    hitPoints += Math.max(1, gained + mod("con"));
  }
  hitPoints += hpPerLevel(effects) * safeLevel + effectsOf(effects, "hpBonus").reduce((sum, effect) => sum + effect.amount, 0);

  const equipment = cls.equipment.find((option) => option.id === build.classEquipment) ?? cls.equipment[0];
  let armorClass = 10 + mod("dex");
  let armorNote = "";
  if (equipment.armor) {
    const armor = armorTable[equipment.armor];
    const dex = armor.dexCap === null ? mod("dex") : Math.min(mod("dex"), armor.dexCap);
    armorClass = armor.base + dex;
    armorNote = armor.name.en;
  } else {
    // Unarmored Defense, Draconic Resilience…: the best formula wins.
    for (const { source, effect } of granted) {
      if (effect.kind !== "unarmoredDefense") continue;
      const value = 10 + mod("dex") + effect.add.reduce((sum, key) => sum + mod(key), 0);
      if (value > armorClass) { armorClass = value; armorNote = source.en; }
    }
  }
  if (equipment.shield) armorClass += 2;
  for (const effect of effectsOf(effects, "acBonus")) if (!effect.whileArmored || equipment.armor) armorClass += effect.amount;

  const lineage = sp.lineages?.find((item) => item.id === build.lineageId);
  const proficient = new Set(proficientSkills(build, safeLevel));
  const expertise = new Set([...build.expertise, ...choices.flatMap((choice) => choice.expertise ?? [])].filter((skill) => proficient.has(skill)));
  const skillValues = Object.fromEntries((Object.keys(skills) as SkillKey[]).map((skill) => {
    const isProficient = proficient.has(skill);
    const isExpert = expertise.has(skill);
    return [skill, { proficient: isProficient, expertise: isExpert, bonus: mod(skills[skill]) + (isExpert ? pb * 2 : isProficient ? pb : 0) }];
  })) as DerivedSheet["skills"];
  const saveProficiencies = new Set<AbilityKey>([...cls.saves, ...effectsOf(effects, "saveProficiency").flatMap((effect) => effect.abilities)]);
  const saves = Object.fromEntries(abilities.map(({ key }) => {
    const isProficient = saveProficiencies.has(key);
    return [key, { proficient: isProficient, bonus: mod(key) + (isProficient ? pb : 0) }];
  })) as DerivedSheet["saves"];

  const background = bg.equipment.find((option) => option.id === build.backgroundEquipment) ?? bg.equipment[0];
  const casting = cls.spellcasting;
  return {
    level: safeLevel,
    scores,
    proficiency: pb,
    hitPoints,
    hitDice: `${safeLevel}d${cls.hitDie}`,
    armorClass,
    armorNote,
    initiative: mod("dex") + effectsOf(effects, "initiativeBonus").length * pb,
    speed: (lineage?.speed ?? sp.speed) + effectsOf(effects, "speedBonus").reduce((sum, effect) => sum + effect.amount, 0),
    darkvision: lineage?.darkvision ?? sp.darkvision,
    passivePerception: 10 + skillValues.perception.bonus,
    saves,
    skills: skillValues,
    spellSaveDc: casting ? 8 + pb + mod(casting.ability) : undefined,
    spellAttack: casting ? pb + mod(casting.ability) : undefined,
    gold: equipment.gold + background.gold,
    feats,
  };
}

export interface SheetAttack { name: Text; bonus: number; dice: string; modifier: number; type: Text }

/** Weapons in the chosen class and background gear with their attack bonus and damage. */
export function attackList(build: CharacterBuild, sheet: DerivedSheet): SheetAttack[] {
  const cls = findClass(build.classId);
  if (!cls) return [];
  const classGear = cls.equipment.find((option) => option.id === build.classEquipment) ?? cls.equipment[0];
  const backgroundGear = findBackground(build.backgroundId)?.equipment.find((option) => option.id === build.backgroundEquipment);
  const training = cls.weapons.en;
  const restriction = /with the (Light|Finesse)(?: or (Light|Finesse))? property/.exec(training)?.slice(1).filter(Boolean).map((word) => word.toLowerCase()) ?? [];
  const str = abilityModifier(sheet.scores.str);
  const dex = abilityModifier(sheet.scores.dex);
  return [...new Set([...(classGear.weapons ?? []), ...(backgroundGear?.weapons ?? [])])].map((id) => {
    const weapon = weaponTable[id];
    const modifier = weapon.ranged ? dex : weapon.properties.includes("finesse") ? Math.max(str, dex) : str;
    const trained = weapon.martial
      ? /Martial/.test(training) && (restriction.length === 0 || restriction.some((property) => weapon.properties.includes(property as WeaponProperty)))
      : /Simple/.test(training);
    return { name: weapon.name, bonus: modifier + (trained ? sheet.proficiency : 0), dice: weapon.dice, modifier, type: weapon.type };
  });
}

/**
 * Whether the Human's Versatile feat repeats the background's Origin feat. Only Magic Initiate may be taken twice here, with
 * another spell list: other feats aren't repeatable (Alert would double its Initiative bonus) and the sheet tracks one Skilled pick.
 */
export function duplicatesBackgroundFeat(build: Pick<CharacterBuild, "backgroundId" | "speciesFeat" | "magicInitiateList">, feat = build.speciesFeat): boolean {
  const background = findBackground(build.backgroundId);
  if (!feat || feat !== background?.feat) return false;
  return feat !== "magicInitiate" || (build.magicInitiateList ?? "wizard") === background.featList;
}

/** Problems that block finishing each step; an empty list means the step is complete. */
export function stepIssues(build: CharacterBuild, step: number): string[] {
  const issues: string[] = [];
  const cls = findClass(build.classId);
  const sp = findSpecies(build.speciesId);
  if (step === 2 && sp?.lineages?.length && !sp.lineages.some((item) => item.id === build.lineageId)) issues.push("lineage");
  if (step === 2 && sp?.skillChoice && build.speciesSkills.length !== sp.skillChoice.count) issues.push("speciesSkills");
  const bg = findBackground(build.backgroundId);
  if (step === 2 && sp?.originFeat && !build.speciesFeat) issues.push("speciesFeat");
  if (step === 2 && sp?.originFeat && build.speciesFeat && duplicatesBackgroundFeat(build)) issues.push("duplicateFeat");
  if (step === 3 && build.abilityMethod === "rolled" && !build.rolledPool?.length) issues.push("roll");
  else if (step === 3 && !validBaseScores(build)) issues.push("scores");
  if (step === 3 && !validBonuses(build)) issues.push("bonuses");
  if (step === 4 && cls) {
    // Skills already granted by the background or species can't be chosen again; the player picks another one instead.
    const earlier = new Set<SkillKey>([...(bg?.skills ?? []), ...build.speciesSkills]);
    const options = new Set<SkillKey>(cls.skillOptions.length ? cls.skillOptions : (Object.keys(skills) as SkillKey[]));
    const classSkills = new Set(build.classSkills);
    if (classSkills.size !== cls.skillCount || build.classSkills.length !== cls.skillCount
      || build.classSkills.some((skill) => earlier.has(skill) || !options.has(skill))) issues.push("classSkills");
    if (characterFeats(build).includes("skilled")) {
      const taken = new Set<SkillKey>([...earlier, ...build.classSkills]);
      if (new Set(build.featSkills).size !== 3 || build.featSkills.length !== 3 || build.featSkills.some((skill) => taken.has(skill))) issues.push("featSkills");
    }
    if (cls.expertiseAtLevel1) {
      const proficient = new Set(proficientSkills(build, 1));
      if (new Set(build.expertise).size !== cls.expertiseAtLevel1 || build.expertise.length !== cls.expertiseAtLevel1
        || build.expertise.some((skill) => !proficient.has(skill))) issues.push("expertise");
    }
  }
  if (step === 6 && build.languages.length !== 2) issues.push("languages");
  return issues;
}
