/**
 * Runs the campaign permission rules of the data layer against a real PostgreSQL with the Liquibase schema applied.
 * Skipped unless TEST_DATABASE_URL points at a disposable database, e.g.
 *   TEST_DATABASE_URL=postgres://postgres@localhost:5432/grimoire_test pnpm test
 * The test creates its own users and removes them (cascading) when it finishes.
 */
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { AppUser, CharacterInput, EncounterInput } from "../src/lib/permissions";

const url = process.env.TEST_DATABASE_URL;

const character = (campaignId: string | null): CharacterInput => ({
  name: "Mirela", level: 1, className: "Wizard", species: "Elf", background: "Sage",
  scores: { str: 8, dex: 14, con: 13, int: 15, wis: 12, cha: 10 }, notes: "", campaignId,
});

const encounter: EncounterInput = {
  title: "Goblin ambush", notes: "", status: "planned", difficulty: "moderate", budget: 300, totalXp: 200,
  partyLevels: [1, 1, 1], lines: [{ name: "Goblin", xp: 50, count: 4 }],
};

describe.skipIf(!url)("campaign permissions on PostgreSQL", () => {
  const tag = randomUUID().slice(0, 8);
  const mk = (name: string): AppUser => ({ id: `cp-${tag}-${name}`, name, email: `${name}-${tag}@example.test`, role: "user", status: "approved" });
  // alice owns the campaign, carol is a co-DM, bob a player, dave an outsider; erin only fills her creature catalog.
  const alice = mk("alice"), carol = mk("carol"), bob = mk("bob"), dave = mk("dave"), erin = mk("erin");
  let data: typeof import("../src/lib/data");
  let pool: typeof import("../src/lib/db").pool;
  let campaignId: string;

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    ({ pool } = await import("../src/lib/db"));
    data = await import("../src/lib/data");
    for (const user of [alice, carol, bob, dave, erin]) {
      await pool.query('INSERT INTO "user" ("id", "name", "email", "role", "status", "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, $5, now(), now())', [user.id, user.name, user.email, user.role, user.status]);
    }
    const created = await data.createCampaign(alice, { name: `Ravenloft ${tag}`, description: "" });
    if (!created.ok) throw new Error("campaign setup failed");
    campaignId = created.value.id;
    await pool.query('INSERT INTO "campaign_member" ("campaignId", "userId", "role") VALUES ($1, $2, \'dm\'), ($1, $3, \'player\')', [campaignId, carol.id, bob.id]);
  });

  afterAll(async () => {
    if (!pool) return;
    await pool.query('DELETE FROM "user" WHERE "id" = ANY($1::text[])', [[alice.id, carol.id, bob.id, dave.id, erin.id]]);
    await pool.end();
  });

  it("hides the campaign from outsiders and keeps roster changes to its managers", async () => {
    expect(await data.removeCampaignMember(dave, campaignId, bob.id)).toEqual({ ok: false, error: "not-found" });
    expect(await data.setCampaignMemberRole(dave, campaignId, bob.id, "dm")).toEqual({ ok: false, error: "not-found" });
    expect(await data.createCharacter(dave, character(campaignId))).toEqual({ ok: false, error: "forbidden" });

    expect(await data.setCampaignMemberRole(bob, campaignId, carol.id, "player")).toEqual({ ok: false, error: "forbidden" });
    expect(await data.removeCampaignMember(bob, campaignId, carol.id)).toEqual({ ok: false, error: "forbidden" });
    expect(await data.listCampaignInvites(bob, campaignId)).toEqual({ ok: false, error: "forbidden" });
    expect(await data.listEncounters(bob, campaignId)).toEqual({ ok: false, error: "forbidden" });

    // A co-DM manages the roster but can't remove the owner or delete the campaign.
    expect(await data.removeCampaignMember(carol, campaignId, alice.id)).toEqual({ ok: false, error: "invalid" });
    expect(await data.deleteCampaign(carol, campaignId)).toEqual({ ok: false, error: "forbidden" });
    const invite = await data.createCampaignInvite(carol, campaignId);
    if (!invite.ok) throw new Error("invite failed");

    expect(await data.acceptInvite(dave, invite.value.token)).toEqual({ ok: true, value: { campaignId, joined: true } });
    expect(await data.setCampaignMemberRole(dave, campaignId, bob.id, "dm")).toEqual({ ok: false, error: "forbidden" }); // joined as a player
    expect(await data.removeCampaignMember(dave, campaignId, dave.id)).toEqual({ ok: true, value: null }); // anyone can leave
  });

  it("keeps an encounter in the campaign when its author's account is deleted", async () => {
    const saved = await data.createEncounter(carol, campaignId, encounter);
    if (!saved.ok) throw new Error("encounter failed");
    expect(saved.value.createdByName).toBe("carol");
    await pool.query('DELETE FROM "user" WHERE "id" = $1', [carol.id]);
    const listed = await data.listEncounters(alice, campaignId);
    expect(listed.ok && listed.value.find((item) => item.id === saved.value.id)).toMatchObject({ title: "Goblin ambush", createdByName: null });
  });

  it("stops parallel creature adds at the account limit", async () => {
    await pool.query(
      `INSERT INTO "creature" ("ownerId", "name", "xp", "source", "roleTags")
       SELECT $1, 'Rat ' || n, 10, 'Homebrew', '[]' FROM generate_series(1, 499) AS n`,
      [erin.id],
    );
    const results = await Promise.all(Array.from({ length: 5 }, (_, i) =>
      data.createCreature(erin, { name: `Late rat ${i}`, xp: 10, source: "Homebrew", monsterSlug: null, cr: null, type: null, roleTags: [] })));
    expect(results.filter((result) => result.ok)).toHaveLength(1);
    const total = await pool.query<{ n: number }>('SELECT count(*)::int AS n FROM "creature" WHERE "ownerId" = $1', [erin.id]);
    expect(total.rows[0].n).toBe(500);
  });
});
