/**
 * Account backups: export everything the user owns, restore a backup file without duplicates, and the
 * one-time import of data an old version kept in the browser. The file format lives in @grimoire/shared/backup.
 */
import { Injectable } from "@nestjs/common";
import type { PoolClient } from "pg";
import {
  encounterCampaignId,
  encounterRestoreDates,
  indexExisting,
  restoredCampaignId,
  RestoreQuota,
  runLegacyImport,
  runRestore,
  serializeBackup,
  storedCharacter,
  type BackupCharacter,
  type BackupEncounter,
  type BackupFile,
  type LegacyImport,
  type LegacyImportCounts,
  type ParsedBackup,
  type RestoreResult,
  type SectionStore,
  type StoredCharacterRow,
} from "@grimoire/shared/backup";
import { MAX_CREATURES_PER_USER, MAX_ENCOUNTERS_PER_CAMPAIGN, type AppUser, type CreatureInput, type EncounterInput } from "@grimoire/shared/permissions";
import { CampaignsService } from "../campaigns/campaigns.service.js";
import { EncountersService } from "../campaigns/encounters.service.js";
import { CharactersService } from "../characters/characters.service.js";
import type { DataResult } from "../common/data-result.js";
import { CreaturesService } from "../creatures/creatures.service.js";
import { transaction } from "../database/db.js";

/** Id of what a service call created, or null when it refused. */
const idOf = (result: DataResult<{ id: string }>) => (result.ok ? result.value.id : null);


type Db = Pick<PoolClient, "query">;

/** What every store works with during one restore. */
interface RestoreContext { user: AppUser; db: Db; campaigns: CampaignsService; characters: CharactersService }

function campaignStore({ user, db, campaigns }: RestoreContext): SectionStore {
  return {
    async existing() {
      const rows = await db.query<{ id: string; name: string }>('SELECT "id", "name" FROM "campaign" WHERE "ownerId" = $1 ORDER BY "createdAt"', [user.id]);
      return indexExisting("campaigns", rows.rows);
    },
    async create(item) {
      const created = await campaigns.createCampaign(user, item as { name: string; description: string }, db);
      if (!created.ok) throw new Error("Campaign could not be restored.");
      return created.value.id;
    },
  };
}

function characterStore({ user, db, characters }: RestoreContext): SectionStore {
  return {
    async existing() {
      const rows = await db.query<{ id: string } & StoredCharacterRow>('SELECT "id", "name", "level", "data" FROM "character" WHERE "ownerId" = $1', [user.id]);
      return indexExisting("characters", rows.rows, storedCharacter);
    },
    async create(raw, idMap) {
      const item = raw as BackupCharacter;
      const created = await characters.createCharacter(user, { ...item, campaignId: restoredCampaignId(item.campaignId, idMap) }, db);
      if (!created.ok) throw new Error("Character could not be restored.");
      return created.value.id;
    },
  };
}

function creatureStore({ user, db }: RestoreContext): SectionStore {
  const quota = new RestoreQuota("creatures", MAX_CREATURES_PER_USER);
  return {
    async existing() {
      // Same lock as createCreature in creatures.service.ts, so a creature added meanwhile can't push the account past the limit.
      await db.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`creature-limit:${user.id}`]);
      const rows = await db.query<{ id: string; name: string; xp: number; source: string; monsterSlug: string | null }>(
        'SELECT "id", "name", "xp", "source", "monsterSlug" FROM "creature" WHERE "ownerId" = $1 ORDER BY "createdAt"', [user.id]);
      quota.add(user.id, rows.rows.length);
      return indexExisting("creatures", rows.rows);
    },
    async create(raw) {
      const item = raw as CreatureInput;
      quota.take(user.id);
      const inserted = await db.query<{ id: string }>(
        `INSERT INTO "creature" ("ownerId", "name", "xp", "source", "monsterSlug", "cr", "type", "roleTags")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT ("ownerId", "monsterSlug") WHERE "monsterSlug" IS NOT NULL DO UPDATE SET "name" = "creature"."name"
         RETURNING "id"`,
        [user.id, item.name, item.xp, item.source, item.monsterSlug, item.cr, item.type, JSON.stringify(item.roleTags)],
      );
      return inserted.rows[0].id;
    },
  };
}

function encounterStore({ user, db }: RestoreContext): SectionStore {
  const quota = new RestoreQuota("encounters", MAX_ENCOUNTERS_PER_CAMPAIGN);
  return {
    async existing() {
      const rows = await db.query<{ id: string; campaignId: string } & Omit<EncounterInput, "status">>(
        `SELECT e."id", e."campaignId", e."title", e."notes", e."difficulty", e."budget", e."totalXp", e."partyLevels", e."lines"
           FROM "encounter" e JOIN "campaign" k ON k."id" = e."campaignId" WHERE k."ownerId" = $1`, [user.id]);
      for (const row of rows.rows) quota.add(row.campaignId);
      return indexExisting("encounters", rows.rows);
    },
    async create(raw, idMap) {
      const item = raw as BackupEncounter;
      const campaignId = encounterCampaignId(item, idMap);
      quota.take(campaignId);
      const { played, playedAt, createdAt } = encounterRestoreDates(item);
      const inserted = await db.query<{ id: string }>(
        `INSERT INTO "encounter" ("campaignId", "createdBy", "title", "notes", "status", "difficulty", "budget", "totalXp", "partyLevels", "lines", "playedAt", "createdAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CASE WHEN $11::boolean THEN COALESCE($12::timestamptz, now()) END, COALESCE($13::timestamptz, now()))
         RETURNING "id"`,
        [campaignId, user.id, item.title, item.notes, item.status, item.difficulty, item.budget, item.totalXp, JSON.stringify(item.partyLevels), JSON.stringify(item.lines),
          played, playedAt, createdAt],
      );
      return inserted.rows[0].id;
    },
  };
}

/**
 * One store per registered section; add the store for a new section here. The stores only run queries:
 * fingerprints, campaign links, limits and dates are decided in @grimoire/shared/backup.
 */
function createStores(context: RestoreContext): Record<string, SectionStore> {
  return { campaigns: campaignStore(context), characters: characterStore(context), creatures: creatureStore(context), encounters: encounterStore(context) };
}

@Injectable()
export class BackupService {
  constructor(
    private readonly campaigns: CampaignsService,
    private readonly characters: CharactersService,
    private readonly creatures: CreaturesService,
    private readonly encounters: EncountersService,
  ) {}

  /**
   * Everything the user owns, ready to download. Reuses the regular list queries, which already scope
   * rows to the viewer, and the section serializers whitelist fields (no ids of people, emails,
   * invites or tokens can reach the file).
   */
  async exportBackup(user: AppUser, now: Date = new Date()): Promise<BackupFile> {
    const campaigns = (await this.campaigns.listCampaigns(user)).filter((campaign) => campaign.ownerId === user.id);
    const characters = (await this.characters.listCharacters(user)).filter((character) => character.ownerId === user.id);
    const creatures = await this.creatures.listCreatures(user);
    const encounters = [];
    for (const campaign of campaigns) {
      const listed = await this.encounters.listEncounters(user, campaign.id);
      if (listed.ok) encounters.push(...listed.value);
    }
    return serializeBackup({ campaigns, characters, creatures, encounters }, now);
  }

  /**
   * Restore a validated backup into the user's account in one transaction: all or nothing, and
   * serialized per user so two concurrent restores can't both create the same items.
   */
  async importBackup(user: AppUser, backup: ParsedBackup): Promise<RestoreResult> {
    return transaction(async (client) => {
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`backup-restore:${user.id}`]);
      return runRestore(backup, createStores({ user, db: client, campaigns: this.campaigns, characters: this.characters }));
    });
  }

  /**
   * Copy what a user had saved in this browser into their account, in one transaction. What gets
   * imported, and how browser character ids map to the new ones, is runLegacyImport's decision.
   */
  async importLocalData(user: AppUser, legacy: LegacyImport): Promise<LegacyImportCounts> {
    return transaction(async (client) => runLegacyImport(legacy, user, {
      createCreature: async (item) => (await this.creatures.createCreature(user, item, client)).ok,
      createCharacter: async (item) => idOf(await this.characters.createCharacter(user, item, client)),
      createCampaign: async (item) => idOf(await this.campaigns.createCampaign(user, item, client)),
      async placeCharacters(campaignId, characterIds) {
        await client.query('UPDATE "character" SET "campaignId" = $1 WHERE "id" = ANY($2::uuid[]) AND "ownerId" = $3', [campaignId, characterIds, user.id]);
      },
    }));
  }
}
