/**
 * Homebrew monsters: private by default, shareable with campaigns or with the whole instance, and lockable
 * by an admin. Who may see a row is decided in one place, the WHERE of `homebrewSelect`.
 */
import { Injectable } from "@nestjs/common";
import {
  canDeleteHomebrew, canEditHomebrew, canModerateHomebrew, canPublishHomebrew,
  type HomebrewInput, type HomebrewSummary, type HomebrewVisibility,
} from "@grimoire/shared/homebrew";
import { inferMonsterRoles, type MonsterRole, type MonsterStatBlock } from "@grimoire/shared/monster-api";
import type { AppUser } from "@grimoire/shared/permissions";
import { fail, type DataResult } from "../common/data-result.js";
import { pool, transaction, type Queryable } from "../database/db.js";

export interface HomebrewView {
  id: string; ownerId: string; ownerName: string; mine: boolean;
  name: string; cr: number; xp: number; type: string; roleTags: MonsterRole[];
  visibility: HomebrewVisibility; locked: boolean; campaignIds: string[];
  statBlock: MonsterStatBlock; updatedAt: string;
}

type HomebrewRow = {
  id: string; ownerId: string; ownerName: string; name: string; cr: string; xp: number; type: string;
  visibility: HomebrewVisibility; locked: boolean; campaignIds: string[]; statBlock: MonsterStatBlock; updatedAt: Date;
};

/**
 * Role tags are worked out again from the stored stat block on every read, so a monster saved under older
 * role rules shows today's tags. The "roleTags" column is still written on save, but never read back.
 */
const toHomebrewView = (row: HomebrewRow, viewerId: string): HomebrewView => ({
  id: row.id, ownerId: row.ownerId, ownerName: row.ownerName, mine: row.ownerId === viewerId,
  name: row.name, cr: Number(row.cr), xp: row.xp, type: row.type, roleTags: inferMonsterRoles(row.statBlock),
  visibility: row.visibility, locked: row.locked, campaignIds: row.campaignIds,
  statBlock: row.statBlock, updatedAt: row.updatedAt.toISOString(),
});

const MAX_HOMEBREW_PER_USER = 200;

/**
 * Rows the viewer may see: their own, anything published to the instance, anything shared with a
 * campaign they belong to, and (for admins, so they can moderate) any published or locked monster.
 * Other people's private work never matches, so a hidden monster looks exactly like a missing one.
 */
const homebrewSelect = `
  SELECT h."id", h."ownerId", u."name" AS "ownerName", h."name", h."cr", h."xp", h."type",
         h."visibility", h."locked", h."statBlock", h."updatedAt",
         COALESCE(array_agg(hc."campaignId"::text) FILTER (WHERE hc."campaignId" IS NOT NULL), '{}') AS "campaignIds"
    FROM "homebrew_monster" h
    JOIN "user" u ON u."id" = h."ownerId"
    LEFT JOIN "homebrew_monster_campaign" hc ON hc."monsterId" = h."id"
   WHERE (h."ownerId" = $1
          OR h."visibility" = 'instance'
          OR ($2::boolean AND (h."visibility" <> 'private' OR h."locked"))
          OR (h."visibility" = 'campaign' AND EXISTS (
                SELECT 1 FROM "homebrew_monster_campaign" x
                  JOIN "campaign_member" m ON m."campaignId" = x."campaignId"
                 WHERE x."monsterId" = h."id" AND m."userId" = $1)))`;
const homebrewGroup = ' GROUP BY h."id", u."name"';

async function readHomebrew(db: Queryable, user: AppUser, id: string): Promise<HomebrewView | null> {
  const result = await db.query<HomebrewRow>(`${homebrewSelect} AND h."id" = $3${homebrewGroup}`, [user.id, user.role === "admin", id]);
  return result.rows[0] ? toHomebrewView(result.rows[0], user.id) : null;
}

/** Every campaign in `campaignIds` must be one the owner belongs to. */
async function ownsAllCampaigns(db: Queryable, userId: string, campaignIds: string[]): Promise<boolean> {
  if (!campaignIds.length) return true;
  const result = await db.query<{ n: string }>(
    'SELECT count(*) AS n FROM "campaign_member" WHERE "userId" = $1 AND "campaignId" = ANY($2::uuid[])',
    [userId, campaignIds],
  );
  return Number(result.rows[0].n) === campaignIds.length;
}

async function replaceHomebrewCampaigns(db: Queryable, monsterId: string, campaignIds: string[]) {
  await db.query('DELETE FROM "homebrew_monster_campaign" WHERE "monsterId" = $1', [monsterId]);
  if (campaignIds.length) {
    await db.query(
      'INSERT INTO "homebrew_monster_campaign" ("monsterId", "campaignId") SELECT $1, unnest($2::uuid[])',
      [monsterId, campaignIds],
    );
  }
}

@Injectable()
export class HomebrewService {
  async listHomebrew(user: AppUser): Promise<HomebrewView[]> {
    const result = await pool.query<HomebrewRow>(
      `${homebrewSelect}${homebrewGroup} ORDER BY (h."ownerId" = $1) DESC, h."updatedAt" DESC LIMIT 500`,
      [user.id, user.role === "admin"],
    );
    return result.rows.map((row) => toHomebrewView(row, user.id));
  }

  readHomebrewForUser(user: AppUser, id: string) {
    return readHomebrew(pool, user, id);
  }

  /** Stat blocks of the given monsters that the viewer may see, by id; hidden or missing ones are left out. */
  async visibleStatBlocks(user: AppUser, ids: string[]): Promise<Map<string, MonsterStatBlock>> {
    if (!ids.length) return new Map();
    const result = await pool.query<HomebrewRow>(`${homebrewSelect} AND h."id" = ANY($3::uuid[])${homebrewGroup}`, [user.id, user.role === "admin", ids]);
    return new Map(result.rows.map((row) => [row.id, row.statBlock]));
  }

  async createHomebrew(user: AppUser, input: HomebrewInput, summary: HomebrewSummary): Promise<DataResult<HomebrewView>> {
    return transaction(async (client) => {
      const count = await client.query<{ n: string }>('SELECT count(*) AS n FROM "homebrew_monster" WHERE "ownerId" = $1', [user.id]);
      if (Number(count.rows[0].n) >= MAX_HOMEBREW_PER_USER) return fail<HomebrewView>("invalid");
      if (!(await ownsAllCampaigns(client, user.id, input.campaignIds))) return fail<HomebrewView>("forbidden");
      const inserted = await client.query<{ id: string }>(
        `INSERT INTO "homebrew_monster" ("ownerId", "name", "cr", "xp", "type", "roleTags", "statBlock", "visibility")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING "id"`,
        [user.id, summary.name, summary.cr, summary.xp, summary.type, JSON.stringify(summary.roleTags), JSON.stringify(input.statBlock), input.visibility],
      );
      const id = inserted.rows[0].id;
      await replaceHomebrewCampaigns(client, id, input.campaignIds);
      return { ok: true as const, value: (await readHomebrew(client, user, id)) as HomebrewView };
    });
  }

  async updateHomebrew(user: AppUser, id: string, input: HomebrewInput, summary: HomebrewSummary): Promise<DataResult<HomebrewView>> {
    return transaction(async (client) => {
      const current = await readHomebrew(client, user, id);
      if (!current) return fail<HomebrewView>("not-found");
      if (!canEditHomebrew(user, current)) return fail<HomebrewView>("forbidden");
      if (!canPublishHomebrew(current, input.visibility)) return fail<HomebrewView>("forbidden");
      if (!(await ownsAllCampaigns(client, user.id, input.campaignIds))) return fail<HomebrewView>("forbidden");
      await client.query(
        `UPDATE "homebrew_monster"
            SET "name" = $2, "cr" = $3, "xp" = $4, "type" = $5, "roleTags" = $6, "statBlock" = $7, "visibility" = $8, "updatedAt" = now()
          WHERE "id" = $1`,
        [id, summary.name, summary.cr, summary.xp, summary.type, JSON.stringify(summary.roleTags), JSON.stringify(input.statBlock), input.visibility],
      );
      await replaceHomebrewCampaigns(client, id, input.campaignIds);
      return { ok: true as const, value: (await readHomebrew(client, user, id)) as HomebrewView };
    });
  }

  async deleteHomebrew(user: AppUser, id: string): Promise<DataResult<null>> {
    const current = await readHomebrew(pool, user, id);
    if (!current) return fail("not-found");
    if (!canDeleteHomebrew(user, current)) return fail("forbidden");
    await pool.query('DELETE FROM "homebrew_monster" WHERE "id" = $1', [id]);
    return { ok: true, value: null };
  }

  /**
   * Admin moderation: locking forces a published monster back to private and stops its owner from
   * publishing it again; unlocking only lifts that restriction.
   */
  async setHomebrewLocked(user: AppUser, id: string, locked: boolean): Promise<DataResult<HomebrewView>> {
    if (!canModerateHomebrew(user)) return fail("forbidden");
    return transaction(async (client) => {
      const current = await readHomebrew(client, user, id);
      if (!current) return fail<HomebrewView>("not-found");
      await client.query(
        'UPDATE "homebrew_monster" SET "locked" = $2, "visibility" = CASE WHEN $2 THEN \'private\' ELSE "visibility" END, "updatedAt" = now() WHERE "id" = $1',
        [id, locked],
      );
      if (locked) await client.query('DELETE FROM "homebrew_monster_campaign" WHERE "monsterId" = $1', [id]);
      // After locking, the admin can no longer see the (now private) monster, so read it back as its owner.
      const owner = { ...user, id: current.ownerId };
      return { ok: true as const, value: { ...((await readHomebrew(client, owner, id)) as HomebrewView), mine: false } };
    });
  }
}
