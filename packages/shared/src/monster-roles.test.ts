import { describe, expect, it } from "vitest";
import type { MonsterAction, MonsterStatBlock } from "./monster-api.js";
import { currentRoleTags, inferMonsterRoles } from "./monster-roles.js";

const bite: MonsterAction = { name: "Bite", desc: "Melee Attack Roll: +4, reach 5 ft. 6 (1d8 + 2) Piercing damage." };
/** A Medium creature with one plain attack, so only the fields under test decide the roles. */
const creature = (stats: Partial<MonsterStatBlock>): MonsterStatBlock => ({
  name: "Test creature", size: "Medium", challenge_rating: 1, armor_class: 13, hit_points: 20, speed: { walk: "30 ft." }, actions: [bite], ...stats,
});
const roles = (stats: Partial<MonsterStatBlock>) => inferMonsterRoles(creature(stats));
const has = (role: string) => (stats: Partial<MonsterStatBlock>) => roles(stats).includes(role as never);
const trait = (name: string, desc: string): Partial<MonsterStatBlock> => ({ special_abilities: [{ name, desc }] });

describe("inferMonsterRoles: frontline", () => {
  const frontline = has("frontline");

  it("compares HP and AC with the median creature of the same rating", () => {
    // Goblin Warrior: armoured for its size, but a typical CR 1/4 creature has 14 HP.
    expect(frontline({ challenge_rating: 0.25, armor_class: 15, hit_points: 10 })).toBe(false);
    // Guard: AC 16 at CR 1/8, three points over the median, with typical hit points.
    expect(frontline({ challenge_rating: 0.125, armor_class: 16, hit_points: 11 })).toBe(true);
  });

  it("needs a durability of 1.2: at CR 5 and AC 15, 117 HP passes and 116 fails", () => {
    expect(frontline({ challenge_rating: 5, armor_class: 15, hit_points: 117 })).toBe(true);
    expect(frontline({ challenge_rating: 5, armor_class: 15, hit_points: 116 })).toBe(false);
  });

  it("weighs each point of AC above or below the median as 8% more or fewer hit points", () => {
    // CR 5: median 97 HP, AC 15. At AC 17, 100 HP is 100/97 × 1.08² ≈ 1.20.
    expect(frontline({ challenge_rating: 5, armor_class: 17, hit_points: 100 })).toBe(true);
    expect(frontline({ challenge_rating: 5, armor_class: 13, hit_points: 117 })).toBe(false);
  });

  it("counts an armoured soldier: AC 3 over the median with at least 70% of its hit points", () => {
    expect(frontline({ challenge_rating: 5, armor_class: 18, hit_points: 68 })).toBe(true);
    expect(frontline({ challenge_rating: 5, armor_class: 18, hit_points: 67 })).toBe(false);
    expect(frontline({ challenge_rating: 5, armor_class: 17, hit_points: 68 })).toBe(false);
  });

  it("counts a Large or bigger melee brute with the median hit points", () => {
    // CR 2: median 47 HP, AC 13.
    const ogre = { challenge_rating: 2, armor_class: 11, hit_points: 50, size: "Large" };
    expect(frontline(ogre)).toBe(true);
    expect(frontline({ ...ogre, hit_points: 46 })).toBe(false);
    expect(frontline({ ...ogre, size: "Medium" })).toBe(false);
    expect(frontline({ ...ogre, actions: [{ name: "Rock", desc: "Ranged Attack Roll: +6, range 60/240 ft. 15 (2d10 + 4) Bludgeoning damage." }] })).toBe(false);
    expect(frontline({ ...ogre, size: "Gargantuan", actions: [{ name: "Slam", desc: "Attack Roll: +6, reach 10 ft. 15 (2d10 + 4) Bludgeoning damage." }] })).toBe(true);
  });

  it("counts a regenerating creature with 80% of the median hit points", () => {
    // Troll: CR 5, 94 HP (median 97), Large but under the median, so only Regeneration puts it in front.
    const troll = {
      challenge_rating: 5, armor_class: 15, hit_points: 94, size: "Large",
      special_abilities: [{ name: "Regeneration", desc: "The troll regains 15 Hit Points at the start of each of its turns." }],
    };
    expect(frontline(troll)).toBe(true);
    expect(frontline({ ...troll, hit_points: 77 })).toBe(false);
    expect(frontline({ ...troll, special_abilities: [] })).toBe(false);
  });

  it("counts a Huge creature with legendary actions and 80% of the median hit points", () => {
    // CR 10: median 153 HP, AC 17.
    const legend = {
      challenge_rating: 10, armor_class: 17, hit_points: 130, size: "Huge",
      legendary_actions: [{ name: "Tail", desc: "The creature makes one Bite attack." }],
    };
    expect(frontline(legend)).toBe(true);
    expect(frontline({ ...legend, legendary_actions: [] })).toBe(false);
    expect(frontline({ ...legend, size: "Medium" })).toBe(false);
    expect(frontline({ ...legend, hit_points: 122 })).toBe(false);
  });

  it("treats a missing rating as CR 1 and reads the best of several armour values", () => {
    expect(frontline({ challenge_rating: undefined, armor_class: 13, hit_points: 41 })).toBe(true);
    expect(frontline({ challenge_rating: undefined, armor_class: 13, hit_points: 40 })).toBe(false);
    expect(frontline({ challenge_rating: 3, hit_points: 52, armor_class: [{ type: "natural" }, { type: "armor", value: 18 }] })).toBe(true);
    expect(frontline({ challenge_rating: 3, hit_points: 52, armor_class: 18 })).toBe(true);
    expect(frontline({ challenge_rating: 3, hit_points: 52, armor_class: undefined })).toBe(false);
  });
});

describe("inferMonsterRoles: support", () => {
  const support = has("support");

  it("calls a spellcaster with healing or buffing spells support", () => {
    // Priest (2024): the support spells sit in a bonus action, not in the Spellcasting trait.
    expect(support({ bonus_actions: [{ name: "Divine Aid (3/Day)", desc: "The priest casts Bless, Dispel Magic, Healing Word, or Lesser Restoration." }] })).toBe(true);
    expect(support({ actions: [{ name: "Spellcasting", desc: ["The cultist casts one of the following spells:", "At will: Light", "1/day: Cure Wounds"] }] })).toBe(true);
    expect(support({ actions: [{ name: "Spellcasting", desc: "The mage casts Fireball or Mage Hand." }] })).toBe(false);
  });

  it("calls healing that reaches another creature support, even as a reaction", () => {
    expect(support({ name: "Priest", actions: [], reactions: [{ name: "Mending Word", desc: "One creature the priest can see regains 7 hit points." }] })).toBe(true);
    expect(support(trait("Life Bond", "A willing creature within 30 feet gains 10 temporary hit points."))).toBe(true);
  });

  it("doesn't call healing itself support, unless it can heal another creature of its choice", () => {
    expect(support({ name: "Troll", ...trait("Regeneration", "The troll regains 15 Hit Points at the start of each of its turns.") })).toBe(false);
    expect(support(trait("Drain", "The creature regains hit points equal to the damage dealt."))).toBe(false);
    expect(support({ name: "Angel", ...trait("Healing Touch", "The angel or one creature of its choice within 5 feet regains 20 hit points.") })).toBe(true);
  });

  it("calls a benefit aimed at allies support", () => {
    expect(support(trait("Leadership", "Each ally within 30 feet of the captain gains a +2 bonus to attack rolls."))).toBe(true);
    expect(support(trait("Aura", "Friendly creatures within 10 feet have advantage on saving throws."))).toBe(true);
  });

  it("only matches whole words: usually and magically are not allies", () => {
    expect(support(trait("Amphibious", "The creature is usually found near water and gains advantage on Stealth checks."))).toBe(false);
    expect(support(trait("Shimmer", "The creature magically gains a bonus to its AC."))).toBe(false);
  });

  it("doesn't count creatures that only profit from allies being near their target", () => {
    expect(support(trait("Pack Tactics", "The wolf has Advantage on attack rolls against a creature if at least one of the wolf's allies is within 5 feet of the creature and the ally doesn't have the Incapacitated condition."))).toBe(false);
    expect(support(trait("Sneak Attack (1/Turn)", "The creature deals an extra 7 (2d6) damage when it hits a target and an ally is within 5 feet of the target."))).toBe(false);
    expect(support(trait("Tactical Strike", "The creature deals extra damage if an ally of the creature is within 5 feet of the target."))).toBe(false);
  });

  it("skips summons, negations and triggers", () => {
    expect(support(trait("Call Wolves", "Two wolves appear, acting as allies of the druid; each has advantage on its first attack."))).toBe(false);
    expect(support(trait("Life Drain Aura", "While within 10 feet of the wraith, the target's allies can't regain hit points."))).toBe(false);
    expect(support(trait("Fury", "If an ally of the cultist regains hit points, the cultist gains advantage on its next attack."))).toBe(false);
  });
});

describe("inferMonsterRoles: control", () => {
  const control = has("control");

  it("finds conditions the creature imposes, in traits and in spellcasting", () => {
    expect(control(trait("Sticky Body", "A creature that touches the ooze has the Restrained condition."))).toBe(true);
    expect(control({ actions: [{ name: "Spellcasting", desc: "The mage casts one of its spells." }] })).toBe(true);
  });

  it("ignores conditions that are only mentioned: Pack Tactics, immunities and saves against them", () => {
    expect(control(trait("Pack Tactics", "The wolf has Advantage on attack rolls against a creature if at least one of the wolf's allies is within 5 feet of the creature and the ally doesn't have the Incapacitated condition."))).toBe(false);
    expect(control(trait("Steadfast", "The knight is immune to the Frightened condition."))).toBe(false);
    expect(control(trait("Resolute", "The knight can't be Frightened while it can see an ally."))).toBe(false);
    expect(control(trait("Iron Will", "The knight has advantage on saving throws against being Charmed or Paralyzed."))).toBe(false);
    expect(control(trait("Tireless", "The soldier doesn't have the Incapacitated condition while it has hit points left."))).toBe(false);
  });
});

describe("inferMonsterRoles: scouting", () => {
  const scouting = has("scouting");

  it("needs a fly speed of 60 ft., a climb of 40 ft. or a burrow of 30 ft.", () => {
    expect(scouting({ speed: { walk: "10 ft.", fly: "30 ft." } })).toBe(false);
    expect(scouting({ speed: { walk: "10 ft.", fly: "60 ft. (hover)" } })).toBe(true);
    expect(scouting({ speed: { walk: "30 ft.", climb: "40 ft." } })).toBe(true);
    expect(scouting({ speed: { walk: "30 ft.", climb: "30 ft." } })).toBe(false);
    expect(scouting({ speed: { walk: "20 ft.", burrow: "30 ft." } })).toBe(true);
  });

  it("doesn't count a fast walk, a swim speed, darkvision or blindsight", () => {
    expect(scouting({ speed: { walk: "50 ft.", swim: "60 ft." }, senses: { darkvision: "120 ft.", blindsight: "60 ft." } })).toBe(false);
  });

  it("counts a Stealth bonus of the proficiency bonus plus 4", () => {
    const stealth = (challenge_rating: number, value: number) =>
      scouting({ challenge_rating, proficiencies: [{ proficiency: { name: "Skill: Perception" }, value: 9 }, { proficiency: { name: "Skill: Stealth" }, value }] });
    expect([stealth(0.25, 6), stealth(0.25, 5)]).toEqual([true, false]);
    expect([stealth(5, 7), stealth(5, 6)]).toEqual([true, false]);
  });

  it("counts invisibility, hiding, teleports and slipping away", () => {
    expect(scouting({ actions: [{ name: "Invisibility", desc: "The imp magically turns invisible." }] })).toBe(true);
    expect(scouting({ bonus_actions: [{ name: "Nimble Escape", desc: "The goblin takes the Disengage or Hide action." }] })).toBe(true);
    expect(scouting({ bonus_actions: [{ name: "Misty Step", desc: "The mage teleports up to 30 feet to a space it can see." }] })).toBe(true);
    expect(scouting(trait("Incorporeal Movement", "The wraith can move through other creatures and objects."))).toBe(true);
    expect(scouting({ bonus_actions: [{ name: "Charge", desc: "The troll moves up to half its Speed straight toward an enemy." }] })).toBe(false);
  });

  it("counts truesight and tremorsense from 60 ft.", () => {
    expect(scouting({ senses: { truesight: "30 ft." } })).toBe(true);
    expect(scouting({ senses: { tremorsense: "60 ft." } })).toBe(true);
    expect(scouting({ senses: { tremorsense: "30 ft." } })).toBe(false);
  });
});

describe("inferMonsterRoles", () => {
  it("reads legendary actions with the rest of the stat block", () => {
    const gaze = { legendary_actions: [{ name: "Gaze", desc: "One creature the beholder can see has the Paralyzed condition until the end of its next turn." }] };
    expect(roles(gaze)).toContain("control");
  });

  it("never tags a monster as damage, however hard it hits", () => {
    const brute = creature({
      challenge_rating: 2, actions: [
        { name: "Multiattack", desc: "The brute makes three attacks." },
        { name: "Greataxe", desc: "Melee Weapon Attack: +6 to hit. Hit: 30 (4d12 + 4) slashing damage." },
        { name: "Fire Breath", desc: "Each creature in a 30-foot cone takes 40 (9d8) fire damage." },
      ],
    });
    expect(inferMonsterRoles(brute)).not.toContain("damage");
  });

  it("lists roles in a fixed order and gives none to a creature with nothing to read", () => {
    const mage = creature({
      challenge_rating: 6, armor_class: 15, hit_points: 81,
      actions: [{ name: "Spellcasting", desc: ["The mage casts one of its spells.", "At will: Light, Mage Hand."] }],
      bonus_actions: [{ name: "Misty Step", desc: "The mage teleports up to 30 feet to a space it can see." }],
    });
    expect(inferMonsterRoles(mage)).toEqual(["control", "scouting"]);
    expect(inferMonsterRoles({ name: "Shrub" })).toEqual([]);
  });
});

describe("currentRoleTags", () => {
  it("keeps the tags of a custom creature, which its owner typed", () => {
    expect(currentRoleTags({ monsterSlug: null, roleTags: ["damage", "support"] }, ["frontline"])).toEqual(["damage", "support"]);
  });

  it("gives a creature from the bestiary or homebrew today's roles of its stat block", () => {
    expect(currentRoleTags({ monsterSlug: "srd-2024_ogre", roleTags: ["frontline", "damage", "scouting"] }, ["frontline"])).toEqual(["frontline"]);
    expect(currentRoleTags({ monsterSlug: "homebrew:x", roleTags: ["damage"] }, [])).toEqual([]);
  });

  it("keeps the stored tags but damage when the stat block can't be read", () => {
    expect(currentRoleTags({ monsterSlug: "srd-2024_ogre", roleTags: ["frontline", "damage", "scouting"] }, undefined)).toEqual(["frontline", "scouting"]);
  });
});
