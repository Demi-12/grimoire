/**
 * Characters: the caller's own plus those placed in a campaign they belong to. Only the owner edits or
 * deletes one; putting it in a campaign needs membership there.
 */
import { Injectable } from "@nestjs/common";
import { characterDataOf, characterFieldsOf, type AppUser, type CharacterData, type CharacterInput, type CharacterScores } from "@grimoire/shared/permissions";
import { CampaignsService } from "../campaigns/campaigns.service.js";
import { fail, type DataResult } from "../common/data-result.js";
import { pool, type Queryable } from "../database/db.js";

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

type CharacterRow = {
  id: string; ownerId: string; ownerName: string; campaignId: string | null; name: string; level: number;
  data: CharacterData;
};

function toCharacterView(row: CharacterRow, viewerId: string): CharacterView {
  return {
    id: row.id,
    ownerId: row.ownerId,
    ownerName: row.ownerName,
    campaignId: row.campaignId,
    name: row.name,
    level: row.level,
    ...characterFieldsOf(row.data),
    editable: row.ownerId === viewerId,
  };
}

const characterColumns = `c."id", c."ownerId", u."name" AS "ownerName", c."campaignId", c."name", c."level", c."data"`;

async function readCharacter(db: Queryable, id: string, viewerId: string): Promise<CharacterView | null> {
  const result = await db.query<CharacterRow>(
    `SELECT ${characterColumns} FROM "character" c JOIN "user" u ON u."id" = c."ownerId" WHERE c."id" = $1`,
    [id],
  );
  return result.rows[0] ? toCharacterView(result.rows[0], viewerId) : null;
}

@Injectable()
export class CharactersService {
  constructor(private readonly campaigns: CampaignsService) {}

  /** Own characters plus every character placed in a campaign the user belongs to. */
  async listCharacters(user: AppUser): Promise<CharacterView[]> {
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

  async createCharacter(user: AppUser, input: CharacterInput, db: Queryable = pool): Promise<DataResult<CharacterView>> {
    if (input.campaignId && !(await this.campaigns.membershipRole(db, input.campaignId, user.id))) return fail("forbidden");
    const result = await db.query<{ id: string }>(
      `INSERT INTO "character" ("ownerId", "campaignId", "name", "level", "data") VALUES ($1, $2, $3, $4, $5) RETURNING "id"`,
      [user.id, input.campaignId, input.name, input.level, JSON.stringify(characterDataOf(input))],
    );
    const created = await readCharacter(db, result.rows[0].id, user.id);
    return created ? { ok: true, value: created } : fail("not-found");
  }

  async updateCharacter(user: AppUser, id: string, input: CharacterInput): Promise<DataResult<CharacterView>> {
    const current = await readCharacter(pool, id, user.id);
    if (!current) return fail("not-found");
    if (current.ownerId !== user.id) return fail("forbidden");
    if (input.campaignId && input.campaignId !== current.campaignId && !(await this.campaigns.membershipRole(pool, input.campaignId, user.id))) {
      return fail("forbidden");
    }
    await pool.query(
      `UPDATE "character" SET "campaignId" = $2, "name" = $3, "level" = $4, "data" = $5, "updatedAt" = now() WHERE "id" = $1`,
      [id, input.campaignId, input.name, input.level, JSON.stringify(characterDataOf(input))],
    );
    const updated = await readCharacter(pool, id, user.id);
    return updated ? { ok: true, value: updated } : fail("not-found");
  }

  async deleteCharacter(user: AppUser, id: string): Promise<DataResult<null>> {
    const result = await pool.query<{ ownerId: string }>('SELECT "ownerId" FROM "character" WHERE "id" = $1', [id]);
    if (!result.rows[0]) return fail("not-found");
    if (result.rows[0].ownerId !== user.id) return fail("forbidden");
    await pool.query('DELETE FROM "character" WHERE "id" = $1', [id]);
    return { ok: true, value: null };
  }
}
