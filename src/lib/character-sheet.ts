/** Derived character sheet values for characters built with the 2024 step-by-step creator. */
import { abilities, abilityModifier, proficiencyBonus, type AbilityKey, type AbilityScores } from "./rules";
import {
  armorTable, canMasterWeapon, findBackground, findClass, findSpecies, POINT_BUY_BUDGET, pointBuyCost, skills, STANDARD_ARRAY, weaponMasteryCount,
  type BackgroundId, type ClassId, type FeatId, type MagicInitiateList, type MasteryId, type SkillKey, type SpeciesId, type Text, type WeaponId,
  type WeaponProperty, weaponTable,
} from "./dnd2024";
import { featInfo, type FightingStyleId, type LevelFeatId } from "./levelup-data";

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
}

/** Choices made in the creator. Everything on the sheet is derived from these. */
export interface CharacterBuild {
  version: 1;
  classId: ClassId;
  useSubclass: boolean;
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
  /** Kinds of weapons whose mastery property the character can use; builds saved before this field have none. */
  weaponMasteries?: WeaponId[];
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
    ...levelChoices(build, level).flatMap((choice) => choice.feat?.id === "skilled" ? choice.feat.skills ?? [] : [])])];
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

  // Level 1: maximum Hit Die; later levels use what was rolled, or the fixed average (half the die + 1).
  const perLevel = cls.hitDie / 2 + 1;
  const hpPerLevelBonus = (sp.hpPerLevel ?? 0) + (feats.includes("tough") ? 2 : 0);
  let hitPoints = Math.max(1, cls.hitDie + mod("con")) + hpPerLevelBonus;
  for (let current = 2; current <= safeLevel; current += 1) {
    const gained = choices.find((choice) => choice.level === current)?.hp ?? perLevel;
    hitPoints += Math.max(1, gained + mod("con")) + hpPerLevelBonus;
  }

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
  if (equipment.armor && feats.includes("defense")) armorClass += 1;

  const lineage = sp.lineages?.find((item) => item.id === build.lineageId);
  const proficient = new Set(proficientSkills(build, safeLevel));
  const expertise = new Set([...build.expertise, ...choices.flatMap((choice) => choice.expertise ?? [])].filter((skill) => proficient.has(skill)));
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

/** Whether the chosen masteries are distinct, allowed for the class and exactly as many as it has at `level`. */
export function validWeaponMasteries(build: Pick<CharacterBuild, "classId" | "weaponMasteries">, level: number): boolean {
  const chosen = build.weaponMasteries ?? [];
  return chosen.length === weaponMasteryCount(build.classId, level) && new Set(chosen).size === chosen.length
    && chosen.every((id) => canMasterWeapon(build.classId, id));
}

export interface SheetAttack {
  name: Text; bonus: number; dice: string; modifier: number; type: Text;
  mastery?: MasteryId;
  /** Tactical Master (Fighter 9): properties that can replace the weapon's own on an attack. */
  masteryAlternatives?: MasteryId[];
}

const tacticalMasterOptions: MasteryId[] = ["push", "sap", "slow"];

/** Weapons in the chosen class and background gear, then any other mastered weapon, with attack bonus, damage and mastery. */
export function attackList(build: CharacterBuild, sheet: DerivedSheet): SheetAttack[] {
  const cls = findClass(build.classId);
  if (!cls) return [];
  const classGear = cls.equipment.find((option) => option.id === build.classEquipment) ?? cls.equipment[0];
  const backgroundGear = findBackground(build.backgroundId)?.equipment.find((option) => option.id === build.backgroundEquipment);
  const training = cls.weapons.en;
  const restriction = /with the (Light|Finesse)(?: or (Light|Finesse))? property/.exec(training)?.slice(1).filter(Boolean).map((word) => word.toLowerCase()) ?? [];
  const str = abilityModifier(sheet.scores.str);
  const dex = abilityModifier(sheet.scores.dex);
  const mastered = new Set((build.weaponMasteries ?? []).filter((id) => canMasterWeapon(build.classId, id)));
  const tacticalMaster = build.classId === "fighter" && sheet.level >= 9;
  return [...new Set([...(classGear.weapons ?? []), ...(backgroundGear?.weapons ?? []), ...mastered])].map((id) => {
    const weapon = weaponTable[id];
    const modifier = weapon.ranged ? dex : weapon.properties.includes("finesse") ? Math.max(str, dex) : str;
    const trained = weapon.martial
      ? /Martial/.test(training) && (restriction.length === 0 || restriction.some((property) => weapon.properties.includes(property as WeaponProperty)))
      : /Simple/.test(training);
    const attack: SheetAttack = { name: weapon.name, bonus: modifier + (trained ? sheet.proficiency : 0), dice: weapon.dice, modifier, type: weapon.type };
    if (!mastered.has(id)) return attack;
    const alternatives = tacticalMaster ? tacticalMasterOptions.filter((option) => option !== weapon.mastery) : [];
    return { ...attack, mastery: weapon.mastery, ...(alternatives.length ? { masteryAlternatives: alternatives } : {}) };
  });
}

/** Problems that block finishing each step; an empty list means the step is complete. */
export function stepIssues(build: CharacterBuild, step: number, level = 1): string[] {
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
  if (step === 4 && !validWeaponMasteries(build, level)) issues.push("weaponMasteries");
  if (step === 6 && build.languages.length !== 2) issues.push("languages");
  return issues;
}
