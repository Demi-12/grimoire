/**
 * Campaigns, their roster and their invite links. DM and player are roles in one campaign, not in the
 * account: `readCampaignAccess` answers what the caller may do in a campaign, for this service and for the
 * others that hang off a campaign (characters, the encounter journal). Joining through a link is in invites/.
 */
import { randomBytes } from "node:crypto";
import { Injectable } from "@nestjs/common";
import { canCreateCampaign, canManageCampaign, INVITE_TTL_DAYS, type AppUser, type CampaignRole } from "@grimoire/shared/permissions";
import { fail, type DataError, type DataResult } from "../common/data-result.js";
import { pool, transaction, type Queryable } from "../database/db.js";

export interface CampaignView {
  id: string;
  name: string;
  description: string;
  ownerId: string;
  ownerName: string;
  myRole: CampaignRole | null;
  isOwner: boolean;
  canManage: boolean;
  members: { userId: string; name: string; role: CampaignRole }[];
}

type CampaignRow = { id: string; name: string; description: string; ownerId: string; ownerName: string; myRole: CampaignRole | null };

export type AddMemberError = DataError | "no-user" | "ambiguous" | "already-member";

export interface InviteView { id: string; token: string; createdByName: string; createdAt: string; expiresAt: string }

@Injectable()
export class CampaignsService {
  /** Campaigns the user owns or was added to, with their roster. */
  async listCampaigns(user: AppUser): Promise<CampaignView[]> {
    const campaigns = await pool.query<CampaignRow>(
      `SELECT k."id", k."name", k."description", k."ownerId", o."name" AS "ownerName", m."role" AS "myRole"
         FROM "campaign" k
         JOIN "user" o ON o."id" = k."ownerId"
         LEFT JOIN "campaign_member" m ON m."campaignId" = k."id" AND m."userId" = $1
        WHERE k."ownerId" = $1 OR m."userId" IS NOT NULL
        ORDER BY k."updatedAt" DESC`,
      [user.id],
    );
    if (!campaigns.rows.length) return [];
    const members = await pool.query<{ campaignId: string; userId: string; name: string; role: CampaignRole }>(
      `SELECT m."campaignId", m."userId", u."name", m."role"
         FROM "campaign_member" m JOIN "user" u ON u."id" = m."userId"
        WHERE m."campaignId" = ANY($1::uuid[])
        ORDER BY (m."role" = 'dm') DESC, u."name"`,
      [campaigns.rows.map((row) => row.id)],
    );
    const rosters = new Map<string, CampaignView["members"]>();
    for (const { campaignId, userId, name, role } of members.rows) {
      let roster = rosters.get(campaignId);
      if (!roster) rosters.set(campaignId, roster = []);
      roster.push({ userId, name, role });
    }
    return campaigns.rows.map((row) => ({
      ...row,
      isOwner: row.ownerId === user.id,
      canManage: canManageCampaign(user, row),
      members: rosters.get(row.id) ?? [],
    }));
  }

  /** The caller's role in a campaign, or null when they aren't on its roster. */
  async membershipRole(db: Queryable, campaignId: string, userId: string): Promise<CampaignRole | null> {
    const result = await db.query<{ role: CampaignRole }>(
      'SELECT "role" FROM "campaign_member" WHERE "campaignId" = $1 AND "userId" = $2',
      [campaignId, userId],
    );
    return result.rows[0]?.role ?? null;
  }

  /** What the caller may do in a campaign; null when it doesn't exist. Not `visible` means: answer as if it didn't. */
  async readCampaignAccess(db: Queryable, user: AppUser, campaignId: string) {
    const result = await db.query<{ ownerId: string }>('SELECT "ownerId" FROM "campaign" WHERE "id" = $1', [campaignId]);
    const campaign = result.rows[0];
    if (!campaign) return null;
    const myRole = await this.membershipRole(db, campaignId, user.id);
    const visible = campaign.ownerId === user.id || myRole !== null;
    return { ownerId: campaign.ownerId, myRole, visible, canManage: visible && canManageCampaign(user, { ownerId: campaign.ownerId, myRole }) };
  }

  async createCampaign(user: AppUser, input: { name: string; description: string }, db?: Queryable): Promise<DataResult<{ id: string }>> {
    if (!canCreateCampaign(user)) return fail("forbidden");
    const run = async (client: Queryable) => {
      const created = await client.query<{ id: string }>(
        'INSERT INTO "campaign" ("ownerId", "name", "description") VALUES ($1, $2, $3) RETURNING "id"',
        [user.id, input.name, input.description],
      );
      await client.query('INSERT INTO "campaign_member" ("campaignId", "userId", "role") VALUES ($1, $2, \'dm\')', [created.rows[0].id, user.id]);
      return created.rows[0];
    };
    return { ok: true, value: db ? await run(db) : await transaction(run) };
  }

  async updateCampaign(user: AppUser, campaignId: string, input: { name: string; description: string }): Promise<DataResult<null>> {
    const access = await this.readCampaignAccess(pool, user, campaignId);
    if (!access?.visible) return fail("not-found");
    if (!access.canManage) return fail("forbidden");
    await pool.query('UPDATE "campaign" SET "name" = $2, "description" = $3, "updatedAt" = now() WHERE "id" = $1', [campaignId, input.name, input.description]);
    return { ok: true, value: null };
  }

  /** Only the campaign's creator (or a site admin) can delete it; characters stay with their owners. */
  async deleteCampaign(user: AppUser, campaignId: string): Promise<DataResult<null>> {
    const access = await this.readCampaignAccess(pool, user, campaignId);
    if (!access?.visible) return fail("not-found");
    if (access.ownerId !== user.id && user.role !== "admin") return fail("forbidden");
    await pool.query('DELETE FROM "campaign" WHERE "id" = $1', [campaignId]);
    return { ok: true, value: null };
  }

  /**
   * A manager adds an account by exact email or exact name (case-insensitive). Nothing is listed:
   * a name shared by several accounts must be disambiguated with the email.
   */
  async addCampaignMemberByQuery(
    user: AppUser, campaignId: string, query: string, role: CampaignRole,
  ): Promise<{ ok: true; value: { name: string } } | { ok: false; error: AddMemberError }> {
    const access = await this.readCampaignAccess(pool, user, campaignId);
    if (!access?.visible) return { ok: false, error: "not-found" };
    if (!access.canManage) return { ok: false, error: "forbidden" };
    const found = await pool.query<{ id: string; name: string }>(
      `SELECT "id", "name" FROM "user"
        WHERE "status" = 'approved' AND (lower("email") = lower($1) OR lower("name") = lower($1)) LIMIT 2`,
      [query],
    );
    if (!found.rows.length) return { ok: false, error: "no-user" };
    if (found.rows.length > 1) return { ok: false, error: "ambiguous" };
    const target = found.rows[0];
    if (target.id === access.ownerId || await this.membershipRole(pool, campaignId, target.id)) return { ok: false, error: "already-member" };
    await pool.query('INSERT INTO "campaign_member" ("campaignId", "userId", "role") VALUES ($1, $2, $3)', [campaignId, target.id, role]);
    await pool.query('UPDATE "campaign" SET "updatedAt" = now() WHERE "id" = $1', [campaignId]);
    return { ok: true, value: { name: target.name } };
  }

  /** DM/player is a per-campaign role: managers change it for people who joined through an invite link. */
  async setCampaignMemberRole(user: AppUser, campaignId: string, memberId: string, role: CampaignRole): Promise<DataResult<null>> {
    const access = await this.readCampaignAccess(pool, user, campaignId);
    if (!access?.visible) return fail("not-found");
    if (!access.canManage) return fail("forbidden");
    if (memberId === access.ownerId) return fail("invalid");
    if (!(await this.membershipRole(pool, campaignId, memberId))) return fail("invalid");
    await pool.query('UPDATE "campaign_member" SET "role" = $3 WHERE "campaignId" = $1 AND "userId" = $2', [campaignId, memberId, role]);
    await pool.query('UPDATE "campaign" SET "updatedAt" = now() WHERE "id" = $1', [campaignId]);
    return { ok: true, value: null };
  }

  /** Managers remove anyone but the owner; any member can leave. Their characters leave with them. */
  async removeCampaignMember(user: AppUser, campaignId: string, memberId: string): Promise<DataResult<null>> {
    const access = await this.readCampaignAccess(pool, user, campaignId);
    if (!access?.visible) return fail("not-found");
    if (memberId === access.ownerId) return fail("invalid");
    if (memberId !== user.id && !access.canManage) return fail("forbidden");
    await transaction(async (client) => {
      await client.query('DELETE FROM "campaign_member" WHERE "campaignId" = $1 AND "userId" = $2', [campaignId, memberId]);
      await client.query('UPDATE "character" SET "campaignId" = NULL, "updatedAt" = now() WHERE "campaignId" = $1 AND "ownerId" = $2', [campaignId, memberId]);
    });
    return { ok: true, value: null };
  }

  /** A DM can take a character out of their campaign; the owner keeps the character. */
  async removeCampaignCharacter(user: AppUser, campaignId: string, characterId: string): Promise<DataResult<null>> {
    const access = await this.readCampaignAccess(pool, user, campaignId);
    if (!access?.visible) return fail("not-found");
    const character = await pool.query<{ ownerId: string }>('SELECT "ownerId" FROM "character" WHERE "id" = $1 AND "campaignId" = $2', [characterId, campaignId]);
    if (!character.rows[0]) return fail("not-found");
    if (character.rows[0].ownerId !== user.id && !access.canManage) return fail("forbidden");
    await pool.query('UPDATE "character" SET "campaignId" = NULL, "updatedAt" = now() WHERE "id" = $1', [characterId]);
    return { ok: true, value: null };
  }

  /** Live (unexpired) invite links of a campaign, for its managers. */
  async listCampaignInvites(user: AppUser, campaignId: string): Promise<DataResult<InviteView[]>> {
    const access = await this.readCampaignAccess(pool, user, campaignId);
    if (!access?.visible) return fail("not-found");
    if (!access.canManage) return fail("forbidden");
    const result = await pool.query<{ id: string; token: string; createdByName: string; createdAt: Date; expiresAt: Date }>(
      `SELECT i."id", i."token", u."name" AS "createdByName", i."createdAt", i."expiresAt"
         FROM "campaign_invite" i JOIN "user" u ON u."id" = i."createdBy"
        WHERE i."campaignId" = $1 AND i."expiresAt" > now()
        ORDER BY i."createdAt" DESC`,
      [campaignId],
    );
    return { ok: true, value: result.rows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString(), expiresAt: row.expiresAt.toISOString() })) };
  }

  async createCampaignInvite(user: AppUser, campaignId: string): Promise<DataResult<InviteView>> {
    const access = await this.readCampaignAccess(pool, user, campaignId);
    if (!access?.visible) return fail("not-found");
    if (!access.canManage) return fail("forbidden");
    const token = randomBytes(32).toString("base64url");
    const result = await pool.query<{ id: string; createdAt: Date; expiresAt: Date }>(
      `INSERT INTO "campaign_invite" ("campaignId", "token", "createdBy", "expiresAt")
       VALUES ($1, $2, $3, now() + make_interval(days => $4)) RETURNING "id", "createdAt", "expiresAt"`,
      [campaignId, token, user.id, INVITE_TTL_DAYS],
    );
    const row = result.rows[0];
    return { ok: true, value: { id: row.id, token, createdByName: user.name, createdAt: row.createdAt.toISOString(), expiresAt: row.expiresAt.toISOString() } };
  }

  async revokeCampaignInvite(user: AppUser, campaignId: string, inviteId: string): Promise<DataResult<null>> {
    const access = await this.readCampaignAccess(pool, user, campaignId);
    if (!access?.visible) return fail("not-found");
    if (!access.canManage) return fail("forbidden");
    await pool.query('DELETE FROM "campaign_invite" WHERE "id" = $1 AND "campaignId" = $2', [inviteId, campaignId]);
    return { ok: true, value: null };
  }
}
