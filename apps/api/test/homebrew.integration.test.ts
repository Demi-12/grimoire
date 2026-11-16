/**
 * Runs the homebrew data layer against a real PostgreSQL with the Liquibase schema applied.
 * Skipped unless TEST_DATABASE_URL points at a disposable database, e.g.
 *   TEST_DATABASE_URL=postgres://postgres@localhost:5432/grimoire_test pnpm test
 * The test creates its own users and removes them (cascading) when it finishes.
 */
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { AppUser } from "../src/lib/permissions";
import type { HomebrewInput } from "../src/lib/homebrew";

const url = process.env.TEST_DATABASE_URL;

const statBlock = {
  name: "Ash Drake", size: "Medium", type: "dragon", armor_class: 15, hit_points: 52,
  speed: { walk: "30 ft.", fly: "60 ft." },
  strength: 16, dexterity: 12, constitution: 17, intelligence: 6, wisdom: 12, charisma: 8,
  challenge_rating: 3,
  actions: [{ name: "Bite", desc: "Melee Weapon Attack: +5 to hit. Hit: 9 (2d6+2) piercing damage." }],
};

describe.skipIf(!url)("homebrew monsters on PostgreSQL", () => {
  const tag = randomUUID().slice(0, 8);
  const mk = (name: string, role: "admin" | "user" = "user"): AppUser => ({ id: `hb-${tag}-${name}`, name, email: `${name}-${tag}@example.test`, role, status: "approved" });
  const alice = mk("alice"), bob = mk("bob"), dave = mk("dave"), root = mk("root", "admin");
  let data: typeof import("../src/lib/data");
  let homebrew: typeof import("../src/lib/homebrew");
  let pool: typeof import("../src/lib/db").pool;
  let campaignId: string;
  let otherCampaignId: string;

  const input = async (overrides: Partial<HomebrewInput> & { name?: string } = {}) => {
    const parsed = homebrew.parseHomebrewInput({ statBlock: { ...statBlock, name: overrides.name ?? "Ash Drake" }, visibility: overrides.visibility, campaignIds: overrides.campaignIds });
    if (!parsed.ok) throw new Error(parsed.error);
    return parsed;
  };
  const create = async (user: AppUser, overrides: Parameters<typeof input>[0] = {}) => {
    const parsed = await input(overrides);
    return data.createHomebrew(user, parsed.value, parsed.summary);
  };
  const update = async (user: AppUser, id: string, overrides: Parameters<typeof input>[0] = {}) => {
    const parsed = await input(overrides);
    return data.updateHomebrew(user, id, parsed.value, parsed.summary);
  };
  const ids = async (user: AppUser) => (await data.listHomebrew(user)).map((m) => m.id);

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    ({ pool } = await import("../src/lib/db"));
    data = await import("../src/lib/data");
    homebrew = await import("../src/lib/homebrew");
    for (const user of [alice, bob, dave, root]) {
      await pool.query('INSERT INTO "user" ("id", "name", "email", "role", "status", "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, $5, now(), now())', [user.id, user.name, user.email, user.role, user.status]);
    }
    const first = await data.createCampaign(alice, { name: `Mine ${tag}`, description: "" });
    const second = await data.createCampaign(dave, { name: `Elsewhere ${tag}`, description: "" });
    if (!first.ok || !second.ok) throw new Error("campaign setup failed");
    campaignId = first.value.id;
    otherCampaignId = second.value.id;
    await pool.query('INSERT INTO "campaign_member" ("campaignId", "userId", "role") VALUES ($1, $2, \'player\')', [campaignId, bob.id]);
  });

  afterAll(async () => {
    if (!pool) return;
    await pool.query('DELETE FROM "user" WHERE "id" = ANY($1::text[])', [[alice.id, bob.id, dave.id, root.id]]);
    await pool.end();
  });

  it("stores the stat block with derived XP and keeps it private by default", async () => {
    const result = await create(alice);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toMatchObject({ name: "Ash Drake", cr: 3, xp: 700, visibility: "private", mine: true, locked: false, campaignIds: [] });
    expect(result.value.statBlock.hit_points).toBe(52);
    expect(await ids(bob)).not.toContain(result.value.id);
    expect(await ids(root)).not.toContain(result.value.id);
    expect(await data.readHomebrewForUser(dave, result.value.id)).toBeNull();
  });

  it("shares with a campaign only for its members", async () => {
    const created = await create(alice, { name: "Campaign Wyrm" });
    if (!created.ok) throw new Error("create failed");
    const shared = await update(alice, created.value.id, { name: "Campaign Wyrm", visibility: "campaign", campaignIds: [campaignId] });
    expect(shared.ok && shared.value.campaignIds).toEqual([campaignId]);
    expect(await ids(bob)).toContain(created.value.id);
    expect(await ids(dave)).not.toContain(created.value.id);
    expect(await ids(root)).toContain(created.value.id);
    const seen = await data.readHomebrewForUser(bob, created.value.id);
    expect(seen).toMatchObject({ mine: false, ownerName: "alice" });
  });

  it("refuses to share with a campaign the owner does not belong to", async () => {
    const created = await create(alice, { name: "Stolen Share" });
    if (!created.ok) throw new Error("create failed");
    const attempt = await update(alice, created.value.id, { name: "Stolen Share", visibility: "campaign", campaignIds: [otherCampaignId] });
    expect(attempt).toEqual({ ok: false, error: "forbidden" });
    const direct = await create(alice, { name: "Direct Share", visibility: "campaign", campaignIds: [otherCampaignId] });
    expect(direct).toEqual({ ok: false, error: "forbidden" });
  });

  it("publishes to the whole instance and lets only the owner edit", async () => {
    const created = await create(alice, { name: "Public Hydra", visibility: "instance" });
    if (!created.ok) throw new Error("create failed");
    const id = created.value.id;
    expect(await ids(dave)).toContain(id);
    expect(await update(dave, id, { name: "Hijacked" })).toEqual({ ok: false, error: "forbidden" });
    expect(await update(root, id, { name: "Hijacked" })).toEqual({ ok: false, error: "forbidden" });
    expect(await data.deleteHomebrew(dave, id)).toEqual({ ok: false, error: "forbidden" });
  });

  it("lets an admin lock a published monster, which hides it and blocks republishing", async () => {
    const created = await create(alice, { name: "Rude Lich", visibility: "instance" });
    if (!created.ok) throw new Error("create failed");
    const id = created.value.id;
    expect(await data.setHomebrewLocked(alice, id, true)).toEqual({ ok: false, error: "forbidden" });
    const locked = await data.setHomebrewLocked(root, id, true);
    expect(locked.ok && locked.value).toMatchObject({ locked: true, visibility: "private", mine: false });
    expect(await ids(dave)).not.toContain(id);
    expect(await update(alice, id, { name: "Rude Lich", visibility: "instance" })).toEqual({ ok: false, error: "forbidden" });
    const edited = await update(alice, id, { name: "Polite Lich" });
    expect(edited.ok && edited.value.name).toBe("Polite Lich");
    await data.setHomebrewLocked(root, id, false);
    const republished = await update(alice, id, { name: "Polite Lich", visibility: "instance" });
    expect(republished.ok && republished.value.visibility).toBe("instance");
  });

  it("lets admins delete published monsters but never see or delete private ones", async () => {
    const priv = await create(alice, { name: "Secret Ogre" });
    const pub = await create(alice, { name: "Loud Ogre", visibility: "instance" });
    if (!priv.ok || !pub.ok) throw new Error("create failed");
    expect(await data.deleteHomebrew(root, priv.value.id)).toEqual({ ok: false, error: "not-found" });
    expect(await data.deleteHomebrew(root, pub.value.id)).toEqual({ ok: true, value: null });
    expect(await data.deleteHomebrew(alice, priv.value.id)).toEqual({ ok: true, value: null });
    expect(await data.readHomebrewForUser(alice, pub.value.id)).toBeNull();
  });

  it("drops campaign shares with the campaign and monsters with their owner", async () => {
    const created = await create(bob, { name: "Bob's Imp" });
    if (!created.ok) throw new Error("create failed");
    const shared = await create(alice, { name: "Share then delete", visibility: "campaign", campaignIds: [campaignId] });
    if (!shared.ok) throw new Error("create failed");
    const before = await pool.query('SELECT count(*)::int AS n FROM "homebrew_monster_campaign" WHERE "monsterId" = $1', [shared.value.id]);
    expect(before.rows[0].n).toBe(1);
    await pool.query('DELETE FROM "campaign" WHERE "id" = $1', [campaignId]);
    const after = await pool.query('SELECT count(*)::int AS n FROM "homebrew_monster_campaign" WHERE "monsterId" = $1', [shared.value.id]);
    expect(after.rows[0].n).toBe(0);
    await pool.query('DELETE FROM "user" WHERE "id" = $1', [bob.id]);
    const gone = await pool.query('SELECT count(*)::int AS n FROM "homebrew_monster" WHERE "id" = $1', [created.value.id]);
    expect(gone.rows[0].n).toBe(0);
  });
});
