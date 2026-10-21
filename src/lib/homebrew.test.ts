import { describe, expect, it } from "vitest";
import {
  canDeleteHomebrew, canEditHomebrew, canModerateHomebrew, canPublishHomebrew, canViewHomebrew,
  homebrewSlug, parseHomebrewInput, parseHomebrewSlug, proficiencyBonusFor, xpForChallengeRating,
  type HomebrewAccess,
} from "./homebrew";

const CAMPAIGN = "6f1c1e7a-3b5e-4c52-9a7e-0d4f5a1b2c3d";
const OTHER_CAMPAIGN = "0a9b8c7d-6e5f-4a3b-8c2d-1e0f9a8b7c6d";

const statBlock = {
  name: "  Ash Drake  ",
  size: "Medium",
  type: "dragon",
  alignment: "unaligned",
  armor_class: 15,
  hit_points: 52,
  hit_points_roll: "7d8+21",
  speed: { walk: "30 ft.", fly: "60 ft." },
  strength: 16, dexterity: 12, constitution: 17, intelligence: 6, wisdom: 12, charisma: 8,
  senses: { darkvision: "60 ft.", passive_perception: 11 },
  languages: "understands Draconic",
  challenge_rating: 3,
  actions: [
    { name: "Multiattack", desc: "The drake makes two attacks: one with its bite and one with its claws." },
    { name: "Bite", desc: "Melee Weapon Attack: +5 to hit, reach 5 ft. Hit: 9 (2d6+2) piercing damage.", attack_bonus: 5 },
  ],
};

function parse(overrides: Record<string, unknown> = {}, block: Record<string, unknown> = {}) {
  return parseHomebrewInput({ statBlock: { ...statBlock, ...block }, ...overrides });
}

describe("parseHomebrewInput", () => {
  it("normalises a valid stat block and derives XP, proficiency and a summary", () => {
    const result = parse();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.visibility).toBe("private");
    expect(result.value.statBlock.name).toBe("Ash Drake");
    expect(result.value.statBlock.armor_class).toEqual([{ value: 15 }]);
    expect(result.value.statBlock.xp).toBe(700);
    expect(result.value.statBlock.proficiency_bonus).toBe(2);
    expect(result.summary).toMatchObject({ name: "Ash Drake", cr: 3, xp: 700, type: "dragon" });
    expect(result.summary.roleTags).toContain("damage");
  });

  it("ignores client-supplied XP and proficiency bonus", () => {
    const result = parse({}, { xp: 999999, proficiency_bonus: 9 });
    expect(result.ok && result.value.statBlock.xp).toBe(700);
    expect(result.ok && result.value.statBlock.proficiency_bonus).toBe(2);
  });

  it("accepts the stored armor shape so an edit can be saved back unchanged", () => {
    const result = parse({}, { armor_class: [{ type: "natural armor", value: 14 }] });
    expect(result.ok && result.value.statBlock.armor_class).toEqual([{ type: "natural armor", value: 14 }]);
  });

  it("drops unknown fields instead of storing them", () => {
    const result = parse({}, { image: "/x.png", __proto__: { polluted: true }, secret: "x" });
    expect(result.ok && Object.keys(result.value.statBlock)).not.toContain("secret");
    expect(result.ok && Object.keys(result.value.statBlock)).not.toContain("image");
  });

  it.each([
    ["missing name", {}, { name: "   " }],
    ["fractional hit points", {}, { hit_points: 10.5 }],
    ["ability score out of range", {}, { strength: 31 }],
    ["non-standard challenge rating", {}, { challenge_rating: 2.5 }],
    ["armor class out of range", {}, { armor_class: 99 }],
    ["text where a list belongs", {}, { actions: "bite" }],
    ["too many actions", {}, { actions: Array.from({ length: 31 }, (_, i) => ({ name: `A${i}`, desc: "x" })) }],
    ["oversized description", {}, { actions: [{ name: "Slam", desc: "x".repeat(2001) }] }],
  ])("rejects %s", (_label, overrides, block) => {
    expect(parse(overrides, block).ok).toBe(false);
  });

  it("rejects a non-object body", () => {
    expect(parseHomebrewInput("nope").ok).toBe(false);
    expect(parseHomebrewInput(null).ok).toBe(false);
  });

  it("requires a campaign when sharing with campaigns, and clears the list otherwise", () => {
    expect(parse({ visibility: "campaign", campaignIds: [] }).ok).toBe(false);
    expect(parse({ visibility: "campaign", campaignIds: ["not-a-uuid"] }).ok).toBe(false);
    const shared = parse({ visibility: "campaign", campaignIds: [CAMPAIGN, CAMPAIGN] });
    expect(shared.ok && shared.value.campaignIds).toEqual([CAMPAIGN]);
    const priv = parse({ visibility: "private", campaignIds: [CAMPAIGN] });
    expect(priv.ok && priv.value.campaignIds).toEqual([]);
    expect(parse({ visibility: "everyone" }).ok).toBe(false);
  });
});

describe("challenge rating helpers", () => {
  it("maps ratings to the SRD XP table", () => {
    expect(xpForChallengeRating(0.125)).toBe(25);
    expect(xpForChallengeRating(10)).toBe(5900);
    expect(xpForChallengeRating(30)).toBe(155000);
    expect(xpForChallengeRating(2.5)).toBeNull();
  });

  it("derives the proficiency bonus", () => {
    expect([0, 0.5, 4, 5, 8, 9, 13, 17, 21, 25, 29, 30].map(proficiencyBonusFor)).toEqual([2, 2, 2, 3, 3, 4, 5, 6, 7, 8, 9, 9]);
  });

  it("round-trips homebrew slugs", () => {
    expect(parseHomebrewSlug(homebrewSlug(CAMPAIGN))).toBe(CAMPAIGN);
    expect(parseHomebrewSlug("goblin")).toBeNull();
  });
});

describe("homebrew access", () => {
  const owner = { id: "owner", role: "user", status: "approved" } as const;
  const stranger = { id: "stranger", role: "user", status: "approved" } as const;
  const admin = { id: "admin", role: "admin", status: "approved" } as const;
  const blocked = { id: "owner", role: "user", status: "blocked" } as const;
  const monster = (visibility: HomebrewAccess["visibility"], extra: Partial<HomebrewAccess> = {}): HomebrewAccess =>
    ({ ownerId: "owner", visibility, locked: false, campaignIds: [], ...extra });
  const none = new Set<string>();

  it("keeps private monsters to their owner, even from admins", () => {
    expect(canViewHomebrew(owner, monster("private"), none)).toBe(true);
    expect(canViewHomebrew(stranger, monster("private"), none)).toBe(false);
    expect(canViewHomebrew(admin, monster("private"), none)).toBe(false);
    expect(canViewHomebrew(admin, monster("private", { locked: true }), none)).toBe(true);
    expect(canViewHomebrew(stranger, monster("private", { locked: true }), none)).toBe(false);
  });

  it("shows instance monsters to every approved account", () => {
    expect(canViewHomebrew(stranger, monster("instance"), none)).toBe(true);
    expect(canViewHomebrew(blocked, monster("instance", { ownerId: "x" }), none)).toBe(false);
  });

  it("shows campaign monsters only to members of a shared campaign", () => {
    const shared = monster("campaign", { campaignIds: [CAMPAIGN] });
    expect(canViewHomebrew(stranger, shared, new Set([CAMPAIGN]))).toBe(true);
    expect(canViewHomebrew(stranger, shared, new Set([OTHER_CAMPAIGN]))).toBe(false);
    expect(canViewHomebrew(stranger, shared, none)).toBe(false);
    expect(canViewHomebrew(admin, shared, none)).toBe(true);
  });

  it("lets only the owner edit, and the owner or an admin delete published work", () => {
    expect(canEditHomebrew(owner, monster("private"))).toBe(true);
    expect(canEditHomebrew(admin, monster("instance"))).toBe(false);
    expect(canDeleteHomebrew(admin, monster("instance"))).toBe(true);
    expect(canDeleteHomebrew(admin, monster("private"))).toBe(false);
    expect(canDeleteHomebrew(stranger, monster("instance"))).toBe(false);
    expect(canDeleteHomebrew(owner, monster("private"))).toBe(true);
  });

  it("blocks publishing a locked monster but always allows making it private", () => {
    expect(canPublishHomebrew({ locked: true }, "instance")).toBe(false);
    expect(canPublishHomebrew({ locked: true }, "campaign")).toBe(false);
    expect(canPublishHomebrew({ locked: true }, "private")).toBe(true);
    expect(canPublishHomebrew({ locked: false }, "instance")).toBe(true);
  });

  it("restricts moderation to approved admins", () => {
    expect(canModerateHomebrew(admin)).toBe(true);
    expect(canModerateHomebrew(owner)).toBe(false);
    expect(canModerateHomebrew({ ...admin, status: "blocked" })).toBe(false);
  });
});
