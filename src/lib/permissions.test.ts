import { describe, expect, it } from "vitest";
import {
  canCreateCampaign,
  canManageCampaign,
  checkAdminChange,
  isInviteToken,
  parseAdminEmails,
  parseCampaignInput,
  parseCharacterInput,
} from "./permissions";

const scores = { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 };

describe("parseAdminEmails", () => {
  it("normalises case and separators and ignores blanks", () => {
    expect([...parseAdminEmails(" Owner@Example.com, friend@example.com;; ")]).toEqual(["owner@example.com", "friend@example.com"]);
    expect(parseAdminEmails(undefined).size).toBe(0);
  });
});

describe("campaign permissions", () => {
  it("lets any unblocked account open a campaign", () => {
    expect(canCreateCampaign({ status: "approved" })).toBe(true);
    expect(canCreateCampaign({ status: "blocked" })).toBe(false);
  });

  it("lets owners, co-DMs and admins manage a campaign, not players", () => {
    const campaign = { ownerId: "owner" };
    expect(canManageCampaign({ id: "owner", role: "user" }, campaign)).toBe(true);
    expect(canManageCampaign({ id: "co", role: "user" }, { ...campaign, myRole: "dm" })).toBe(true);
    expect(canManageCampaign({ id: "boss", role: "admin" }, campaign)).toBe(true);
    expect(canManageCampaign({ id: "p", role: "user" }, { ...campaign, myRole: "player" })).toBe(false);
  });
});

describe("checkAdminChange", () => {
  const admin = { id: "a", role: "admin" as const, status: "approved" as const };
  const other = { id: "b", role: "admin" as const, status: "approved" as const };

  it("stops admins from editing or deleting themselves", () => {
    expect(checkAdminChange(admin, admin, { role: "user" }, 2)).toBe("self");
    expect(checkAdminChange(admin, admin, "delete", 2)).toBe("self");
  });

  it("always keeps one approved admin", () => {
    expect(checkAdminChange(admin, other, { status: "blocked" }, 1)).toBe("last-admin");
    expect(checkAdminChange(admin, other, { role: "user" }, 1)).toBe("last-admin");
    expect(checkAdminChange(admin, other, "delete", 1)).toBe("last-admin");
    expect(checkAdminChange(admin, other, { status: "blocked" }, 2)).toBeNull();
    expect(checkAdminChange(admin, other, { role: "admin" }, 1)).toBeNull();
  });

  it("allows any change to non-admin accounts", () => {
    expect(checkAdminChange(admin, { id: "c", role: "user", status: "approved" }, { status: "blocked", role: "admin" }, 1)).toBeNull();
  });
});

describe("parseCharacterInput", () => {
  it("accepts and trims a valid character", () => {
    expect(parseCharacterInput({ name: "  Iria ", level: 3, className: "Ranger", scores, campaignId: "" })).toEqual({
      name: "Iria", level: 3, className: "Ranger", species: "", background: "", notes: "", scores, campaignId: null,
    });
  });

  it("rejects out-of-range or malformed fields", () => {
    expect(parseCharacterInput({ name: "", level: 3, scores })).toBeNull();
    expect(parseCharacterInput({ name: "A", level: 21, scores })).toBeNull();
    expect(parseCharacterInput({ name: "A", level: 2.5, scores })).toBeNull();
    expect(parseCharacterInput({ name: "A", level: 1, scores: { ...scores, str: 31 } })).toBeNull();
    expect(parseCharacterInput({ name: "A", level: 1, scores, notes: "x".repeat(501) })).toBeNull();
    expect(parseCharacterInput({ name: "A", level: 1, scores, campaignId: "not-a-uuid" })).toBeNull();
    expect(parseCharacterInput(null)).toBeNull();
  });

  it("keeps a creator build object and bounds its size", () => {
    const build = { version: 1, classId: "fighter" };
    expect(parseCharacterInput({ name: "A", level: 1, scores, build })?.build).toEqual(build);
    expect(parseCharacterInput({ name: "A", level: 1, scores, build: ["x"] })).toBeNull();
    expect(parseCharacterInput({ name: "A", level: 1, scores, build: { notes: "x".repeat(16_001) } })).toBeNull();
  });

  it("keeps a valid campaign id", () => {
    const campaignId = "3f1c2b8e-6d4a-4c1e-9a2b-1234567890ab";
    expect(parseCharacterInput({ name: "A", level: 1, scores, campaignId })?.campaignId).toBe(campaignId);
  });
});

describe("parseCampaignInput", () => {
  it("requires a name and bounds the description", () => {
    expect(parseCampaignInput({ name: " Curse of Strahd ", description: undefined })).toEqual({ name: "Curse of Strahd", description: "" });
    expect(parseCampaignInput({ name: "   " })).toBeNull();
    expect(parseCampaignInput({ name: "A", description: "x".repeat(1001) })).toBeNull();
  });
});

describe("isInviteToken", () => {
  it("accepts 32 random bytes in base64url and nothing else", () => {
    expect(isInviteToken("A".repeat(43))).toBe(true);
    expect(isInviteToken("a-_".repeat(14) + "a")).toBe(true);
    expect(isInviteToken("A".repeat(42))).toBe(false);
    expect(isInviteToken(`${"A".repeat(42)}=`)).toBe(false);
    expect(isInviteToken("'; DROP TABLE x;--" + "A".repeat(30))).toBe(false);
    expect(isInviteToken(undefined)).toBe(false);
  });
});
