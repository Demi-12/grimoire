/**
 * Runs the battle map data layer and its live notifications against a real PostgreSQL with the Liquibase
 * schema applied. Skipped unless TEST_DATABASE_URL points at a disposable database, e.g.
 *   TEST_DATABASE_URL=postgres://postgres@localhost:5432/grimoire_test pnpm test
 * The test creates its own users and removes them (cascading) when it finishes.
 */
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { AppUser } from "../src/lib/permissions";

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("battle maps on PostgreSQL", () => {
  const tag = randomUUID().slice(0, 8);
  const mk = (name: string): AppUser => ({ id: `bm-${tag}-${name}`, name, email: `${name}-${tag}@example.test`, role: "user", status: "approved" });
  const dm = mk("dm"), player = mk("player"), stranger = mk("stranger");
  let mapData: typeof import("../src/lib/battle-map-data");
  let hub: typeof import("../src/lib/battle-map-hub");
  let pool: typeof import("../src/lib/db").pool;
  let campaignId: string;
  let heroId: string;

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    ({ pool } = await import("../src/lib/db"));
    const data = await import("../src/lib/data");
    mapData = await import("../src/lib/battle-map-data");
    hub = await import("../src/lib/battle-map-hub");
    for (const user of [dm, player, stranger]) {
      await pool.query('INSERT INTO "user" ("id", "name", "email", "role", "status", "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, $5, now(), now())', [user.id, user.name, user.email, user.role, user.status]);
    }
    const campaign = await data.createCampaign(dm, { name: `Map ${tag}`, description: "" });
    if (!campaign.ok) throw new Error("campaign setup failed");
    campaignId = campaign.value.id;
    await pool.query('INSERT INTO "campaign_member" ("campaignId", "userId", "role") VALUES ($1, $2, \'player\')', [campaignId, player.id]);
    const hero = await data.createCharacter(player, {
      name: "Lia", level: 3, className: "Rogue", species: "Elf", background: "", notes: "", campaignId,
      scores: { str: 10, dex: 16, con: 12, int: 10, wis: 12, cha: 10 },
    });
    if (!hero.ok) throw new Error("character setup failed");
    heroId = hero.value.id;
  });

  afterAll(async () => {
    if (!pool) return;
    await pool.query('DELETE FROM "user" WHERE "id" = ANY($1::text[])', [[dm.id, player.id, stranger.id]]);
    await pool.end();
  });

  it("starts empty for members and is invisible to everyone else", async () => {
    const first = await mapData.readBattleMap(player, campaignId);
    expect(first.ok && first.value).toMatchObject({ version: 0, isDm: false, state: { cols: 20, rows: 14, tokens: [] } });
    expect(first.ok && first.value.heroes).toEqual([{ id: heroId, name: "Lia", ownerId: player.id, mine: true }]);
    expect(await mapData.readBattleMap(stranger, campaignId)).toEqual({ ok: false, error: "not-found" });
    expect(await mapData.changeBattleMap(stranger, campaignId, [{ type: "clear-monsters" }])).toEqual({ ok: false, error: "not-found" });
  });

  it("keeps hidden monsters from players and announces every change", async () => {
    let heard = 0;
    const unsubscribe = hub.subscribeToMap(campaignId, () => { heard += 1; });
    // Let the LISTEN connection come up before changing anything.
    for (let i = 0; i < 50 && heard === 0; i++) {
      await new Promise((resolve) => setTimeout(resolve, 50));
      if (i === 5) await mapData.changeBattleMap(dm, campaignId, [{ type: "resize", cols: 12, rows: 10 }]);
    }
    expect(heard).toBeGreaterThan(0);

    const added = await mapData.changeBattleMap(dm, campaignId, [
      { type: "add-monster", label: "Goblin", count: 2, size: 1, hidden: false },
      { type: "add-monster", label: "Ogre", count: 1, size: 2, hidden: true },
    ]);
    expect(added.ok && added.value.state.tokens.map((token) => token.label)).toEqual(["Goblin 1", "Goblin 2", "Ogre"]);
    const asPlayer = await mapData.readBattleMap(player, campaignId);
    expect(asPlayer.ok && asPlayer.value.state.tokens.map((token) => token.label)).toEqual(["Goblin 1", "Goblin 2"]);
    const tableView = await mapData.readBattleMap(dm, campaignId, "players");
    expect(tableView.ok && tableView.value.state.tokens.map((token) => token.label)).toEqual(["Goblin 1", "Goblin 2"]);

    const before = heard;
    await mapData.changeBattleMap(player, campaignId, [{ type: "place-hero", characterId: heroId, x: 3, y: 4 }]);
    for (let i = 0; i < 40 && heard === before; i++) await new Promise((resolve) => setTimeout(resolve, 50));
    expect(heard).toBeGreaterThan(before);
    unsubscribe();
  });

  it("serialises concurrent moves and refuses what a player may not do", async () => {
    const map = await mapData.readBattleMap(dm, campaignId);
    if (!map.ok) throw new Error("read failed");
    const goblin = map.value.state.tokens.find((token) => token.label === "Goblin 1")!;
    const lia = map.value.state.tokens.find((token) => token.kind === "hero")!;
    expect(await mapData.changeBattleMap(player, campaignId, [{ type: "move", tokenId: goblin.id, x: 0, y: 0 }])).toEqual({ ok: false, error: "forbidden" });
    const results = await Promise.all([
      mapData.changeBattleMap(player, campaignId, [{ type: "move", tokenId: lia.id, x: 1, y: 1 }]),
      mapData.changeBattleMap(dm, campaignId, [{ type: "move", tokenId: goblin.id, x: 2, y: 2 }]),
      mapData.changeBattleMap(dm, campaignId, [{ type: "update", tokenId: goblin.id, defeated: true }]),
    ]);
    expect(results.every((result) => result.ok)).toBe(true);
    const after = await mapData.readBattleMap(dm, campaignId);
    expect(after.ok && after.value.version).toBe(map.value.version + 3);
    expect(after.ok && after.value.state.tokens.find((token) => token.id === goblin.id)).toMatchObject({ x: 2, y: 2, defeated: true });
    expect(after.ok && after.value.state.tokens.find((token) => token.id === lia.id)).toMatchObject({ x: 1, y: 1 });
  });

  it("stores a background picture apart from the state and lets only DMs change it", async () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
    expect(await mapData.setBattleMapBackground(player, campaignId, { bytes: png, mimeType: "image/png" })).toEqual({ ok: false, error: "forbidden" });
    const set = await mapData.setBattleMapBackground(dm, campaignId, { bytes: png, mimeType: "image/png" });
    const key = set.ok ? set.value.state.background?.key : undefined;
    expect(key).toMatch(/^[A-Za-z0-9_-]+$/);
    const read = await mapData.readBattleMapBackground(player, campaignId);
    expect(read.ok && read.value).toMatchObject({ mimeType: "image/png", key });
    expect(read.ok && read.value && Buffer.compare(read.value.image, png)).toBe(0);
    expect(await mapData.readBattleMapBackground(stranger, campaignId)).toEqual({ ok: false, error: "not-found" });
    const cleared = await mapData.setBattleMapBackground(dm, campaignId, null);
    expect(cleared.ok && cleared.value.state.background).toBeUndefined();
    expect(await mapData.readBattleMapBackground(player, campaignId)).toEqual({ ok: true, value: null });
  });

  it("with fog of war, players only receive the monsters their heroes can see", async () => {
    const map = await mapData.readBattleMap(dm, campaignId);
    if (!map.ok) throw new Error("read failed");
    const lia = map.value.state.tokens.find((token) => token.kind === "hero")!;
    const [first, second] = map.value.state.tokens.filter((token) => token.label.startsWith("Goblin"));
    const done = await mapData.changeBattleMap(dm, campaignId, [
      { type: "settings", fog: true },
      { type: "move", tokenId: lia.id, x: 5, y: 8 },
      { type: "update", tokenId: lia.id, vision: { range: 4, angle: 90 } },
      { type: "move", tokenId: first.id, x: 5, y: 5 },
      { type: "move", tokenId: second.id, x: 5, y: 9 },
    ]);
    expect(done.ok && done.value.state.tokens.filter((token) => token.kind === "monster")).toHaveLength(3);
    const seen = await mapData.readBattleMap(player, campaignId);
    expect(seen.ok && seen.value.state.tokens.filter((token) => token.kind === "monster").map((token) => token.id)).toEqual([first.id]);
    const turned = await mapData.changeBattleMap(player, campaignId, [{ type: "face", tokenId: lia.id, facing: 4 }]);
    expect(turned.ok && turned.value.state.tokens.filter((token) => token.kind === "monster").map((token) => token.id)).toEqual([second.id]);
    await mapData.changeBattleMap(dm, campaignId, [{ type: "settings", fog: false }]);
  });

  it("saves a map with its picture and brings it back later, for DMs only", async () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 9, 9]);
    await mapData.setBattleMapBackground(dm, campaignId, { bytes: png, mimeType: "image/png" });
    await mapData.changeBattleMap(dm, campaignId, [{ type: "add-walls", walls: [{ x1: 2, y1: 0, x2: 2, y2: 5 }, { x1: 2, y1: 5, x2: 2, y2: 6, door: "closed" }] }]);
    const before = await mapData.readBattleMap(dm, campaignId);
    if (!before.ok) throw new Error("read failed");

    expect(await mapData.createMapSave(player, campaignId, "Cripta")).toEqual({ ok: false, error: "forbidden" });
    expect(await mapData.listMapSaves(player, campaignId)).toEqual({ ok: false, error: "forbidden" });
    const saved = await mapData.createMapSave(dm, campaignId, "Cripta");
    expect(saved.ok && saved.value).toMatchObject([{ name: "Cripta", walls: 2, hasBackground: true, createdByName: "dm" }]);
    const saveId = saved.ok ? saved.value[0].id : "";

    const blank = await mapData.loadMapSave(dm, campaignId, null);
    expect(blank.ok && blank.value.state).toEqual({ cols: 20, rows: 14, tokens: [] });
    expect(await mapData.readBattleMapBackground(player, campaignId)).toEqual({ ok: true, value: null });

    expect(await mapData.loadMapSave(player, campaignId, saveId)).toEqual({ ok: false, error: "forbidden" });
    const loaded = await mapData.loadMapSave(dm, campaignId, saveId);
    if (!loaded.ok) throw new Error("load failed");
    const { background: _old, ...beforeRest } = before.value.state;
    const { background, ...loadedRest } = loaded.value.state;
    expect(loadedRest).toEqual(beforeRest);
    expect(background?.key).toMatch(/^[A-Za-z0-9_-]+$/);
    const picture = await mapData.readBattleMapBackground(player, campaignId);
    expect(picture.ok && picture.value && Buffer.compare(picture.value.image, png)).toBe(0);

    const left = await mapData.deleteMapSave(dm, campaignId, saveId);
    expect(left).toEqual({ ok: true, value: [] });
    expect(await mapData.loadMapSave(dm, campaignId, saveId)).toEqual({ ok: false, error: "not-found" });
  });

  it("holds players back at walls on the server too", async () => {
    const map = await mapData.readBattleMap(dm, campaignId);
    if (!map.ok) throw new Error("read failed");
    const lia = map.value.state.tokens.find((token) => token.kind === "hero")!;
    await mapData.changeBattleMap(dm, campaignId, [
      { type: "clear-walls" },
      { type: "move", tokenId: lia.id, x: 0, y: 0 },
      { type: "add-walls", walls: [{ x1: 1, y1: 0, x2: 1, y2: map.value.state.rows }] },
    ]);
    expect(await mapData.changeBattleMap(player, campaignId, [{ type: "move", tokenId: lia.id, x: 3, y: 0 }])).toEqual({ ok: false, error: "blocked" });
    expect((await mapData.changeBattleMap(player, campaignId, [{ type: "move", tokenId: lia.id, x: 0, y: 3 }])).ok).toBe(true);
    await mapData.changeBattleMap(dm, campaignId, [{ type: "clear-walls" }]);
  });

  it("drops a hero's token when the character leaves the campaign", async () => {
    await pool.query('UPDATE "character" SET "campaignId" = NULL WHERE "id" = $1', [heroId]);
    const map = await mapData.readBattleMap(dm, campaignId);
    expect(map.ok && map.value.state.tokens.some((token) => token.kind === "hero")).toBe(false);
  });
});
