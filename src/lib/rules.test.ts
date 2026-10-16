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
});
