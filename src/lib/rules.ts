export const abilities = [
  { key: "str", label: "Fuerza" },
  { key: "dex", label: "Destreza" },
  { key: "con", label: "Constitución" },
  { key: "int", label: "Inteligencia" },
  { key: "wis", label: "Sabiduría" },
  { key: "cha", label: "Carisma" },
] as const;

export type AbilityKey = (typeof abilities)[number]["key"];
export type AbilityScores = Record<AbilityKey, number>;
export type Difficulty = "low" | "moderate" | "high";
export type EncounterRole = "frontline" | "damage" | "support" | "control" | "scouting";
export type PartyRoleProfile = Partial<Record<EncounterRole, number>>;

const encounterBudgets: Record<number, Record<Difficulty, number>> = {
  1: { low: 50, moderate: 75, high: 100 },
  2: { low: 100, moderate: 150, high: 200 },
  3: { low: 150, moderate: 225, high: 400 },
  4: { low: 250, moderate: 375, high: 500 },
  5: { low: 500, moderate: 750, high: 1100 },
  6: { low: 600, moderate: 1000, high: 1400 },
  7: { low: 750, moderate: 1300, high: 1700 },
  8: { low: 1000, moderate: 1700, high: 2100 },
  9: { low: 1300, moderate: 2000, high: 2600 },
  10: { low: 1600, moderate: 2300, high: 3100 },
  11: { low: 1900, moderate: 2900, high: 4100 },
  12: { low: 2200, moderate: 3700, high: 4700 },
  13: { low: 2600, moderate: 4200, high: 5400 },
  14: { low: 2900, moderate: 4900, high: 6200 },
  15: { low: 3300, moderate: 5400, high: 7800 },
  16: { low: 3800, moderate: 6100, high: 9800 },
  17: { low: 4500, moderate: 7200, high: 11700 },
  18: { low: 5000, moderate: 8700, high: 14200 },
  19: { low: 5500, moderate: 10700, high: 17200 },
  20: { low: 6400, moderate: 13200, high: 22000 },
};

export interface Creature {
  id: string;
  name: string;
  xp: number;
  source: string;
  /** Optional tactical tags inferred from a stat block. Untagged creatures stay role-neutral. */
  roleTags?: EncounterRole[];
  /** Slug in the 2024 SRD API, when this creature came from the bestiary. */
  monsterSlug?: string;
}

export interface EncounterLine {
  creature: Creature;
  quantity: number;
}

export interface EncounterSuggestion {
  lines: EncounterLine[];
  totalXp: number;
  budget: number;
  difficulty: Difficulty;
  /** Omitted when party roles or monster role tags are unavailable. */
  roleFit?: { score: number; focusedRoles: EncounterRole[]; monsterRoles: EncounterRole[] };
}

export function abilityModifier(score: number): number {
  return Math.floor((score - 10) / 2);
}

export function proficiencyBonus(level: number): number {
  return 2 + Math.floor((Math.min(20, Math.max(1, level)) - 1) / 4);
}

export function encounterBudget(levels: number[], difficulty: Difficulty): number {
  return levels.reduce((total, level) => {
    const safeLevel = Math.min(20, Math.max(1, Math.floor(level)));
    return total + encounterBudgets[safeLevel][difficulty];
  }, 0);
}

function buildOneSuggestion(
  creatures: Creature[],
  budget: number,
  random: () => number,
  partyRoles?: PartyRoleProfile,
): EncounterSuggestion | null {
  const viable = creatures.filter((creature) => creature.xp > 0 && creature.xp <= budget);
  if (!viable.length) return null;

  let best: EncounterSuggestion | null = null;
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const lines = new Map<string, EncounterLine>();
    let remaining = budget;
    let totalXp = 0;
    let count = 0;
    while (count < 20) {
      const options = viable.filter((creature) => creature.xp <= remaining);
      if (!options.length) break;
      const hasPartyRoles = partyRoles && Object.values(partyRoles).some((count) => typeof count === "number" && count > 0);
      const weights = options.map((option) => {
        if (!hasPartyRoles || !option.roleTags?.length) return 1;
        return 1 + option.roleTags.reduce((weight, role) => {
          const count = partyRoles[role];
          return weight + (count === undefined ? 0 : count > 0 ? 0.15 : 0.85);
        }, 0);
      });
      const weightTotal = weights.reduce((sum, weight) => sum + weight, 0);
      let pick = random() * weightTotal;
      let optionIndex = 0;
      while (optionIndex < weights.length - 1 && pick >= weights[optionIndex]) {
        pick -= weights[optionIndex];
        optionIndex += 1;
      }
      const creature = options[optionIndex];
      const existing = lines.get(creature.id);
      if (existing) existing.quantity += 1;
      else lines.set(creature.id, { creature, quantity: 1 });
      remaining -= creature.xp;
      totalXp += creature.xp;
      count += 1;
      if (remaining <= budget * 0.08 && random() > 0.45) break;
    }
    if (!count) continue;
    const suggestion: EncounterSuggestion = { lines: [...lines.values()], totalXp, budget, difficulty: "moderate" };
    const roleFit = assessEncounterRoles(suggestion.lines, partyRoles);
    if (roleFit) suggestion.roleFit = roleFit;
    const rank = (candidate: EncounterSuggestion) => {
      const xpFit = candidate.totalXp / budget;
      return xpFit + (candidate.roleFit ? candidate.roleFit.score / 100 * 0.12 : 0);
    };
    if (!best || rank(suggestion) > rank(best)) best = suggestion;
    if (totalXp >= budget * 0.9) break;
  }
  return best;
}

function assessEncounterRoles(lines: EncounterLine[], partyRoles?: PartyRoleProfile): EncounterSuggestion["roleFit"] {
  if (!partyRoles || !Object.values(partyRoles).some((count) => typeof count === "number" && count > 0)) return undefined;
  const monsterRoles = [...new Set(lines.flatMap(({ creature }) => creature.roleTags ?? []))];
  if (!monsterRoles.length) return undefined;
  const knownRoles = monsterRoles.filter((role) => partyRoles[role] !== undefined);
  if (!knownRoles.length) return undefined;
  const focusedRoles = knownRoles.filter((role) => partyRoles[role] === 0);
  // Prefer tagged threats that exercise lanes the party has less coverage for, while XP
  // remains the primary difficulty control and the score only breaks close comparisons.
  const score = Math.round((focusedRoles.length / knownRoles.length) * 100);
  return { score, focusedRoles, monsterRoles };
}

export function suggestEncounters(
  creatures: Creature[],
  levels: number[],
  difficulty: Difficulty,
  random: () => number = Math.random,
  limit = 4,
  partyRoles?: PartyRoleProfile,
): EncounterSuggestion[] {
  const budget = encounterBudget(levels, difficulty);
  if (!levels.length || !creatures.length || budget <= 0) return [];

  const suggestions: EncounterSuggestion[] = [];
  const seen = new Set<string>();
  for (let index = 0; index < limit * 5 && suggestions.length < limit; index += 1) {
    const suggestion = buildOneSuggestion(creatures, budget, random, partyRoles);
    if (!suggestion) break;
    suggestion.difficulty = difficulty;
    const key = suggestion.lines
      .map(({ creature, quantity }) => `${creature.id}:${quantity}`)
      .sort()
      .join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    suggestions.push(suggestion);
  }
  return suggestions.sort((a, b) => {
    const rank = (candidate: EncounterSuggestion) => candidate.totalXp / budget
      + (candidate.roleFit ? candidate.roleFit.score / 100 * 0.12 : 0);
    return rank(b) - rank(a);
  });
}

export const sampleCreatures: Creature[] = [
  { id: "sample-25", name: "Amenaza menor", xp: 25, source: "Ejemplo editable" },
  { id: "sample-50", name: "Enemigo ligero", xp: 50, source: "Ejemplo editable" },
  { id: "sample-100", name: "Escaramuzador", xp: 100, source: "Ejemplo editable" },
  { id: "sample-200", name: "Combatiente", xp: 200, source: "Ejemplo editable" },
  { id: "sample-450", name: "Oponente peligroso", xp: 450, source: "Ejemplo editable" },
  { id: "sample-700", name: "Rival formidable", xp: 700, source: "Ejemplo editable" },
  { id: "sample-1100", name: "Jefe de guarida", xp: 1100, source: "Ejemplo editable" },
];
