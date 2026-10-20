import "server-only";
import type { QueryResult, QueryResultRow } from "pg";
import { pool, transaction } from "@/lib/db";
import {
  canCreateCampaign,
  canManageCampaign,
  type AccountStatus,
  type AppUser,
  type CampaignRole,
  type CharacterInput,
  type CharacterScores,
  type SiteRole,
} from "@/lib/permissions";

/** Either the shared pool or a client inside a transaction. */
type Queryable = { query<R extends QueryResultRow>(text: string, values?: unknown[]): Promise<QueryResult<R>> };

export interface CharacterView {
  id: string;
  ownerId: string;
  ownerName: string;
  campaignId: string | null;
  name: string;
  level: number;
  className: string;
  species: string;
  background: string;
  scores: CharacterScores;
  notes: string;
  build?: Record<string, unknown>;
  editable: boolean;
}

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

export interface DirectoryUser { id: string; name: string; role: SiteRole }

export interface AdminUserView {
  id: string;
  name: string;
  email: string;
  role: SiteRole;
  status: AccountStatus;
  emailVerified: boolean;
  twoFactorEnabled: boolean;
  createdAt: string;
  campaignCount: number;
  characterCount: number;
}

type CharacterRow = {
  id: string; ownerId: string; ownerName: string; campaignId: string | null; name: string; level: number;
  data: { className?: string; species?: string; background?: string; scores?: CharacterScores; notes?: string; build?: Record<string, unknown> };
};

const defaultScores: CharacterScores = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };

function toCharacterView(row: CharacterRow, viewerId: string): CharacterView {
  return {
    id: row.id,
    ownerId: row.ownerId,
    ownerName: row.ownerName,
    campaignId: row.campaignId,
    name: row.name,
    level: row.level,
    className: row.data.className ?? "",
    species: row.data.species ?? "",
    background: row.data.background ?? "",
    scores: { ...defaultScores, ...row.data.scores },
    notes: row.data.notes ?? "",
    ...(row.data.build ? { build: row.data.build } : {}),
    editable: row.ownerId === viewerId,
  };
}

const characterColumns = `c."id", c."ownerId", u."name" AS "ownerName", c."campaignId", c."name", c."level", c."data"`;

/** Own characters plus every character placed in a campaign the user belongs to. */
export async function listCharacters(user: AppUser): Promise<CharacterView[]> {
  const result = await pool.query<CharacterRow>(
    `SELECT ${characterColumns}
       FROM "character" c JOIN "user" u ON u."id" = c."ownerId"
      WHERE c."ownerId" = $1
         OR c."campaignId" IN (SELECT "campaignId" FROM "campaign_member" WHERE "userId" = $1)
      ORDER BY (c."ownerId" = $1) DESC, c."updatedAt" DESC`,
    [user.id],
  );
  return result.rows.map((row) => toCharacterView(row, user.id));
}

async function membershipRole(db: Queryable, campaignId: string, userId: string): Promise<CampaignRole | null> {
  const result = await db.query<{ role: CampaignRole }>(
    'SELECT "role" FROM "campaign_member" WHERE "campaignId" = $1 AND "userId" = $2',
    [campaignId, userId],
  );
  return result.rows[0]?.role ?? null;
}

function characterData(input: CharacterInput) {
  return { className: input.className, species: input.species, background: input.background, scores: input.scores, notes: input.notes, ...(input.build ? { build: input.build } : {}) };
}

export type DataError = "not-found" | "forbidden" | "invalid";
export type DataResult<T> = { ok: true; value: T } | { ok: false; error: DataError };
const fail = <T>(error: DataError): DataResult<T> => ({ ok: false, error });

async function readCharacter(db: Queryable, id: string, viewerId: string): Promise<CharacterView | null> {
  const result = await db.query<CharacterRow>(
    `SELECT ${characterColumns} FROM "character" c JOIN "user" u ON u."id" = c."ownerId" WHERE c."id" = $1`,
    [id],
  );
  return result.rows[0] ? toCharacterView(result.rows[0], viewerId) : null;
}

export async function createCharacter(user: AppUser, input: CharacterInput, db: Queryable = pool): Promise<DataResult<CharacterView>> {
  if (input.campaignId && !(await membershipRole(db, input.campaignId, user.id))) return fail("forbidden");
  const result = await db.query<{ id: string }>(
    `INSERT INTO "character" ("ownerId", "campaignId", "name", "level", "data") VALUES ($1, $2, $3, $4, $5) RETURNING "id"`,
    [user.id, input.campaignId, input.name, input.level, JSON.stringify(characterData(input))],
  );
  const created = await readCharacter(db, result.rows[0].id, user.id);
  return created ? { ok: true, value: created } : fail("not-found");
}

export async function updateCharacter(user: AppUser, id: string, input: CharacterInput): Promise<DataResult<CharacterView>> {
  const current = await readCharacter(pool, id, user.id);
  if (!current) return fail("not-found");
  if (current.ownerId !== user.id) return fail("forbidden");
  if (input.campaignId && input.campaignId !== current.campaignId && !(await membershipRole(pool, input.campaignId, user.id))) {
    return fail("forbidden");
  }
  await pool.query(
    `UPDATE "character" SET "campaignId" = $2, "name" = $3, "level" = $4, "data" = $5, "updatedAt" = now() WHERE "id" = $1`,
    [id, input.campaignId, input.name, input.level, JSON.stringify(characterData(input))],
  );
  const updated = await readCharacter(pool, id, user.id);
  return updated ? { ok: true, value: updated } : fail("not-found");
}

export async function deleteCharacter(user: AppUser, id: string): Promise<DataResult<null>> {
  const result = await pool.query<{ ownerId: string }>('SELECT "ownerId" FROM "character" WHERE "id" = $1', [id]);
  if (!result.rows[0]) return fail("not-found");
  if (result.rows[0].ownerId !== user.id) return fail("forbidden");
  await pool.query('DELETE FROM "character" WHERE "id" = $1', [id]);
  return { ok: true, value: null };
}

type CampaignRow = { id: string; name: string; description: string; ownerId: string; ownerName: string; myRole: CampaignRole | null };

/** Campaigns the user owns or was added to, with their roster. */
export async function listCampaigns(user: AppUser): Promise<CampaignView[]> {
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
  return campaigns.rows.map((row) => ({
    ...row,
    isOwner: row.ownerId === user.id,
    canManage: canManageCampaign(user, row),
    members: members.rows.filter((member) => member.campaignId === row.id)
      .map(({ userId, name, role }) => ({ userId, name, role })),
  }));
}

async function readCampaignAccess(db: Queryable, user: AppUser, campaignId: string) {
  const result = await db.query<{ ownerId: string }>('SELECT "ownerId" FROM "campaign" WHERE "id" = $1', [campaignId]);
  const campaign = result.rows[0];
  if (!campaign) return null;
  const myRole = await membershipRole(db, campaignId, user.id);
  const visible = campaign.ownerId === user.id || myRole !== null;
  return { ownerId: campaign.ownerId, myRole, visible, canManage: visible && canManageCampaign(user, { ownerId: campaign.ownerId, myRole }) };
}

export async function createCampaign(user: AppUser, input: { name: string; description: string }, db?: Queryable): Promise<DataResult<{ id: string }>> {
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

export async function updateCampaign(user: AppUser, campaignId: string, input: { name: string; description: string }): Promise<DataResult<null>> {
  const access = await readCampaignAccess(pool, user, campaignId);
  if (!access?.visible) return fail("not-found");
  if (!access.canManage) return fail("forbidden");
  await pool.query('UPDATE "campaign" SET "name" = $2, "description" = $3, "updatedAt" = now() WHERE "id" = $1', [campaignId, input.name, input.description]);
  return { ok: true, value: null };
}

/** Only the campaign's creator (or a site admin) can delete it; characters stay with their owners. */
export async function deleteCampaign(user: AppUser, campaignId: string): Promise<DataResult<null>> {
  const access = await readCampaignAccess(pool, user, campaignId);
  if (!access?.visible) return fail("not-found");
  if (access.ownerId !== user.id && user.role !== "admin") return fail("forbidden");
  await pool.query('DELETE FROM "campaign" WHERE "id" = $1', [campaignId]);
  return { ok: true, value: null };
}

export async function addCampaignMember(user: AppUser, campaignId: string, memberId: string, role: CampaignRole): Promise<DataResult<null>> {
  const access = await readCampaignAccess(pool, user, campaignId);
  if (!access?.visible) return fail("not-found");
  if (!access.canManage) return fail("forbidden");
  if (memberId === access.ownerId) return fail("invalid");
  const target = await pool.query<{ status: string }>('SELECT "status" FROM "user" WHERE "id" = $1', [memberId]);
  if (target.rows[0]?.status !== "approved") return fail("invalid");
  await pool.query(
    `INSERT INTO "campaign_member" ("campaignId", "userId", "role") VALUES ($1, $2, $3)
     ON CONFLICT ("campaignId", "userId") DO UPDATE SET "role" = EXCLUDED."role"`,
    [campaignId, memberId, role],
  );
  await pool.query('UPDATE "campaign" SET "updatedAt" = now() WHERE "id" = $1', [campaignId]);
  return { ok: true, value: null };
}

/** Managers remove anyone but the owner; any member can leave. Their characters leave with them. */
export async function removeCampaignMember(user: AppUser, campaignId: string, memberId: string): Promise<DataResult<null>> {
  const access = await readCampaignAccess(pool, user, campaignId);
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
export async function removeCampaignCharacter(user: AppUser, campaignId: string, characterId: string): Promise<DataResult<null>> {
  const access = await readCampaignAccess(pool, user, campaignId);
  if (!access?.visible) return fail("not-found");
  const character = await pool.query<{ ownerId: string }>('SELECT "ownerId" FROM "character" WHERE "id" = $1 AND "campaignId" = $2', [characterId, campaignId]);
  if (!character.rows[0]) return fail("not-found");
  if (character.rows[0].ownerId !== user.id && !access.canManage) return fail("forbidden");
  await pool.query('UPDATE "character" SET "campaignId" = NULL, "updatedAt" = now() WHERE "id" = $1', [characterId]);
  return { ok: true, value: null };
}

/** Approved accounts a DM can add to a campaign. */
export async function listDirectory(): Promise<DirectoryUser[]> {
  const result = await pool.query<DirectoryUser>(`SELECT "id", "name", "role" FROM "user" WHERE "status" = 'approved' ORDER BY "name"`);
  return result.rows;
}

export async function listUsersForAdmin(): Promise<AdminUserView[]> {
  const result = await pool.query<Omit<AdminUserView, "createdAt"> & { createdAt: Date }>(
    `SELECT u."id", u."name", u."email", u."role", u."status", u."emailVerified", u."twoFactorEnabled", u."createdAt",
            (SELECT count(*)::int FROM "campaign_member" m WHERE m."userId" = u."id") AS "campaignCount",
            (SELECT count(*)::int FROM "character" c WHERE c."ownerId" = u."id") AS "characterCount"
       FROM "user" u
      ORDER BY CASE u."status" WHEN 'pending' THEN 0 WHEN 'approved' THEN 1 ELSE 2 END, u."createdAt" DESC`,
  );
  return result.rows.map((row) => ({ ...row, createdAt: new Date(row.createdAt).toISOString() }));
}

export async function readUserForAdmin(id: string) {
  const result = await pool.query<{ id: string; role: SiteRole; status: AccountStatus }>('SELECT "id", "role", "status" FROM "user" WHERE "id" = $1', [id]);
  return result.rows[0] ?? null;
}

export async function countApprovedAdmins(): Promise<number> {
  const result = await pool.query<{ count: number }>(`SELECT count(*)::int AS "count" FROM "user" WHERE "role" = 'admin' AND "status" = 'approved'`);
  return result.rows[0]?.count ?? 0;
}

export async function applyAdminChange(id: string, change: { role?: SiteRole; status?: AccountStatus }) {
  await transaction(async (client) => {
    if (change.role) await client.query('UPDATE "user" SET "role" = $2, "updatedAt" = now() WHERE "id" = $1', [id, change.role]);
    if (change.status) await client.query('UPDATE "user" SET "status" = $2, "updatedAt" = now() WHERE "id" = $1', [id, change.status]);
    // A blocked or un-approved account loses every open session immediately.
    if (change.status && change.status !== "approved") await client.query('DELETE FROM "session" WHERE "userId" = $1', [id]);
  });
}

export async function revokeUserSessions(id: string) {
  await pool.query('DELETE FROM "session" WHERE "userId" = $1', [id]);
}

/** Deleting an account removes its characters and the campaigns it created (cascade). */
export async function deleteUser(id: string) {
  await pool.query('DELETE FROM "user" WHERE "id" = $1', [id]);
}

/**
 * Copy what a user had saved in this browser into their account. Campaigns are imported only for
 * DMs/admins; character ids from the browser are remapped to the new server ids.
 */
export async function importLocalData(
  user: AppUser,
  characters: (CharacterInput & { localId: string })[],
  campaigns: { name: string; description: string; characterIds: string[] }[],
): Promise<{ characters: number; campaigns: number }> {
  return transaction(async (client) => {
    const idMap = new Map<string, string>();
    for (const character of characters) {
      const created = await createCharacter(user, { ...character, campaignId: null }, client);
      if (created.ok) idMap.set(character.localId, created.value.id);
    }
    let campaignCount = 0;
    if (canCreateCampaign(user)) {
      for (const campaign of campaigns) {
        const created = await createCampaign(user, campaign, client);
        if (!created.ok) continue;
        campaignCount += 1;
        const ids = campaign.characterIds.map((id) => idMap.get(id)).filter((id): id is string => Boolean(id));
        if (ids.length) {
          await client.query('UPDATE "character" SET "campaignId" = $1 WHERE "id" = ANY($2::uuid[]) AND "ownerId" = $3', [created.value.id, ids, user.id]);
        }
      }
    }
    return { characters: idMap.size, campaigns: campaignCount };
  });
}
