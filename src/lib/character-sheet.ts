/** Derived character sheet values for characters built with the 2024 step-by-step creator. */
import { abilities, abilityModifier, proficiencyBonus, type AbilityKey, type AbilityScores } from "@/lib/rules";
import {
  armorTable, findBackground, findClass, findSpecies, POINT_BUY_BUDGET, pointBuyCost, skills, STANDARD_ARRAY,
  type BackgroundId, type ClassId, type FeatId, type MagicInitiateList, type SkillKey, type SpeciesId,
} from "@/lib/dnd2024";

export type AbilityMethod = "standard" | "pointBuy" | "rolled";
export type BonusMode = "plus2plus1" | "plus1x3";

/** Choices made in the creator. Everything on the sheet is derived from these. */
export interface CharacterBuild {
  version: 1;
  classId: ClassId;
  useSubclass: boolean;
  backgroundId: BackgroundId;
  speciesId: SpeciesId;
  lineageId?: string;
  abilityMethod: AbilityMethod;
  /** Scores before background increases. */
  baseScores: AbilityScores;
  /** Results of 4d6-drop-lowest rolls, kept so the assignment can be changed. */
  rolledPool?: number[];
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

export function roll4d6DropLowest(random: () => number = Math.random): number {
  const dice = Array.from({ length: 4 }, () => 1 + Math.floor(random() * 6)).sort((a, b) => a - b);
  return dice[1] + dice[2] + dice[3];
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

export function finalScores(build: CharacterBuild): AbilityScores {
  const bonus = backgroundBonuses(build);
  return Object.fromEntries(abilities.map(({ key }) => [key, Math.min(20, build.baseScores[key] + (bonus[key] ?? 0))])) as AbilityScores;
}

/** Feat granted by the background plus the Human's Versatile feat, if any. */
export function characterFeats(build: CharacterBuild): FeatId[] {
  const feats: FeatId[] = [];
  const background = findBackground(build.backgroundId);
  if (background) feats.push(background.feat);
  if (findSpecies(build.speciesId)?.originFeat && build.speciesFeat) feats.push(build.speciesFeat);
  return feats;
}

export function proficientSkills(build: CharacterBuild): SkillKey[] {
  const background = findBackground(build.backgroundId);
  return [...new Set([...(background?.skills ?? []), ...build.speciesSkills, ...build.classSkills,
    ...(characterFeats(build).includes("skilled") ? build.featSkills : [])])];
}

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
  feats: FeatId[];
}

export function deriveSheet(build: CharacterBuild, level: number): DerivedSheet | null {
  const cls = findClass(build.classId);
  const bg = findBackground(build.backgroundId);
  const sp = findSpecies(build.speciesId);
  if (!cls || !bg || !sp) return null;
  const safeLevel = Math.min(20, Math.max(1, Math.floor(level)));
  const scores = finalScores(build);
  const mod = (key: AbilityKey) => abilityModifier(scores[key]);
  const pb = proficiencyBonus(safeLevel);
  const feats = characterFeats(build);

  // Level 1: maximum Hit Die; later levels use the fixed average (half the die + 1).
  const perLevel = cls.hitDie / 2 + 1;
  const hpPerLevelBonus = sp.hpPerLevel ?? 0;
  let hitPoints = Math.max(1, cls.hitDie + mod("con")) + hpPerLevelBonus;
  for (let current = 2; current <= safeLevel; current += 1) hitPoints += Math.max(1, perLevel + mod("con")) + hpPerLevelBonus;

  const equipment = cls.equipment.find((option) => option.id === build.classEquipment) ?? cls.equipment[0];
  let armorClass = 10 + mod("dex");
  let armorNote = "";
  if (equipment.armor) {
    const armor = armorTable[equipment.armor];
    const dex = armor.dexCap === null ? mod("dex") : Math.min(mod("dex"), armor.dexCap);
    armorClass = armor.base + dex;
    armorNote = armor.name.en;
  } else if (cls.unarmored === "barbarian") {
    armorClass = 10 + mod("dex") + mod("con");
    armorNote = "Unarmored Defense";
  } else if (cls.unarmored === "monk") {
    armorClass = 10 + mod("dex") + mod("wis");
    armorNote = "Unarmored Defense";
  }
  if (equipment.shield) armorClass += 2;

  const lineage = sp.lineages?.find((item) => item.id === build.lineageId);
  const proficient = new Set(proficientSkills(build));
  const expertise = new Set(build.expertise.filter((skill) => proficient.has(skill)));
  const skillValues = Object.fromEntries((Object.keys(skills) as SkillKey[]).map((skill) => {
    const isProficient = proficient.has(skill);
    const isExpert = expertise.has(skill);
    return [skill, { proficient: isProficient, expertise: isExpert, bonus: mod(skills[skill]) + (isExpert ? pb * 2 : isProficient ? pb : 0) }];
  })) as DerivedSheet["skills"];
  const saves = Object.fromEntries(abilities.map(({ key }) => {
    const isProficient = cls.saves.includes(key);
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
    initiative: mod("dex") + (feats.includes("alert") ? pb : 0),
    speed: lineage?.speed ?? sp.speed,
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

/** Problems that block finishing each step; an empty list means the step is complete. */
export function stepIssues(build: CharacterBuild, step: number): string[] {
  const issues: string[] = [];
  const cls = findClass(build.classId);
  const sp = findSpecies(build.speciesId);
  if (step === 2 && sp?.lineages?.length && !sp.lineages.some((item) => item.id === build.lineageId)) issues.push("lineage");
  if (step === 2 && sp?.skillChoice && build.speciesSkills.length !== sp.skillChoice.count) issues.push("speciesSkills");
  if (step === 2 && sp?.originFeat && !build.speciesFeat) issues.push("speciesFeat");
  if (step === 3 && !validBaseScores(build)) issues.push("scores");
  if (step === 3 && !validBonuses(build)) issues.push("bonuses");
  if (step === 4 && cls && build.classSkills.length !== cls.skillCount) issues.push("classSkills");
  if (step === 4 && characterFeats(build).includes("skilled") && build.featSkills.length !== 3) issues.push("featSkills");
  if (step === 4 && cls?.expertiseAtLevel1 && build.expertise.length !== cls.expertiseAtLevel1) issues.push("expertise");
  if (step === 6 && build.languages.length !== 2) issues.push("languages");
  return issues;
}
