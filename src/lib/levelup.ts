/**
 * Rules for gaining a level (2024): which choices a level offers, whether they are valid and how to record them.
 * The guide in components/level-up.tsx only collects choices; everything it shows about the result comes from here.
 */
import { proficiencyBonus, type AbilityKey } from "./rules";
import { findClass, say, type ClassId, type SkillKey, type Text } from "./dnd2024";
import { allFeats, finalScores, levelChoices, proficientSkills, type CharacterBuild, type FeatPick, type LevelUpChoice } from "./character-sheet";
import {
  asiFeats, BOON_LEVEL, classFeatures, classScaling, epicBoons, expertiseGrant, featInfo, fightingStyleLevel, isAsiLevel,
  spellProgress, SUBCLASS_LEVEL, subclassFeatures, type ExpertiseGrant, type Feature, type LevelFeatId, type Scaling,
  type SpellProgress,
} from "./levelup-data";
import { findBookSubclass } from "./subclasses";

export type LevelStep = "hp" | "subclass" | "asi" | "boon" | "fightingStyle" | "expertise";
export type SubclassPick = { kind: "srd" } | { kind: "book"; id: string } | { kind: "custom"; name: string };

export const MAX_LEVEL = 20;
export const MAX_CUSTOM_SUBCLASS = 60;

/** Choice steps this level asks for, in the order the guide shows them. */
export function levelUpSteps(build: CharacterBuild, level: number): LevelStep[] {
  const steps: LevelStep[] = ["hp"];
  if (level === SUBCLASS_LEVEL) steps.push("subclass");
  if (level === BOON_LEVEL) steps.push("boon");
  else if (isAsiLevel(build.classId, level)) steps.push("asi");
  if (fightingStyleLevel(build.classId, level, build.useSubclass)) steps.push("fightingStyle");
  if (expertiseGrant(build.classId, level)) steps.push("expertise");
  return steps;
}

export const expertiseFor = (build: CharacterBuild, level: number): ExpertiseGrant | null => expertiseGrant(build.classId, level);

/** Average hit points for a level before the Constitution modifier: half the die, rounded up. */
export const averageHitDie = (hitDie: number) => hitDie / 2 + 1;

/** Skills that can still receive Expertise at this level. */
export function expertiseOptions(build: CharacterBuild, level: number): SkillKey[] {
  const grant = expertiseGrant(build.classId, level);
  if (!grant) return [];
  const already = new Set<SkillKey>([...build.expertise, ...levelChoices(build, level - 1).flatMap((choice) => choice.expertise ?? [])]);
  return proficientSkills(build, level - 1).filter((skill) => !already.has(skill) && (!grant.from || grant.from.includes(skill)));
}

/** Feats offered with an Ability Score Improvement, minus those the character can't take. */
export function asiFeatOptions(build: CharacterBuild, level: number): { id: LevelFeatId; blocked: boolean }[] {
  const owned = new Set(allFeats(build, level - 1));
  const scores = finalScores(build, level - 1);
  return asiFeats.map((id) => {
    const info = featInfo(id);
    const repeatable = id === "skilled";
    const meetsRequirement = !info.requires || info.requires.some((key) => scores[key] >= 13);
    return { id, blocked: (owned.has(id) && !repeatable) || !meetsRequirement };
  });
}

function featPickIssue(build: CharacterBuild, level: number, pick: FeatPick, allowed: readonly LevelFeatId[]): boolean {
  if (!allowed.includes(pick.id)) return true;
  const info = featInfo(pick.id);
  const scores = finalScores(build, level - 1);
  if (info.abilities) {
    if (!pick.ability || !info.abilities.includes(pick.ability)) return true;
    if (scores[pick.ability] >= (info.category === "epicBoon" ? 30 : 20)) return true;
  }
  if (info.category !== "epicBoon" && asiFeatOptions(build, level).find((option) => option.id === pick.id)?.blocked) return true;
  if (pick.id === "skilled") {
    const owned = new Set(proficientSkills(build, level - 1));
    if (!pick.skills || new Set(pick.skills).size !== 3 || pick.skills.some((skill) => owned.has(skill))) return true;
  }
  if (pick.id === "magicInitiate" && !pick.list) return true;
  return false;
}

/** Whether `asi` is a legal +2 / +1 +1 spread that stays within 20. */
function asiValid(build: CharacterBuild, level: number, asi: LevelUpChoice["asi"]): boolean {
  const entries = Object.entries(asi ?? {}).filter(([, amount]) => amount);
  const amounts = entries.map(([, amount]) => amount).sort();
  const shape = amounts.join() === "2" || amounts.join() === "1,1";
  const scores = finalScores(build, level - 1);
  return shape && entries.every(([key, amount]) => scores[key as AbilityKey] + amount <= 20);
}

function subclassPickValid(build: CharacterBuild, pick: SubclassPick | null): boolean {
  if (pick?.kind === "srd") return true;
  if (pick?.kind === "book") return !!findBookSubclass(build.classId, pick.id);
  return pick?.kind === "custom" && !!pick.name.trim();
}

/** Problems that block this level-up, as keys the guide turns into messages. Empty means ready to save. */
export function levelUpIssues(build: CharacterBuild, level: number, choice: LevelUpChoice, subclass: SubclassPick | null): string[] {
  const steps = levelUpSteps(build, level);
  const issues: string[] = [];
  const cls = findClass(build.classId);
  if (choice.hp !== undefined && (!Number.isInteger(choice.hp) || choice.hp < 1 || choice.hp > (cls?.hitDie ?? 12))) issues.push("hp");
  if (steps.includes("subclass") && !subclassPickValid(build, subclass)) issues.push("subclass");
  if (steps.includes("asi")) {
    const usesAsi = Object.values(choice.asi ?? {}).some(Boolean);
    const valid = usesAsi ? !choice.feat && asiValid(build, level, choice.asi) : !!choice.feat && !featPickIssue(build, level, choice.feat, asiFeats);
    if (!valid) issues.push("asi");
  }
  if (steps.includes("boon") && (!choice.feat || featPickIssue(build, level, choice.feat, epicBoons))) issues.push("boon");
  if (steps.includes("fightingStyle") && !choice.fightingStyle) issues.push("fightingStyle");
  if (steps.includes("expertise")) {
    const grant = expertiseGrant(build.classId, level);
    const options = new Set(expertiseOptions(build, level));
    const picked = choice.expertise ?? [];
    if (!grant || new Set(picked).size !== Math.min(grant.count, options.size) || picked.some((skill) => !options.has(skill))) issues.push("expertise");
  }
  return issues;
}

/** Records a level-up on the build. Choices the level doesn't offer are dropped so stale picks can't leak in. */
export function applyLevelUp(build: CharacterBuild, level: number, choice: LevelUpChoice, subclass: SubclassPick | null): CharacterBuild {
  const steps = levelUpSteps(build, level);
  const clean: LevelUpChoice = { level };
  if (choice.hp !== undefined) clean.hp = choice.hp;
  if (steps.includes("asi") && Object.values(choice.asi ?? {}).some(Boolean)) clean.asi = Object.fromEntries(Object.entries(choice.asi ?? {}).filter(([, amount]) => amount)) as LevelUpChoice["asi"];
  if ((steps.includes("asi") && !clean.asi) || steps.includes("boon")) clean.feat = choice.feat;
  if (steps.includes("fightingStyle")) clean.fightingStyle = choice.fightingStyle;
  if (steps.includes("expertise")) clean.expertise = choice.expertise;
  const next: CharacterBuild = { ...build, levelUps: [...(build.levelUps ?? []).filter((entry) => entry.level < level), clean] };
  if (steps.includes("subclass") && subclass) {
    delete next.subclassId;
    delete next.customSubclass;
    next.useSubclass = subclass.kind === "srd";
    if (subclass.kind === "book") next.subclassId = subclass.id;
    if (subclass.kind === "custom") next.customSubclass = subclass.name.trim().slice(0, MAX_CUSTOM_SUBCLASS);
  }
  return next;
}

// --- What a level gives you ----------------------------------------------------------------------------------------

export interface Change { label: Text; from?: string; to: string }
export interface LevelGains {
  features: Feature[];
  subclassFeatures: Feature[];
  proficiency: { from: number; to: number } | null;
  scaling: Change[];
  spells: { before: SpellProgress | null; after: SpellProgress } | null;
  /** Spellcasters remind the player to pick new spells; the app doesn't track spell lists. */
  prepareSpells: boolean;
}

/** Everything the class hands out automatically at `level`; `srdSubclass` says whether the SRD subclass applies. */
export function levelGains(classId: ClassId, level: number, srdSubclass: boolean): LevelGains {
  const before = classScaling(classId, level - 1);
  const after = classScaling(classId, level);
  const changed = after.filter((item: Scaling) => before.find((old) => old.key === item.key)?.value !== item.value)
    .map((item) => ({ label: item.label, from: before.find((old) => old.key === item.key)?.value, to: item.value }));
  const casting = spellProgress(classId, level);
  const previous = spellProgress(classId, level - 1);
  const sameSlots = previous && casting && JSON.stringify(previous) === JSON.stringify(casting);
  return {
    features: classFeatures[classId][level] ?? [],
    subclassFeatures: srdSubclass && level >= SUBCLASS_LEVEL ? subclassFeatures[classId][level] ?? [] : [],
    proficiency: proficiencyBonus(level) !== proficiencyBonus(level - 1) ? { from: proficiencyBonus(level - 1), to: proficiencyBonus(level) } : null,
    scaling: changed,
    spells: casting && !sameSlots ? { before: previous, after: casting } : null,
    prepareSpells: !!casting && !!previous && casting.prepared !== previous.prepared,
  };
}

/** Subclass shown next to the class name, or an empty string while the character has none (before level 3). */
export function subclassLabel(build: CharacterBuild, level: number, locale: "en" | "es"): string {
  if (level < SUBCLASS_LEVEL) return "";
  if (build.useSubclass) return say(findClass(build.classId)?.subclass, locale);
  const book = findBookSubclass(build.classId, build.subclassId);
  if (book) return say(book.name, locale);
  return build.customSubclass?.trim() ?? "";
}

/** Feature names a character has earned by `level`, for the printed sheet: level 1 features, class progression and the SRD subclass. */
export function unlockedFeatures(build: CharacterBuild, level: number): Text[] {
  const cls = findClass(build.classId);
  const names = [...(cls?.features ?? [])];
  for (let current = 2; current <= level; current += 1) {
    names.push(...(classFeatures[build.classId][current] ?? []).map((feature) => feature.name));
    if (build.useSubclass && current >= SUBCLASS_LEVEL) names.push(...(subclassFeatures[build.classId][current] ?? []).map((feature) => feature.name));
  }
  return names;
}
