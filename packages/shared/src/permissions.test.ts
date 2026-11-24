import { describe, expect, it } from "vitest";
import {
  appUserFromRow,
  awaitsAdminBootstrap,
  canCreateCampaign,
  canManageCampaign,
  checkAdminChange,
  isAccountId,
  isInviteToken,
  isListedAdmin,
  parseAdminEmails,
  parseCampaignInput,
  parseAdminRequest,
  parseCharacterInput,
  parseMemberRequest,
} from "./permissions.js";

const scores = { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 };

describe("parseAdminEmails", () => {
  it("normalises case and separators and ignores blanks", () => {
    expect([...parseAdminEmails(" Owner@Example.com, friend@example.com;; ")]).toEqual(["owner@example.com", "friend@example.com"]);
    expect(parseAdminEmails(undefined).size).toBe(0);
  });
});

describe("the account behind a request", () => {
  const row = { id: "u1", name: "Ana", email: "Ana@Example.com", role: "user", status: "pending" };
  const listed = " ana@example.com, friend@example.com ";

  it("reads the stored account only when its role and status are ones the app knows", () => {
    expect(appUserFromRow(row)).toEqual({ id: "u1", name: "Ana", email: "Ana@Example.com", role: "user", status: "pending" });
    expect(appUserFromRow({ ...row, role: "superuser" })).toBeNull();
    expect(appUserFromRow({ ...row, status: "deleted" })).toBeNull();
    expect(appUserFromRow(undefined)).toBeNull();
  });

  it("recognises the emails listed as admins whatever their case", () => {
    expect(isListedAdmin("ANA@example.com", listed)).toBe(true);
    expect(isListedAdmin("someone@example.com", listed)).toBe(false);
    expect(isListedAdmin("ana@example.com", undefined)).toBe(false);
  });

  it("promotes a listed account that isn't an approved admin yet, but never a blocked one", () => {
    const user = appUserFromRow(row)!;
    expect(awaitsAdminBootstrap(user, listed)).toBe(true);
    expect(awaitsAdminBootstrap({ ...user, status: "approved" }, listed)).toBe(true);
    expect(awaitsAdminBootstrap({ ...user, role: "admin" }, listed)).toBe(true);
    expect(awaitsAdminBootstrap({ ...user, role: "admin", status: "approved" }, listed)).toBe(false);
    expect(awaitsAdminBootstrap({ ...user, status: "blocked" }, listed)).toBe(false);
    expect(awaitsAdminBootstrap({ ...user, email: "someone@example.com" }, listed)).toBe(false);
    expect(awaitsAdminBootstrap(user, undefined)).toBe(false);
  });
});

describe("campaign permissions", () => {
  it("lets any approved account open a campaign", () => {
    expect(canCreateCampaign({ status: "approved" })).toBe(true);
    expect(canCreateCampaign({ status: "pending" })).toBe(false);
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

describe("input size limits", () => {
  it("rejects over-long character and campaign fields and oversized builds", () => {
    const base = { name: "Aria", level: 3, className: "Wizard", species: "Elf", background: "Sage", notes: "", scores: { str: 8, dex: 14, con: 12, int: 16, wis: 10, cha: 10 } };
    expect(parseCharacterInput({ ...base, name: "a".repeat(51) })).toBeNull();
    expect(parseCharacterInput({ ...base, notes: "a".repeat(501) })).toBeNull();
    expect(parseCharacterInput({ ...base, build: { blob: "a".repeat(16_001) } })).toBeNull();
    expect(parseCharacterInput({ ...base, build: ["x"] })).toBeNull();
    expect(parseCampaignInput({ name: "a".repeat(81), description: "" })).toBeNull();
    expect(parseCampaignInput({ name: "ok", description: "a".repeat(1001) })).toBeNull();
  });
});

describe("isAccountId", () => {
  it("accepts better-auth's ids, which are not UUIDs, up to 128 characters", () => {
    expect(isAccountId("Xk3pQ9vT2mL8")).toBe(true);
    expect(isAccountId("a".repeat(128))).toBe(true);
    expect(isAccountId("a".repeat(129))).toBe(false);
    expect(isAccountId("")).toBe(false);
    expect(isAccountId(7)).toBe(false);
  });
});

describe("parseMemberRequest", () => {
  it("adds by trimmed email or exact name when a query is sent", () => {
    expect(parseMemberRequest({ query: "  ana@example.com ", role: "player" })).toEqual({ kind: "add", query: "ana@example.com", role: "player" });
    expect(parseMemberRequest({ query: "Ana", userId: "u1", role: "dm" })).toEqual({ kind: "add", query: "Ana", role: "dm" });
  });
  it("changes the role of an existing member by account id otherwise", () => {
    expect(parseMemberRequest({ userId: "u1", role: "dm" })).toEqual({ kind: "set-role", userId: "u1", role: "dm" });
  });
  it("rejects unknown roles, empty or long queries and bad account ids", () => {
    expect(parseMemberRequest(null)).toBeNull();
    expect(parseMemberRequest({ query: "Ana", role: "owner" })).toBeNull();
    expect(parseMemberRequest({ query: "   ", role: "player" })).toBeNull();
    expect(parseMemberRequest({ query: "a".repeat(255), role: "player" })).toBeNull();
    expect(parseMemberRequest({ userId: "", role: "player" })).toBeNull();
    expect(parseMemberRequest({ userId: "a".repeat(129), role: "player" })).toBeNull();
    expect(parseMemberRequest({ role: "player" })).toBeNull();
  });
});

describe("parseAdminRequest", () => {
  it("revokes sessions when asked, whatever else is sent", () => {
    expect(parseAdminRequest({ revokeSessions: true, role: "nope" })).toEqual({ ok: true, value: { kind: "revoke-sessions" } });
  });
  it("collects a role and/or status change", () => {
    expect(parseAdminRequest({ role: "admin" })).toEqual({ ok: true, value: { kind: "change", change: { role: "admin" } } });
    expect(parseAdminRequest({ role: "user", status: "blocked" })).toEqual({ ok: true, value: { kind: "change", change: { role: "user", status: "blocked" } } });
  });
  it("says what is wrong with an invalid change", () => {
    expect(parseAdminRequest(null)).toEqual({ ok: false, error: "Invalid change." });
    expect(parseAdminRequest({ role: "dm" })).toEqual({ ok: false, error: "Invalid role." });
    expect(parseAdminRequest({ status: "gone" })).toEqual({ ok: false, error: "Invalid status." });
    expect(parseAdminRequest({ revokeSessions: "yes" })).toEqual({ ok: false, error: "Nothing to change." });
  });
});
