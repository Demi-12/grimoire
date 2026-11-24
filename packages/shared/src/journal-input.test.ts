import { describe, expect, it } from "vitest";
import { parseCreatureInput, parseEncounterChange, parseEncounterInput, parsePreferencesInput } from "./permissions.js";

const encounter = {
  title: "Emboscada goblin", notes: "", difficulty: "moderate", budget: 750, totalXp: 700, partyLevels: [3, 3, 3, 3],
  lines: [{ name: "Goblin", xp: 50, count: 4, monsterSlug: "goblin", cr: 0.25, type: "humanoid" }],
};

describe("parseCreatureInput", () => {
  it("accepts a custom creature and an SRD one", () => {
    expect(parseCreatureInput({ name: " Troll ", xp: 1800, source: "Catálogo propio" })).toMatchObject({ name: "Troll", monsterSlug: null, roleTags: [] });
    expect(parseCreatureInput({ name: "Goblin", xp: 50, source: "D&D 2024", monsterSlug: "goblin", cr: 0.25, type: "humanoid", roleTags: ["damage", "damage"] }))
      .toMatchObject({ monsterSlug: "goblin", cr: 0.25, roleTags: ["damage"] });
  });
  it("rejects out-of-range or unknown values", () => {
    expect(parseCreatureInput({ name: "", xp: 10 })).toBeNull();
    expect(parseCreatureInput({ name: "X", xp: 0 })).toBeNull();
    expect(parseCreatureInput({ name: "X", xp: 1.5 })).toBeNull();
    expect(parseCreatureInput({ name: "X", xp: 10, roleTags: ["tank"] })).toBeNull();
    expect(parseCreatureInput({ name: "X", xp: 10, cr: 99 })).toBeNull();
  });
});

describe("parseEncounterInput", () => {
  it("defaults to a planned encounter", () => {
    expect(parseEncounterInput(encounter)).toMatchObject({ status: "planned", lines: [{ name: "Goblin", count: 4, monsterSlug: "goblin" }] });
  });
  it("rejects empty creature lists, bad difficulty, bad status and oversized parties", () => {
    expect(parseEncounterInput({ ...encounter, lines: [] })).toBeNull();
    expect(parseEncounterInput({ ...encounter, difficulty: "deadly" })).toBeNull();
    expect(parseEncounterInput({ ...encounter, status: "archived" })).toBeNull();
    expect(parseEncounterInput({ ...encounter, partyLevels: [0] })).toBeNull();
    expect(parseEncounterInput({ ...encounter, lines: [{ name: "Goblin", xp: 50, count: 0 }] })).toBeNull();
    expect(parseEncounterInput({ ...encounter, title: " " })).toBeNull();
  });
});

describe("parsePreferencesInput", () => {
  it("accepts a partial valid update", () => {
    expect(parsePreferencesInput({ theme: "dark" })).toEqual({ theme: "dark" });
  });
  it("rejects empty or unknown values", () => {
    expect(parsePreferencesInput({})).toBeNull();
    expect(parsePreferencesInput({ locale: "fr" })).toBeNull();
  });
});

describe("parseEncounterChange", () => {
  it("keeps only the fields that were sent, trimmed", () => {
    expect(parseEncounterChange({ title: "  Emboscada  " })).toEqual({ title: "Emboscada", notes: undefined, status: undefined });
    expect(parseEncounterChange({ notes: "", status: "played" })).toEqual({ title: undefined, notes: "", status: "played" });
  });
  it("rejects an empty change, wrong types, an empty title, oversized text and unknown statuses", () => {
    expect(parseEncounterChange(null)).toBeNull();
    expect(parseEncounterChange("title")).toBeNull();
    expect(parseEncounterChange({})).toBeNull();
    expect(parseEncounterChange({ title: "   " })).toBeNull();
    expect(parseEncounterChange({ title: null })).toBeNull();
    expect(parseEncounterChange({ notes: 3 })).toBeNull();
    expect(parseEncounterChange({ title: "a".repeat(81) })).toBeNull();
    expect(parseEncounterChange({ notes: "a".repeat(2001) })).toBeNull();
    expect(parseEncounterChange({ status: "won" })).toBeNull();
  });
});
