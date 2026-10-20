import { describe, expect, it } from "vitest";
import { abilityModifier, encounterBudget, proficiencyBonus, sampleCreatures, suggestEncounters } from "./rules";

describe("character calculations", () => {
  it("uses floor rounding for ability modifiers, including odd scores below 10", () => {
    expect(abilityModifier(15)).toBe(2);
    expect(abilityModifier(9)).toBe(-1);
  });

  it("calculates proficiency bonus from total character level", () => {
    expect(proficiencyBonus(1)).toBe(2);
    expect(proficiencyBonus(5)).toBe(3);
    expect(proficiencyBonus(17)).toBe(6);
  });
});

describe("2024 encounter budgets", () => {
  it("sums per-character budgets for mixed-level parties", () => {
    expect(encounterBudget([3, 3, 4, 5], "moderate")).toBe(225 * 2 + 375 + 750);
  });

  it("suggests combinations that never exceed the chosen budget", () => {
    const suggestions = suggestEncounters(sampleCreatures, [1, 1, 1, 1], "low", () => 0.37);
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions.every(({ totalXp, budget }) => totalXp <= budget)).toBe(true);
    expect(suggestions[0].budget).toBe(200);
  });

  it("returns no suggestion when the catalog has no creature within budget", () => {
    expect(suggestEncounters([{ id: "large", name: "Large", xp: 9999, source: "Custom" }], [1], "low")).toEqual([]);
  });

  it("limits suggestions to a few kinds of creature from large catalogs", () => {
    const catalog = Array.from({ length: 60 }, (_, index) => ({ id: `m${index}`, name: `M${index}`, xp: [10, 25, 50, 100, 200, 450][index % 6], source: "SRD" }));
    let seed = 7;
    const random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    const suggestions = suggestEncounters(catalog, [3, 3, 3, 3], "moderate", random, 4, undefined, { maxKinds: 2, maxCreatures: 8 });
    expect(suggestions.length).toBeGreaterThan(0);
    for (const suggestion of suggestions) {
      expect(suggestion.lines.length).toBeLessThanOrEqual(2);
      expect(suggestion.lines.reduce((total, line) => total + line.quantity, 0)).toBeLessThanOrEqual(8);
      expect(suggestion.totalXp).toBeLessThanOrEqual(suggestion.budget);
      // Creatures too weak to matter for a 900 XP budget (10 XP) are skipped.
      expect(suggestion.lines.every(({ creature }) => creature.xp > 10)).toBe(true);
    }
  });
});
