import { describe, expect, it } from "vitest";
import { inferMonsterRoles } from "./monster-api";
import { legacySlugCandidates, toStatBlock, withoutSupersededCopies, type Open5eCreature } from "./open5e";

/** Shaped like GET https://api.open5e.com/v2/creatures/srd-2024_adult-red-dragon/ (trimmed). */
const dragon: Open5eCreature = {
  key: "srd-2024_adult-red-dragon",
  name: "Adult Red Dragon",
  document: {
    key: "srd-2024", name: "System Reference Document 5.2", display_name: "5.2 SRD",
    publisher: { name: "Wizards of the Coast", key: "wizards-of-the-coast" }, gamesystem: { name: "5th Edition 2024", key: "5e-2024" },
    permalink: "https://dnd.wizards.com/resources/systems-reference-document",
  },
  type: { name: "Dragon", key: "dragon" },
  size: { name: "Huge", key: "huge" },
  challenge_rating: 17,
  proficiency_bonus: null,
  experience_points: 18000,
  speed: { walk: 40, climb: 40, fly: 80, unit: "feet" },
  alignment: "chaotic evil",
  languages: { as_string: "Common, Draconic" },
  armor_class: 19,
  armor_detail: "",
  hit_points: 256,
  hit_dice: "19d12+133",
  ability_scores: { strength: 27, dexterity: 10, constitution: 25, intelligence: 16, wisdom: 13, charisma: 23 },
  modifiers: { strength: 8, dexterity: 0, constitution: 7, intelligence: 3, wisdom: 1, charisma: 6 },
  saving_throws: { strength: 8, dexterity: 6, constitution: 7, intelligence: 3, wisdom: 7, charisma: 6 },
  skill_bonuses: { perception: 13, stealth: 6 },
  passive_perception: 23,
  resistances_and_immunities: {
    damage_immunities_display: "Fire", damage_resistances_display: "", damage_vulnerabilities_display: "",
    condition_immunities: [],
  },
  blindsight_range: 60, darkvision_range: 120, tremorsense_range: null, truesight_range: null,
  actions: [
    { name: "Rend", desc: "*Melee Attack Roll:* +14, reach 10 ft. 13 (1d10 + 8) Slashing damage plus 5 (2d4) Fire damage.", action_type: "ACTION", order_in_statblock: 1, legendary_action_cost: null, usage_limits: null,
      attacks: [{ to_hit_mod: 14, damage_die_count: 1, damage_die_type: "D10", damage_bonus: 8, damage_type: { name: "Slashing", key: "slashing" } }] },
    { name: "Multiattack", desc: "The dragon makes three Rend attacks.", action_type: "ACTION", order_in_statblock: 0, legendary_action_cost: null, usage_limits: null, attacks: [] },
    { name: "Fire Breath", desc: "**Dexterity Saving Throw:** DC 21, each creature in a 60-foot Cone.", action_type: "ACTION", order_in_statblock: 2, legendary_action_cost: null, usage_limits: { type: "RECHARGE_ON_ROLL", param: 5 }, attacks: [] },
    { name: "Pounce", desc: "The dragon moves up to half its Speed, and it makes one Rend attack.", action_type: "LEGENDARY_ACTION", order_in_statblock: 2, legendary_action_cost: 1, usage_limits: null, attacks: [] },
    { name: "Tail Swipe", desc: "A big swipe.", action_type: "LEGENDARY_ACTION", order_in_statblock: 3, legendary_action_cost: 2, usage_limits: null, attacks: [] },
  ],
  traits: [{ name: "Legendary Resistance (4/Day, or 5/Day in Lair)", desc: "If the dragon fails a saving throw, it can choose to succeed instead." }],
  illustration: null,
};

describe("Open5e stat blocks", () => {
  const block = toStatBlock(dragon);

  it("keeps the numbers the sheet and the encounter builder need", () => {
    expect(block).toMatchObject({
      index: "srd-2024_adult-red-dragon", name: "Adult Red Dragon", size: "Huge", type: "dragon", alignment: "chaotic evil",
      hit_points: 256, hit_points_roll: "19d12+133", strength: 27, charisma: 23, challenge_rating: 17, xp: 18000, languages: "Common, Draconic",
      speed: { walk: "40 ft.", climb: "40 ft.", fly: "80 ft." },
      senses: { blindsight: "60 ft.", darkvision: "120 ft.", passive_perception: 23 },
      damage_immunities: ["Fire"], damage_resistances: [],
      source: { key: "srd-2024", name: "5.2 SRD", publisher: "Wizards of the Coast", system: "5e-2024" },
    });
    expect(block.armor_class).toEqual([{ type: "armor", value: 19 }]);
  });

  it("lists only real save proficiencies and the skills", () => {
    expect(block.proficiencies).toEqual([
      { proficiency: { name: "Saving Throw: DEX" }, value: 6 },
      { proficiency: { name: "Saving Throw: WIS" }, value: 7 },
      { proficiency: { name: "Skill: Perception" }, value: 13 },
      { proficiency: { name: "Skill: Stealth" }, value: 6 },
    ]);
  });

  it("orders actions, adds usage limits and legendary costs, and strips Markdown", () => {
    expect(block.actions?.map((action) => action.name)).toEqual(["Multiattack", "Rend", "Fire Breath (Recharge 5–6)"]);
    expect(block.actions?.[2].desc).toBe("Dexterity Saving Throw: DC 21, each creature in a 60-foot Cone.");
    expect(block.actions?.[1]).toMatchObject({ attack_bonus: 14, damage: [{ damage_dice: "1d10+8", damage_type: { name: "Slashing" } }] });
    expect(block.legendary_actions?.map((action) => action.name)).toEqual(["Pounce", "Tail Swipe (Costs 2 Actions)"]);
    expect(block.special_abilities?.[0].name).toBe("Legendary Resistance (4/Day, or 5/Day in Lair)");
    expect(inferMonsterRoles(block)).toContain("damage");
  });

  it("marks hovering fliers and makes illustration URLs absolute", () => {
    const ghost = toStatBlock({ ...dragon, speed: { walk: 0, fly: 40, hover: true, unit: "feet" }, illustration: { file_url: "/static/img/monsters/ghost.png" } });
    expect(ghost.speed).toEqual({ fly: "40 ft. (hover)" });
    expect(ghost.image).toBe("https://api.open5e.com/static/img/monsters/ghost.png");
  });
});

describe("catalog helpers", () => {
  it("hides copies a newer edition of the same book replaces", () => {
    const entries = [
      { name: "Goblin Boss", source: { key: "srd-2024" } },
      { name: "Goblin Boss", source: { key: "srd-2014" } },
      { name: "Lich", source: { key: "srd-2014" } },
      { name: "Aboleth", source: { key: "tob" } },
      { name: "Goblin Boss", source: { key: "tob" } },
    ];
    expect(withoutSupersededCopies(entries)).toEqual([entries[0], entries[2], entries[3], entries[4]]);
  });

  it("resolves old dnd5eapi slugs to the SRD 5.2 first", () => {
    expect(legacySlugCandidates("goblin")).toEqual(["srd-2024_goblin", "srd_goblin"]);
    expect(legacySlugCandidates("tob_aboleth")).toEqual(["tob_aboleth"]);
  });
});
