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

export type MapResult<T> = { ok: true; value: T } | { ok: false; error: "not-found" | MapOpError };

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

/** The campaign's map as this member may see it. Every member of the campaign can open it. */
export async function readBattleMap(user: AppUser, campaignId: string, audience: MapAudience = "auto"): Promise<MapResult<BattleMapView>> {
  const context = await readContext(pool, user, campaignId);
  if (!context) return { ok: false, error: "not-found" };
  const result = await pool.query<{ state: unknown; version: number; updatedAt: Date }>(
    'SELECT "state", "version", "updatedAt" FROM "battle_map" WHERE "campaignId" = $1',
    [campaignId],
  );
  return { ok: true, value: toView(user, campaignId, context, result.rows[0], audience) };
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
    await client.query(
      'INSERT INTO "battle_map" ("campaignId", "state") VALUES ($1, $2) ON CONFLICT ("campaignId") DO NOTHING',
      [campaignId, JSON.stringify(emptyMapState())],
    );
    const current = await client.query<{ state: unknown }>('SELECT "state" FROM "battle_map" WHERE "campaignId" = $1 FOR UPDATE', [campaignId]);
    const start = syncHeroes(normalizeMapState(current.rows[0]?.state), context.heroes);
    const applied = applyMapOps(start, ops, { userId: user.id, isDm: context.isDm }, context.heroes, newTokenId);
    if (!applied.ok) return { ok: false as const, error: applied.error };
    const saved = await client.query<{ state: unknown; version: number; updatedAt: Date }>(
      `UPDATE "battle_map" SET "state" = $2, "version" = "version" + 1, "updatedAt" = now()
        WHERE "campaignId" = $1 RETURNING "state", "version", "updatedAt"`,
      [campaignId, JSON.stringify(applied.state)],
    );
    await client.query("SELECT pg_notify($1, $2)", [BATTLE_MAP_CHANNEL, campaignId]);
    return { ok: true as const, value: toView(user, campaignId, context, saved.rows[0], audience) };
  });
}

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

/**
 * Replace (or with null, remove) the background picture. DMs only. The picture lives in its own table so the
 * map state that travels on every change stays small; the state only carries its key, which changes each time.
 */
export async function setBattleMapBackground(user: AppUser, campaignId: string, image: { bytes: Buffer; mimeType: MapImageType } | null, audience: MapAudience = "auto"): Promise<MapResult<BattleMapView>> {
  return transaction(async (client) => {
    const context = await readContext(client, user, campaignId);
    if (!context) return { ok: false as const, error: "not-found" as const };
    if (!context.isDm) return { ok: false as const, error: "forbidden" as const };
    await client.query(
      'INSERT INTO "battle_map" ("campaignId", "state") VALUES ($1, $2) ON CONFLICT ("campaignId") DO NOTHING',
      [campaignId, JSON.stringify(emptyMapState())],
    );
    const current = await client.query<{ state: unknown }>('SELECT "state" FROM "battle_map" WHERE "campaignId" = $1 FOR UPDATE', [campaignId]);
    const state: MapState = { ...normalizeMapState(current.rows[0]?.state) };
    if (image) {
      const key = randomBytes(9).toString("base64url");
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
    const saved = await client.query<{ state: unknown; version: number; updatedAt: Date }>(
      `UPDATE "battle_map" SET "state" = $2, "version" = "version" + 1, "updatedAt" = now()
        WHERE "campaignId" = $1 RETURNING "state", "version", "updatedAt"`,
      [campaignId, JSON.stringify(state)],
    );
    await client.query("SELECT pg_notify($1, $2)", [BATTLE_MAP_CHANNEL, campaignId]);
    return { ok: true as const, value: toView(user, campaignId, context, saved.rows[0], audience) };
  });
}
