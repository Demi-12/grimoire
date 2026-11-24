/**
 * Runs the campaign permission rules of the services against a real PostgreSQL with the Liquibase schema applied.
 * Skipped unless TEST_DATABASE_URL points at a disposable database, e.g.
 *   TEST_DATABASE_URL=postgres://postgres@localhost:5432/grimoire_test pnpm test
 * The test creates its own users and removes them (cascading) when it finishes.
 */
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { AppUser, CharacterInput, EncounterInput } from "@grimoire/shared/permissions";
import type { CampaignsService } from "../src/campaigns/campaigns.service.js";
import type { EncountersService } from "../src/campaigns/encounters.service.js";
import type { CharactersService } from "../src/characters/characters.service.js";
import type { CreaturesService } from "../src/creatures/creatures.service.js";
import type { HomebrewService } from "../src/homebrew/homebrew.service.js";
import type { InvitesService } from "../src/invites/invites.service.js";
import type { MonstersService } from "../src/monsters/monsters.service.js";
import { parseHomebrewInput, homebrewSlug } from "@grimoire/shared/homebrew";

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
  let campaigns: CampaignsService;
  let characters: CharactersService;
  let encounters: EncountersService;
  let invites: InvitesService;
  let creatures: CreaturesService;
  let homebrew: HomebrewService;
  let pool: typeof import("../src/database/db.js").pool;
  let campaignId: string;

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    ({ pool } = await import("../src/database/db.js"));
    campaigns = new (await import("../src/campaigns/campaigns.service.js")).CampaignsService();
    characters = new (await import("../src/characters/characters.service.js")).CharactersService(campaigns);
    encounters = new (await import("../src/campaigns/encounters.service.js")).EncountersService(campaigns);
    invites = new (await import("../src/invites/invites.service.js")).InvitesService();
    homebrew = new (await import("../src/homebrew/homebrew.service.js")).HomebrewService();
    // The Open5e catalog as if it were already built: only the Ogre's roles are known.
    const catalog = { catalogRoles: (slug: string) => (slug === "srd-2024_ogre" ? ["frontline" as const] : undefined) } as unknown as MonstersService;
    creatures = new (await import("../src/creatures/creatures.service.js")).CreaturesService(homebrew, catalog);
    for (const user of [alice, carol, bob, dave, erin]) {
      await pool.query('INSERT INTO "user" ("id", "name", "email", "role", "status", "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, $5, now(), now())', [user.id, user.name, user.email, user.role, user.status]);
    }
    const created = await campaigns.createCampaign(alice, { name: `Ravenloft ${tag}`, description: "" });
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
    expect(await campaigns.removeCampaignMember(dave, campaignId, bob.id)).toEqual({ ok: false, error: "not-found" });
    expect(await campaigns.setCampaignMemberRole(dave, campaignId, bob.id, "dm")).toEqual({ ok: false, error: "not-found" });
    expect(await characters.createCharacter(dave, character(campaignId))).toEqual({ ok: false, error: "forbidden" });

    expect(await campaigns.setCampaignMemberRole(bob, campaignId, carol.id, "player")).toEqual({ ok: false, error: "forbidden" });
    expect(await campaigns.removeCampaignMember(bob, campaignId, carol.id)).toEqual({ ok: false, error: "forbidden" });
    expect(await campaigns.listCampaignInvites(bob, campaignId)).toEqual({ ok: false, error: "forbidden" });
    expect(await encounters.listEncounters(bob, campaignId)).toEqual({ ok: false, error: "forbidden" });

    // A co-DM manages the roster but can't remove the owner or delete the campaign.
    expect(await campaigns.removeCampaignMember(carol, campaignId, alice.id)).toEqual({ ok: false, error: "invalid" });
    expect(await campaigns.deleteCampaign(carol, campaignId)).toEqual({ ok: false, error: "forbidden" });
    const invite = await campaigns.createCampaignInvite(carol, campaignId);
    if (!invite.ok) throw new Error("invite failed");

    expect(await invites.acceptInvite(dave, invite.value.token)).toEqual({ ok: true, value: { campaignId, joined: true } });
    expect(await campaigns.setCampaignMemberRole(dave, campaignId, bob.id, "dm")).toEqual({ ok: false, error: "forbidden" }); // joined as a player
    expect(await campaigns.removeCampaignMember(dave, campaignId, dave.id)).toEqual({ ok: true, value: null }); // anyone can leave
  });

  it("keeps an encounter in the campaign when its author's account is deleted", async () => {
    const saved = await encounters.createEncounter(carol, campaignId, encounter);
    if (!saved.ok) throw new Error("encounter failed");
    expect(saved.value.createdByName).toBe("carol");
    await pool.query('DELETE FROM "user" WHERE "id" = $1', [carol.id]);
    const listed = await encounters.listEncounters(alice, campaignId);
    expect(listed.ok && listed.value.find((item) => item.id === saved.value.id)).toMatchObject({ title: "Goblin ambush", createdByName: null });
  });

  it("shows today's roles for catalog and homebrew creatures, and keeps the tags of custom ones", async () => {
    const drake = parseHomebrewInput({ statBlock: {
      name: `Drake ${tag}`, armor_class: 15, hit_points: 52, speed: { fly: "60 ft." }, challenge_rating: 3,
      strength: 16, dexterity: 12, constitution: 17, intelligence: 6, wisdom: 12, charisma: 8,
    } });
    if (!drake.ok) throw new Error(drake.error);
    const mine = await homebrew.createHomebrew(dave, drake.value, drake.summary);
    const hidden = await homebrew.createHomebrew(alice, drake.value, drake.summary);
    if (!mine.ok || !hidden.ok) throw new Error("homebrew setup failed");
    // Tags as clients saved them under the old rules.
    const old = ["frontline", "damage", "support"];
    const add = (name: string, monsterSlug: string | null) => creatures.createCreature(dave, { name, xp: 450, source: "Test", monsterSlug, cr: null, type: null, roleTags: old });
    for (const [name, slug] of [["Ogre", "srd-2024_ogre"], ["Drake", homebrewSlug(mine.value.id)], ["Someone's drake", homebrewSlug(hidden.value.id)], ["Unknown", "tob_unknown"], ["Custom", null]] as const) {
      expect((await add(name, slug)).ok).toBe(true);
    }
    const tags = Object.fromEntries((await creatures.listCreatures(dave)).map((creature) => [creature.name, creature.roleTags ?? []]));
    expect(tags).toEqual({
      Ogre: ["frontline"], Drake: ["scouting"],
      // Stat block out of reach: the stored tags but damage.
      "Someone's drake": ["frontline", "support"], Unknown: ["frontline", "support"],
      Custom: old,
    });
    const stored = await pool.query<{ roleTags: string[] }>('SELECT "roleTags" FROM "creature" WHERE "ownerId" = $1', [dave.id]);
    expect(stored.rows.map((row) => row.roleTags)).toEqual(Array(5).fill(old));
  });

  it("stops parallel creature adds at the account limit", async () => {
    await pool.query(
      `INSERT INTO "creature" ("ownerId", "name", "xp", "source", "roleTags")
       SELECT $1, 'Rat ' || n, 10, 'Homebrew', '[]' FROM generate_series(1, 499) AS n`,
      [erin.id],
    );
    const results = await Promise.all(Array.from({ length: 5 }, (_, i) =>
      creatures.createCreature(erin, { name: `Late rat ${i}`, xp: 10, source: "Homebrew", monsterSlug: null, cr: null, type: null, roleTags: [] })));
    expect(results.filter((result) => result.ok)).toHaveLength(1);
    const total = await pool.query<{ n: number }>('SELECT count(*)::int AS n FROM "creature" WHERE "ownerId" = $1', [erin.id]);
    expect(total.rows[0].n).toBe(500);
  });
});
