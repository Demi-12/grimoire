import "server-only";
import type { PoolClient } from "pg";
import { transaction } from "@/lib/db";
import {
  BackupRestoreError,
  backupSections,
  runRestore,
  serializeBackup,
  type BackupCharacter,
  type BackupEncounter,
  type BackupFile,
  type IdMap,
  type ParsedBackup,
  type RestoreResult,
  type SectionStore,
} from "@/lib/backup";
import { createCampaign, createCharacter, listCampaigns, listCharacters, listCreatures, listEncounters } from "@/lib/data";
import type { AppUser, CreatureInput, EncounterInput } from "@/lib/permissions";

const MAX_CREATURES_PER_USER = 500;
const MAX_ENCOUNTERS_PER_CAMPAIGN = 500;

/**
 * Everything the user owns, ready to download. Reuses the regular list queries, which already scope
 * rows to the viewer, and the section serializers whitelist fields (no ids of people, emails,
 * invites or tokens can reach the file).
 */
export async function exportBackup(user: AppUser, now: Date = new Date()): Promise<BackupFile> {
  const campaigns = (await listCampaigns(user)).filter((campaign) => campaign.ownerId === user.id);
  const characters = (await listCharacters(user)).filter((character) => character.ownerId === user.id);
  const creatures = await listCreatures(user);
  const encounters = [];
  for (const campaign of campaigns) {
    const listed = await listEncounters(user, campaign.id);
    if (listed.ok) encounters.push(...listed.value);
  }
  return serializeBackup({ campaigns, characters, creatures, encounters }, now);
}

type Db = Pick<PoolClient, "query">;

const section = (name: string) => {
  const found = backupSections.find((candidate) => candidate.key === name);
  if (!found) throw new Error(`Unknown backup section ${name}`);
  return found;
};

/** Existing rows are fingerprinted with their real ids, so no local->real mapping applies to them. */
const noMap: IdMap = {};

/** One store per registered section; add the store for a new section here. */
function createStores(user: AppUser, db: Db): Record<string, SectionStore> {
  let creatureTotal = 0;
  const encounterTotals = new Map<string, number>();

  return {
    campaigns: {
      async existing() {
        const rows = await db.query<{ id: string; name: string }>('SELECT "id", "name" FROM "campaign" WHERE "ownerId" = $1 ORDER BY "createdAt"', [user.id]);
        const found = new Map<string, string>();
        // Oldest first wins when an account already holds two campaigns with the same name.
        for (const row of rows.rows) {
          const fingerprint = section("campaigns").fingerprint({ name: row.name }, noMap);
          if (!found.has(fingerprint)) found.set(fingerprint, row.id);
        }
        return found;
      },
      async create(item) {
        const created = await createCampaign(user, item as { name: string; description: string }, db);
        if (!created.ok) throw new Error("Campaign could not be restored.");
        return created.value.id;
      },
    },

    characters: {
      async existing() {
        const rows = await db.query<{ id: string; name: string; level: number; data: Record<string, unknown> }>(
          'SELECT "id", "name", "level", "data" FROM "character" WHERE "ownerId" = $1', [user.id]);
        const found = new Map<string, string>();
        for (const row of rows.rows) {
          const data = row.data as { className?: string; species?: string; background?: string; scores?: BackupCharacter["scores"]; notes?: string; build?: Record<string, unknown> };
          const item = {
            name: row.name, level: row.level, className: data.className ?? "", species: data.species ?? "", background: data.background ?? "",
            scores: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10, ...data.scores }, notes: data.notes ?? "", ...(data.build ? { build: data.build } : {}),
          };
          const fingerprint = section("characters").fingerprint(item, noMap);
          if (!found.has(fingerprint)) found.set(fingerprint, row.id);
        }
        return found;
      },
      async create(raw, idMap) {
        const item = raw as BackupCharacter;
        const campaignId = item.campaignId ? idMap.campaigns?.get(item.campaignId) ?? null : null;
        const created = await createCharacter(user, { ...item, campaignId }, db);
        if (!created.ok) throw new Error("Character could not be restored.");
        return created.value.id;
      },
    },

    creatures: {
      async existing() {
        const rows = await db.query<{ id: string; name: string; xp: number; source: string; monsterSlug: string | null }>(
          'SELECT "id", "name", "xp", "source", "monsterSlug" FROM "creature" WHERE "ownerId" = $1 ORDER BY "createdAt"', [user.id]);
        creatureTotal = rows.rows.length;
        const found = new Map<string, string>();
        for (const row of rows.rows) {
          const fingerprint = section("creatures").fingerprint({ name: row.name, xp: row.xp, source: row.source, monsterSlug: row.monsterSlug }, noMap);
          if (!found.has(fingerprint)) found.set(fingerprint, row.id);
        }
        return found;
      },
      async create(raw) {
        const item = raw as CreatureInput;
        if (creatureTotal >= MAX_CREATURES_PER_USER) throw new BackupRestoreError("limit", "creatures");
        const inserted = await db.query<{ id: string }>(
          `INSERT INTO "creature" ("ownerId", "name", "xp", "source", "monsterSlug", "cr", "type", "roleTags")
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT ("ownerId", "monsterSlug") WHERE "monsterSlug" IS NOT NULL DO UPDATE SET "name" = "creature"."name"
           RETURNING "id"`,
          [user.id, item.name, item.xp, item.source, item.monsterSlug, item.cr, item.type, JSON.stringify(item.roleTags)],
        );
        creatureTotal += 1;
        return inserted.rows[0].id;
      },
    },

    encounters: {
      async existing() {
        const rows = await db.query<{ id: string; campaignId: string } & Omit<EncounterInput, "status">>(
          `SELECT e."id", e."campaignId", e."title", e."notes", e."difficulty", e."budget", e."totalXp", e."partyLevels", e."lines"
             FROM "encounter" e JOIN "campaign" k ON k."id" = e."campaignId" WHERE k."ownerId" = $1`, [user.id]);
        const found = new Map<string, string>();
        for (const row of rows.rows) {
          encounterTotals.set(row.campaignId, (encounterTotals.get(row.campaignId) ?? 0) + 1);
          const fingerprint = section("encounters").fingerprint(row, noMap);
          if (!found.has(fingerprint)) found.set(fingerprint, row.id);
        }
        return found;
      },
      async create(raw, idMap) {
        const item = raw as BackupEncounter;
        const campaignId = idMap.campaigns?.get(item.campaignId);
        if (!campaignId) throw new Error("Encounter references an unknown campaign.");
        const total = encounterTotals.get(campaignId) ?? 0;
        if (total >= MAX_ENCOUNTERS_PER_CAMPAIGN) throw new BackupRestoreError("limit", "encounters");
        const played = item.status === "played";
        const inserted = await db.query<{ id: string }>(
          `INSERT INTO "encounter" ("campaignId", "createdBy", "title", "notes", "status", "difficulty", "budget", "totalXp", "partyLevels", "lines", "playedAt", "createdAt")
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CASE WHEN $11::boolean THEN COALESCE($12::timestamptz, now()) END, COALESCE($13::timestamptz, now()))
           RETURNING "id"`,
          [campaignId, user.id, item.title, item.notes, item.status, item.difficulty, item.budget, item.totalXp, JSON.stringify(item.partyLevels), JSON.stringify(item.lines),
            played, item.playedAt ?? null, item.createdAt ?? null],
        );
        encounterTotals.set(campaignId, total + 1);
        return inserted.rows[0].id;
      },
    },
  };
}

/**
 * Restore a validated backup into the user's account in one transaction: all or nothing, and
 * serialized per user so two concurrent restores can't both create the same items.
 */
export async function importBackup(user: AppUser, backup: ParsedBackup): Promise<RestoreResult> {
  return transaction(async (client) => {
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`backup-restore:${user.id}`]);
    return runRestore(backup, createStores(user, client));
  });
}
