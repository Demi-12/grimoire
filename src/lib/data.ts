import "server-only";
import { randomBytes } from "node:crypto";
import type { QueryResult, QueryResultRow } from "pg";
import { pool, transaction } from "@/lib/db";
import {
  canCreateCampaign,
  canManageCampaign,
  INVITE_TTL_DAYS,
  type AccountStatus,
  type AppUser,
  type CampaignRole,
  type CharacterInput,
  type CharacterScores,
  type CreatureInput,
  type EncounterInput,
  type EncounterLineInput,
  type EncounterStatus,
  type PreferencesInput,
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

export type AddMemberError = DataError | "no-user" | "ambiguous" | "already-member";

/**
 * A manager adds an account by exact email or exact name (case-insensitive). Nothing is listed:
 * a name shared by several accounts must be disambiguated with the email.
 */
export async function addCampaignMemberByQuery(
  user: AppUser, campaignId: string, query: string, role: CampaignRole,
): Promise<{ ok: true; value: { name: string } } | { ok: false; error: AddMemberError }> {
  const access = await readCampaignAccess(pool, user, campaignId);
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
  if (target.id === access.ownerId || await membershipRole(pool, campaignId, target.id)) return { ok: false, error: "already-member" };
  await pool.query('INSERT INTO "campaign_member" ("campaignId", "userId", "role") VALUES ($1, $2, $3)', [campaignId, target.id, role]);
  await pool.query('UPDATE "campaign" SET "updatedAt" = now() WHERE "id" = $1', [campaignId]);
  return { ok: true, value: { name: target.name } };
}

/** DM/player is a per-campaign role: managers change it for people who joined through an invite link. */
export async function setCampaignMemberRole(user: AppUser, campaignId: string, memberId: string, role: CampaignRole): Promise<DataResult<null>> {
  const access = await readCampaignAccess(pool, user, campaignId);
  if (!access?.visible) return fail("not-found");
  if (!access.canManage) return fail("forbidden");
  if (memberId === access.ownerId) return fail("invalid");
  if (!(await membershipRole(pool, campaignId, memberId))) return fail("invalid");
  await pool.query('UPDATE "campaign_member" SET "role" = $3 WHERE "campaignId" = $1 AND "userId" = $2', [campaignId, memberId, role]);
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

export interface InviteView { id: string; token: string; createdByName: string; createdAt: string; expiresAt: string }

/** Live (unexpired) invite links of a campaign, for its managers. */
export async function listCampaignInvites(user: AppUser, campaignId: string): Promise<DataResult<InviteView[]>> {
  const access = await readCampaignAccess(pool, user, campaignId);
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

export async function createCampaignInvite(user: AppUser, campaignId: string): Promise<DataResult<InviteView>> {
  const access = await readCampaignAccess(pool, user, campaignId);
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

export async function revokeCampaignInvite(user: AppUser, campaignId: string, inviteId: string): Promise<DataResult<null>> {
  const access = await readCampaignAccess(pool, user, campaignId);
  if (!access?.visible) return fail("not-found");
  if (!access.canManage) return fail("forbidden");
  await pool.query('DELETE FROM "campaign_invite" WHERE "id" = $1 AND "campaignId" = $2', [inviteId, campaignId]);
  return { ok: true, value: null };
}

export interface InvitePreview { campaignId: string; campaignName: string; description: string; ownerName: string; alreadyMember: boolean }

/** What an invite link points at, or null when the link is unknown, expired or revoked. */
export async function readInvite(user: AppUser, token: string): Promise<InvitePreview | null> {
  const result = await pool.query<{ campaignId: string; campaignName: string; description: string; ownerName: string; alreadyMember: boolean }>(
    `SELECT k."id" AS "campaignId", k."name" AS "campaignName", k."description", o."name" AS "ownerName",
            EXISTS (SELECT 1 FROM "campaign_member" m WHERE m."campaignId" = k."id" AND m."userId" = $2) AS "alreadyMember"
       FROM "campaign_invite" i
       JOIN "campaign" k ON k."id" = i."campaignId"
       JOIN "user" o ON o."id" = k."ownerId"
      WHERE i."token" = $1 AND i."expiresAt" > now()`,
    [token, user.id],
  );
  return result.rows[0] ?? null;
}

/** Join the invite's campaign as a player; existing members keep their current role. */
export async function acceptInvite(user: AppUser, token: string): Promise<DataResult<{ campaignId: string }>> {
  const invite = await readInvite(user, token);
  if (!invite) return fail("not-found");
  await pool.query(
    'INSERT INTO "campaign_member" ("campaignId", "userId", "role") VALUES ($1, $2, \'player\') ON CONFLICT ("campaignId", "userId") DO NOTHING',
    [invite.campaignId, user.id],
  );
  return { ok: true, value: { campaignId: invite.campaignId } };
}

export async function listUsersForAdmin(): Promise<AdminUserView[]> {
  const result = await pool.query<Omit<AdminUserView, "createdAt"> & { createdAt: Date }>(
    `SELECT u."id", u."name", u."email", u."role", u."status", u."emailVerified", u."twoFactorEnabled", u."createdAt",
            (SELECT count(*)::int FROM "campaign_member" m WHERE m."userId" = u."id") AS "campaignCount",
            (SELECT count(*)::int FROM "character" c WHERE c."ownerId" = u."id") AS "characterCount"
       FROM "user" u
      ORDER BY CASE u."status" WHEN 'approved' THEN 0 ELSE 1 END, u."createdAt" DESC`,
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
  creatures: CreatureInput[] = [],
): Promise<{ characters: number; campaigns: number; creatures: number }> {
  return transaction(async (client) => {
    let creatureCount = 0;
    for (const creature of creatures) {
      if ((await createCreature(user, creature, client)).ok) creatureCount += 1;
    }
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
    return { characters: idMap.size, campaigns: campaignCount, creatures: creatureCount };
  });
}

// ---- Creature catalog (personal, per account) ----

export interface CreatureView {
  id: string; name: string; xp: number; source: string;
  monsterSlug?: string; cr?: number; type?: string; roleTags?: string[];
}

type CreatureRow = { id: string; name: string; xp: number; source: string; monsterSlug: string | null; cr: string | null; type: string | null; roleTags: string[] };

const toCreatureView = (row: CreatureRow): CreatureView => ({
  id: row.id, name: row.name, xp: row.xp, source: row.source,
  ...(row.monsterSlug ? { monsterSlug: row.monsterSlug } : {}),
  ...(row.cr !== null ? { cr: Number(row.cr) } : {}),
  ...(row.type ? { type: row.type } : {}),
  ...(row.roleTags.length ? { roleTags: row.roleTags } : {}),
});

const creatureColumns = '"id", "name", "xp", "source", "monsterSlug", "cr", "type", "roleTags"';
const MAX_CREATURES_PER_USER = 500;

export async function listCreatures(user: AppUser): Promise<CreatureView[]> {
  const result = await pool.query<CreatureRow>(`SELECT ${creatureColumns} FROM "creature" WHERE "ownerId" = $1 ORDER BY "createdAt" DESC`, [user.id]);
  return result.rows.map(toCreatureView);
}

/** Adds a creature; re-adding the same SRD monster returns the existing row. */
export async function createCreature(user: AppUser, input: CreatureInput, db: Queryable = pool): Promise<DataResult<CreatureView>> {
  const count = await db.query<{ n: string }>('SELECT count(*) AS n FROM "creature" WHERE "ownerId" = $1', [user.id]);
  if (Number(count.rows[0].n) >= MAX_CREATURES_PER_USER) return fail("invalid");
  const result = await db.query<CreatureRow>(
    `INSERT INTO "creature" ("ownerId", "name", "xp", "source", "monsterSlug", "cr", "type", "roleTags")
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT ("ownerId", "monsterSlug") WHERE "monsterSlug" IS NOT NULL DO UPDATE SET "name" = EXCLUDED."name"
     RETURNING ${creatureColumns}`,
    [user.id, input.name, input.xp, input.source, input.monsterSlug, input.cr, input.type, JSON.stringify(input.roleTags)],
  );
  return { ok: true, value: toCreatureView(result.rows[0]) };
}

export async function deleteCreature(user: AppUser, id: string): Promise<DataResult<null>> {
  const result = await pool.query('DELETE FROM "creature" WHERE "id" = $1 AND "ownerId" = $2', [id, user.id]);
  return result.rowCount ? { ok: true, value: null } : fail("not-found");
}

// ---- Encounter journal (per campaign, DMs only) ----

export interface EncounterView {
  id: string; campaignId: string; createdByName: string; title: string; notes: string; status: EncounterStatus;
  difficulty: "low" | "moderate" | "high"; budget: number; totalXp: number; partyLevels: number[];
  lines: EncounterLineInput[]; playedAt: string | null; createdAt: string; updatedAt: string;
}

type EncounterRow = Omit<EncounterView, "createdByName" | "playedAt" | "createdAt" | "updatedAt"> & {
  createdByName: string; playedAt: Date | null; createdAt: Date; updatedAt: Date;
};

const toEncounterView = (row: EncounterRow): EncounterView => ({
  ...row, playedAt: row.playedAt?.toISOString() ?? null, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(),
});

const encounterColumns = `e."id", e."campaignId", u."name" AS "createdByName", e."title", e."notes", e."status", e."difficulty",
  e."budget", e."totalXp", e."partyLevels", e."lines", e."playedAt", e."createdAt", e."updatedAt"`;

/** Encounters are DM material: only people who can manage the campaign may see or change them. */
async function requireCampaignManager(db: Queryable, user: AppUser, campaignId: string): Promise<DataResult<null>> {
  const access = await readCampaignAccess(db, user, campaignId);
  if (!access || !access.visible) return fail("not-found");
  return access.canManage ? { ok: true, value: null } : fail("forbidden");
}

export async function listEncounters(user: AppUser, campaignId: string): Promise<DataResult<EncounterView[]>> {
  const gate = await requireCampaignManager(pool, user, campaignId);
  if (!gate.ok) return gate;
  const result = await pool.query<EncounterRow>(
    `SELECT ${encounterColumns} FROM "encounter" e JOIN "user" u ON u."id" = e."createdBy"
      WHERE e."campaignId" = $1 ORDER BY (e."status" = 'planned') DESC, COALESCE(e."playedAt", e."createdAt") DESC`,
    [campaignId],
  );
  return { ok: true, value: result.rows.map(toEncounterView) };
}

const MAX_ENCOUNTERS_PER_CAMPAIGN = 500;

export async function createEncounter(user: AppUser, campaignId: string, input: EncounterInput): Promise<DataResult<EncounterView>> {
  const gate = await requireCampaignManager(pool, user, campaignId);
  if (!gate.ok) return gate;
  const count = await pool.query<{ n: string }>('SELECT count(*) AS n FROM "encounter" WHERE "campaignId" = $1', [campaignId]);
  if (Number(count.rows[0].n) >= MAX_ENCOUNTERS_PER_CAMPAIGN) return fail("invalid");
  const inserted = await pool.query<{ id: string }>(
    `INSERT INTO "encounter" ("campaignId", "createdBy", "title", "notes", "status", "difficulty", "budget", "totalXp", "partyLevels", "lines", "playedAt")
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CASE WHEN $5 = 'played' THEN now() END) RETURNING "id"`,
    [campaignId, user.id, input.title, input.notes, input.status, input.difficulty, input.budget, input.totalXp, JSON.stringify(input.partyLevels), JSON.stringify(input.lines)],
  );
  const created = await pool.query<EncounterRow>(`SELECT ${encounterColumns} FROM "encounter" e JOIN "user" u ON u."id" = e."createdBy" WHERE e."id" = $1`, [inserted.rows[0].id]);
  return { ok: true, value: toEncounterView(created.rows[0]) };
}

/** Title, notes and status can change after saving; the generated creature list stays as saved. */
export async function updateEncounter(
  user: AppUser, id: string, change: { title?: string; notes?: string; status?: EncounterStatus },
): Promise<DataResult<EncounterView>> {
  const existing = await pool.query<{ campaignId: string }>('SELECT "campaignId" FROM "encounter" WHERE "id" = $1', [id]);
  if (!existing.rows[0]) return fail("not-found");
  const gate = await requireCampaignManager(pool, user, existing.rows[0].campaignId);
  if (!gate.ok) return gate;
  await pool.query(
    `UPDATE "encounter" SET
       "title" = COALESCE($2, "title"), "notes" = COALESCE($3, "notes"), "status" = COALESCE($4, "status"),
       "playedAt" = CASE WHEN $4 = 'played' AND "playedAt" IS NULL THEN now() WHEN $4 = 'planned' THEN NULL ELSE "playedAt" END,
       "updatedAt" = now()
     WHERE "id" = $1`,
    [id, change.title ?? null, change.notes ?? null, change.status ?? null],
  );
  const updated = await pool.query<EncounterRow>(`SELECT ${encounterColumns} FROM "encounter" e JOIN "user" u ON u."id" = e."createdBy" WHERE e."id" = $1`, [id]);
  return { ok: true, value: toEncounterView(updated.rows[0]) };
}

export async function deleteEncounter(user: AppUser, id: string): Promise<DataResult<null>> {
  const existing = await pool.query<{ campaignId: string }>('SELECT "campaignId" FROM "encounter" WHERE "id" = $1', [id]);
  if (!existing.rows[0]) return fail("not-found");
  const gate = await requireCampaignManager(pool, user, existing.rows[0].campaignId);
  if (!gate.ok) return gate;
  await pool.query('DELETE FROM "encounter" WHERE "id" = $1', [id]);
  return { ok: true, value: null };
}

// ---- Account preferences ----

export interface PreferencesView { locale: "en" | "es" | null; theme: "light" | "dark" | null; legacyImported: boolean }

export async function readPreferences(userId: string): Promise<PreferencesView> {
  const result = await pool.query<{ locale: "en" | "es" | null; theme: "light" | "dark" | null; legacyImportedAt: Date | null }>(
    'SELECT "locale", "theme", "legacyImportedAt" FROM "user" WHERE "id" = $1', [userId]);
  const row = result.rows[0];
  return { locale: row?.locale ?? null, theme: row?.theme ?? null, legacyImported: Boolean(row?.legacyImportedAt) };
}

export async function updatePreferences(userId: string, change: PreferencesInput & { legacyImported?: true }) {
  await pool.query(
    `UPDATE "user" SET "locale" = COALESCE($2, "locale"), "theme" = COALESCE($3, "theme"),
       "legacyImportedAt" = CASE WHEN $4::boolean THEN COALESCE("legacyImportedAt", now()) ELSE "legacyImportedAt" END
     WHERE "id" = $1`,
    [userId, change.locale ?? null, change.theme ?? null, change.legacyImported === true],
  );
}
