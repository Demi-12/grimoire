/** The encounter journal of a campaign: saved encounters, planned or played. DM material, start to finish. */
import { Injectable } from "@nestjs/common";
import type { AppUser, EncounterChange, EncounterInput, EncounterLineInput, EncounterStatus } from "@grimoire/shared/permissions";
import { fail, type DataResult } from "../common/data-result.js";
import { pool, transaction, type Queryable } from "../database/db.js";
import { CampaignsService } from "./campaigns.service.js";

export interface EncounterView {
  // createdByName is null once the author's account is deleted (the encounter stays with the campaign).
  id: string; campaignId: string; createdByName: string | null; title: string; notes: string; status: EncounterStatus;
  difficulty: "low" | "moderate" | "high"; budget: number; totalXp: number; partyLevels: number[];
  lines: EncounterLineInput[]; playedAt: string | null; createdAt: string; updatedAt: string;
}

type EncounterRow = Omit<EncounterView, "createdByName" | "playedAt" | "createdAt" | "updatedAt"> & {
  createdByName: string | null; playedAt: Date | null; createdAt: Date; updatedAt: Date;
};

const toEncounterView = (row: EncounterRow): EncounterView => ({
  ...row, playedAt: row.playedAt?.toISOString() ?? null, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(),
});

const encounterColumns = `e."id", e."campaignId", u."name" AS "createdByName", e."title", e."notes", e."status", e."difficulty",
  e."budget", e."totalXp", e."partyLevels", e."lines", e."playedAt", e."createdAt", e."updatedAt"`;

const MAX_ENCOUNTERS_PER_CAMPAIGN = 500;

@Injectable()
export class EncountersService {
  constructor(private readonly campaigns: CampaignsService) {}

  /** Encounters are DM material: only people who can manage the campaign may see or change them. */
  private async requireCampaignManager(db: Queryable, user: AppUser, campaignId: string): Promise<DataResult<null>> {
    const access = await this.campaigns.readCampaignAccess(db, user, campaignId);
    if (!access || !access.visible) return fail("not-found");
    return access.canManage ? { ok: true, value: null } : fail("forbidden");
  }

  async listEncounters(user: AppUser, campaignId: string): Promise<DataResult<EncounterView[]>> {
    const gate = await this.requireCampaignManager(pool, user, campaignId);
    if (!gate.ok) return gate;
    const result = await pool.query<EncounterRow>(
      `SELECT ${encounterColumns} FROM "encounter" e LEFT JOIN "user" u ON u."id" = e."createdBy"
        WHERE e."campaignId" = $1 ORDER BY (e."status" = 'planned') DESC, COALESCE(e."playedAt", e."createdAt") DESC`,
      [campaignId],
    );
    return { ok: true, value: result.rows.map(toEncounterView) };
  }

  async createEncounter(user: AppUser, campaignId: string, input: EncounterInput): Promise<DataResult<EncounterView>> {
    const gate = await this.requireCampaignManager(pool, user, campaignId);
    if (!gate.ok) return gate;
    return transaction(async (client) => {
      // Count and insert under one lock per campaign, so parallel saves can't slip past the limit.
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`encounter-limit:${campaignId}`]);
      const count = await client.query<{ n: string }>('SELECT count(*) AS n FROM "encounter" WHERE "campaignId" = $1', [campaignId]);
      if (Number(count.rows[0].n) >= MAX_ENCOUNTERS_PER_CAMPAIGN) return fail<EncounterView>("invalid");
      const inserted = await client.query<{ id: string }>(
        `INSERT INTO "encounter" ("campaignId", "createdBy", "title", "notes", "status", "difficulty", "budget", "totalXp", "partyLevels", "lines", "playedAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CASE WHEN $5 = 'played' THEN now() END) RETURNING "id"`,
        [campaignId, user.id, input.title, input.notes, input.status, input.difficulty, input.budget, input.totalXp, JSON.stringify(input.partyLevels), JSON.stringify(input.lines)],
      );
      const created = await client.query<EncounterRow>(`SELECT ${encounterColumns} FROM "encounter" e LEFT JOIN "user" u ON u."id" = e."createdBy" WHERE e."id" = $1`, [inserted.rows[0].id]);
      return { ok: true as const, value: toEncounterView(created.rows[0]) };
    });
  }

  /** Title, notes and status can change after saving; the generated creature list stays as saved. */
  async updateEncounter(
    user: AppUser, id: string, change: EncounterChange,
  ): Promise<DataResult<EncounterView>> {
    const existing = await pool.query<{ campaignId: string }>('SELECT "campaignId" FROM "encounter" WHERE "id" = $1', [id]);
    if (!existing.rows[0]) return fail("not-found");
    const gate = await this.requireCampaignManager(pool, user, existing.rows[0].campaignId);
    if (!gate.ok) return gate;
    await pool.query(
      `UPDATE "encounter" SET
         "title" = COALESCE($2, "title"), "notes" = COALESCE($3, "notes"), "status" = COALESCE($4, "status"),
         "playedAt" = CASE WHEN $4 = 'played' AND "playedAt" IS NULL THEN now() WHEN $4 = 'planned' THEN NULL ELSE "playedAt" END,
         "updatedAt" = now()
       WHERE "id" = $1`,
      [id, change.title ?? null, change.notes ?? null, change.status ?? null],
    );
    const updated = await pool.query<EncounterRow>(`SELECT ${encounterColumns} FROM "encounter" e LEFT JOIN "user" u ON u."id" = e."createdBy" WHERE e."id" = $1`, [id]);
    return { ok: true, value: toEncounterView(updated.rows[0]) };
  }

  async deleteEncounter(user: AppUser, id: string): Promise<DataResult<null>> {
    const existing = await pool.query<{ campaignId: string }>('SELECT "campaignId" FROM "encounter" WHERE "id" = $1', [id]);
    if (!existing.rows[0]) return fail("not-found");
    const gate = await this.requireCampaignManager(pool, user, existing.rows[0].campaignId);
    if (!gate.ok) return gate;
    await pool.query('DELETE FROM "encounter" WHERE "id" = $1', [id]);
    return { ok: true, value: null };
  }
}
