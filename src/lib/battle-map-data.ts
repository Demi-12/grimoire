import "server-only";
import { randomBytes } from "node:crypto";
import type { QueryResult, QueryResultRow } from "pg";
import { pool, transaction } from "@/lib/db";
import { canManageCampaign, type AppUser, type CampaignRole } from "@/lib/permissions";
import {
  applyMapOps, emptyMapState, normalizeMapState, syncHeroes, visibleMapState,
  type MapHero, type MapImageType, type MapOp, type MapOpError, type MapState,
} from "@/lib/battle-map";

type Queryable = { query<R extends QueryResultRow>(text: string, values?: unknown[]): Promise<QueryResult<R>> };

/** PostgreSQL channel that carries the id of a campaign whose map just changed (see battle-map-hub.ts). */
export const BATTLE_MAP_CHANNEL = "grimoire_battle_map";

/** Who is looking: a DM sees hidden monsters unless they asked for the players' view (e.g. the table display). */
export type MapAudience = "auto" | "players";

export interface BattleMapView {
  campaignId: string;
  campaignName: string;
  version: number;
  /** Owner, co-DM or site admin: may add monsters, hide/reveal, resize. */
  isDm: boolean;
  /** Hidden monsters are included (DM with the DM view). */
  showsHidden: boolean;
  heroes: (MapHero & { mine: boolean })[];
  state: MapState;
  updatedAt: string;
}

export type MapResult<T> = { ok: true; value: T } | { ok: false; error: "not-found" | "limit" | MapOpError };

interface MapContext { campaignName: string; isDm: boolean; heroes: MapHero[] }

/** Campaign membership and heroes; null when the user can't see the campaign. */
async function readContext(db: Queryable, user: AppUser, campaignId: string): Promise<MapContext | null> {
  const campaign = await db.query<{ name: string; ownerId: string; myRole: CampaignRole | null }>(
    `SELECT k."name", k."ownerId", m."role" AS "myRole"
       FROM "campaign" k LEFT JOIN "campaign_member" m ON m."campaignId" = k."id" AND m."userId" = $2
      WHERE k."id" = $1`,
    [campaignId, user.id],
  );
  const row = campaign.rows[0];
  if (!row || (row.ownerId !== user.id && row.myRole === null)) return null;
  const heroes = await db.query<MapHero>(
    'SELECT "id", "name", "ownerId" FROM "character" WHERE "campaignId" = $1 ORDER BY "createdAt", "id"',
    [campaignId],
  );
  return { campaignName: row.name, isDm: canManageCampaign(user, row), heroes: heroes.rows };
}

function toView(user: AppUser, campaignId: string, context: MapContext, row: { state: unknown; version: number; updatedAt: Date } | undefined, audience: MapAudience): BattleMapView {
  const showsHidden = context.isDm && audience !== "players";
  const state = syncHeroes(normalizeMapState(row?.state ?? emptyMapState()), context.heroes);
  return {
    campaignId,
    campaignName: context.campaignName,
    version: row?.version ?? 0,
    isDm: context.isDm,
    showsHidden,
    heroes: context.heroes.map((hero) => ({ ...hero, mine: hero.ownerId === user.id })),
    state: visibleMapState(state, showsHidden),
    updatedAt: (row?.updatedAt ?? new Date(0)).toISOString(),
  };
}

/**
 * The campaign's map as this member may see it. Every member of the campaign can open it.
 * One round trip: every open live stream of the campaign runs this after each change.
 */
export async function readBattleMap(user: AppUser, campaignId: string, audience: MapAudience = "auto"): Promise<MapResult<BattleMapView>> {
  const result = await pool.query<{
    name: string; ownerId: string; myRole: CampaignRole | null; heroes: MapHero[];
    state: unknown; version: number | null; updatedAt: Date | null;
  }>(
    `SELECT k."name", k."ownerId", m."role" AS "myRole", b."state", b."version", b."updatedAt",
            COALESCE((SELECT json_agg(json_build_object('id', c."id", 'name', c."name", 'ownerId', c."ownerId") ORDER BY c."createdAt", c."id")
                        FROM "character" c WHERE c."campaignId" = k."id"), '[]'::json) AS "heroes"
       FROM "campaign" k
       LEFT JOIN "campaign_member" m ON m."campaignId" = k."id" AND m."userId" = $2
       LEFT JOIN "battle_map" b ON b."campaignId" = k."id"
      WHERE k."id" = $1`,
    [campaignId, user.id],
  );
  const row = result.rows[0];
  if (!row || (row.ownerId !== user.id && row.myRole === null)) return { ok: false, error: "not-found" };
  const context: MapContext = { campaignName: row.name, isDm: canManageCampaign(user, row), heroes: row.heroes };
  const saved = row.version === null || row.updatedAt === null ? undefined : { state: row.state, version: row.version, updatedAt: row.updatedAt };
  return { ok: true, value: toView(user, campaignId, context, saved, audience) };
}

const newTokenId = () => randomBytes(9).toString("base64url");

/**
 * Apply a batch of changes under a row lock, so simultaneous moves from several devices are serialised,
 * then tell every open stream (on any app instance) through PostgreSQL NOTIFY, which fires on commit.
 */
export async function changeBattleMap(user: AppUser, campaignId: string, ops: MapOp[], audience: MapAudience = "auto"): Promise<MapResult<BattleMapView>> {
  return transaction(async (client) => {
    const context = await readContext(client, user, campaignId);
    if (!context) return { ok: false as const, error: "not-found" as const };
    const start = syncHeroes(await lockMap(client, campaignId), context.heroes);
    const applied = applyMapOps(start, ops, { userId: user.id, isDm: context.isDm }, context.heroes, newTokenId);
    if (!applied.ok) return { ok: false as const, error: applied.error };
    // The table refuses states over 60 000 bytes; say "invalid" instead of failing with a database error.
    if (JSON.stringify(applied.state).length > MAP_STATE_MAX_CHARS) return { ok: false as const, error: "invalid" as const };
    return { ok: true as const, value: await writeMap(client, user, campaignId, context, applied.state, audience) };
  });
}

/** Leaves room under the battle_map.state limit (60 000 bytes) for multi-byte characters in labels. */
const MAP_STATE_MAX_CHARS = 56_000;

/** The campaign's background picture, for any member; null when there is none. */
export async function readBattleMapBackground(user: AppUser, campaignId: string): Promise<MapResult<{ image: Buffer; mimeType: MapImageType; key: string } | null>> {
  const context = await readContext(pool, user, campaignId);
  if (!context) return { ok: false, error: "not-found" };
  const result = await pool.query<{ image: Buffer; mimeType: MapImageType; key: string }>(
    'SELECT "image", "mimeType", "key" FROM "battle_map_background" WHERE "campaignId" = $1',
    [campaignId],
  );
  return { ok: true, value: result.rows[0] ?? null };
}

/** Lock the campaign's map row (creating it if needed) and return its current state. */
async function lockMap(client: Queryable, campaignId: string): Promise<MapState> {
  await client.query(
    'INSERT INTO "battle_map" ("campaignId", "state") VALUES ($1, $2) ON CONFLICT ("campaignId") DO NOTHING',
    [campaignId, JSON.stringify(emptyMapState())],
  );
  const current = await client.query<{ state: unknown }>('SELECT "state" FROM "battle_map" WHERE "campaignId" = $1 FOR UPDATE', [campaignId]);
  return normalizeMapState(current.rows[0]?.state);
}

/** Store a new state, bump the version and tell every open stream. */
async function writeMap(client: Queryable, user: AppUser, campaignId: string, context: MapContext, state: MapState, audience: MapAudience): Promise<BattleMapView> {
  const saved = await client.query<{ state: unknown; version: number; updatedAt: Date }>(
    `UPDATE "battle_map" SET "state" = $2, "version" = "version" + 1, "updatedAt" = now()
      WHERE "campaignId" = $1 RETURNING "state", "version", "updatedAt"`,
    [campaignId, JSON.stringify(state)],
  );
  await client.query("SELECT pg_notify($1, $2)", [BATTLE_MAP_CHANNEL, campaignId]);
  return toView(user, campaignId, context, saved.rows[0], audience);
}

const newBackgroundKey = () => randomBytes(9).toString("base64url");

/**
 * Replace (or with null, remove) the background picture. DMs only. The picture lives in its own table so the
 * map state that travels on every change stays small; the state only carries its key, which changes each time.
 */
export async function setBattleMapBackground(user: AppUser, campaignId: string, image: { bytes: Buffer; mimeType: MapImageType } | null, audience: MapAudience = "auto"): Promise<MapResult<BattleMapView>> {
  return transaction(async (client) => {
    const context = await readContext(client, user, campaignId);
    if (!context) return { ok: false as const, error: "not-found" as const };
    if (!context.isDm) return { ok: false as const, error: "forbidden" as const };
    const state: MapState = { ...await lockMap(client, campaignId) };
    if (image) {
      const key = newBackgroundKey();
      await client.query(
        `INSERT INTO "battle_map_background" ("campaignId", "image", "mimeType", "key") VALUES ($1, $2, $3, $4)
         ON CONFLICT ("campaignId") DO UPDATE SET "image" = EXCLUDED."image", "mimeType" = EXCLUDED."mimeType", "key" = EXCLUDED."key", "updatedAt" = now()`,
        [campaignId, image.bytes, image.mimeType, key],
      );
      state.background = { key };
    } else {
      await client.query('DELETE FROM "battle_map_background" WHERE "campaignId" = $1', [campaignId]);
      delete state.background;
    }
    return { ok: true as const, value: await writeMap(client, user, campaignId, context, state, audience) };
  });
}

/** Saved maps a campaign may keep, and the longest name. */
export const MAP_MAX_SAVES = 20;
export const MAP_SAVE_NAME_MAX = 60;

export interface MapSaveSummary {
  id: string; name: string; cols: number; rows: number; tokens: number; walls: number;
  hasBackground: boolean; createdByName: string | null; createdAt: string;
}

/** Saved maps of the campaign, newest first (DMs only). */
export async function listMapSaves(user: AppUser, campaignId: string): Promise<MapResult<MapSaveSummary[]>> {
  const context = await readContext(pool, user, campaignId);
  if (!context) return { ok: false, error: "not-found" };
  if (!context.isDm) return { ok: false, error: "forbidden" };
  const result = await pool.query<{ id: string; name: string; state: unknown; hasBackground: boolean; createdByName: string | null; createdAt: Date }>(
    `SELECT s."id", s."name", s."state", s."image" IS NOT NULL AS "hasBackground", u."name" AS "createdByName", s."createdAt"
       FROM "battle_map_save" s LEFT JOIN "user" u ON u."id" = s."createdBy"
      WHERE s."campaignId" = $1 ORDER BY s."createdAt" DESC, s."id"`,
    [campaignId],
  );
  return {
    ok: true,
    value: result.rows.map((row) => {
      const state = normalizeMapState(row.state);
      return {
        id: row.id, name: row.name, cols: state.cols, rows: state.rows, tokens: state.tokens.length, walls: state.walls?.length ?? 0,
        hasBackground: row.hasBackground, createdByName: row.createdByName, createdAt: row.createdAt.toISOString(),
      };
    }),
  };
}

/** Keep a copy of the map as it is now, background picture included (DMs only). */
export async function createMapSave(user: AppUser, campaignId: string, name: string): Promise<MapResult<MapSaveSummary[]>> {
  const saved = await transaction(async (client) => {
    const context = await readContext(client, user, campaignId);
    if (!context) return { ok: false as const, error: "not-found" as const };
    if (!context.isDm) return { ok: false as const, error: "forbidden" as const };
    const state = await lockMap(client, campaignId); // also keeps two saves from racing past the limit
    const count = await client.query<{ n: string }>('SELECT count(*) AS "n" FROM "battle_map_save" WHERE "campaignId" = $1', [campaignId]);
    if (Number(count.rows[0]?.n ?? 0) >= MAP_MAX_SAVES) return { ok: false as const, error: "limit" as const };
    const stored: MapState = { ...state };
    delete stored.background;
    await client.query(
      `INSERT INTO "battle_map_save" ("campaignId", "name", "state", "image", "mimeType", "createdBy")
       SELECT $1, $2, $3, b."image", b."mimeType", $4
         FROM (SELECT 1) AS one LEFT JOIN "battle_map_background" b ON b."campaignId" = $1 AND $5::boolean`,
      [campaignId, name, JSON.stringify(stored), user.id, Boolean(state.background)],
    );
    return { ok: true as const };
  });
  return saved.ok ? listMapSaves(user, campaignId) : saved;
}

/**
 * Put a saved map (or, with null, an empty one) on the table in place of the current one, background
 * included. Heroes that have left the campaign since are dropped. DMs only.
 */
export async function loadMapSave(user: AppUser, campaignId: string, saveId: string | null, audience: MapAudience = "auto"): Promise<MapResult<BattleMapView>> {
  return transaction(async (client) => {
    const context = await readContext(client, user, campaignId);
    if (!context) return { ok: false as const, error: "not-found" as const };
    if (!context.isDm) return { ok: false as const, error: "forbidden" as const };
    let state: MapState = emptyMapState();
    let image: { image: Buffer; mimeType: MapImageType } | null = null;
    if (saveId) {
      const save = await client.query<{ state: unknown; image: Buffer | null; mimeType: MapImageType | null }>(
        'SELECT "state", "image", "mimeType" FROM "battle_map_save" WHERE "id" = $1 AND "campaignId" = $2',
        [saveId, campaignId],
      );
      const row = save.rows[0];
      if (!row) return { ok: false as const, error: "not-found" as const };
      state = normalizeMapState(row.state);
      if (row.image && row.mimeType) image = { image: row.image, mimeType: row.mimeType };
    }
    await lockMap(client, campaignId);
    state = syncHeroes({ ...state }, context.heroes);
    delete state.background;
    if (image) {
      const key = newBackgroundKey();
      await client.query(
        `INSERT INTO "battle_map_background" ("campaignId", "image", "mimeType", "key") VALUES ($1, $2, $3, $4)
         ON CONFLICT ("campaignId") DO UPDATE SET "image" = EXCLUDED."image", "mimeType" = EXCLUDED."mimeType", "key" = EXCLUDED."key", "updatedAt" = now()`,
        [campaignId, image.image, image.mimeType, key],
      );
      state.background = { key };
    } else {
      await client.query('DELETE FROM "battle_map_background" WHERE "campaignId" = $1', [campaignId]);
    }
    return { ok: true as const, value: await writeMap(client, user, campaignId, context, state, audience) };
  });
}

/** Delete a saved map (DMs only); the map on the table is untouched. */
export async function deleteMapSave(user: AppUser, campaignId: string, saveId: string): Promise<MapResult<MapSaveSummary[]>> {
  const context = await readContext(pool, user, campaignId);
  if (!context) return { ok: false, error: "not-found" };
  if (!context.isDm) return { ok: false, error: "forbidden" };
  await pool.query('DELETE FROM "battle_map_save" WHERE "id" = $1 AND "campaignId" = $2', [saveId, campaignId]);
  return listMapSaves(user, campaignId);
}
