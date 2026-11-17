/** The personal creature catalog of an account: what its encounter builder offers next to the bestiary. */
import { Injectable } from "@nestjs/common";
import type { AppUser, CreatureInput } from "@grimoire/shared/permissions";
import { fail, type DataResult } from "../common/data-result.js";
import { pool, transaction, type Queryable } from "../database/db.js";

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

@Injectable()
export class CreaturesService {
  async listCreatures(user: AppUser): Promise<CreatureView[]> {
    const result = await pool.query<CreatureRow>(`SELECT ${creatureColumns} FROM "creature" WHERE "ownerId" = $1 ORDER BY "createdAt" DESC`, [user.id]);
    return result.rows.map(toCreatureView);
  }

  /** Adds a creature; re-adding the same SRD monster returns the existing row. */
  async createCreature(user: AppUser, input: CreatureInput, db?: Queryable): Promise<DataResult<CreatureView>> {
    const run = async (client: Queryable): Promise<DataResult<CreatureView>> => {
      // Count and insert under one lock per account, so parallel requests can't slip past the limit.
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`creature-limit:${user.id}`]);
      const count = await client.query<{ n: string }>('SELECT count(*) AS n FROM "creature" WHERE "ownerId" = $1', [user.id]);
      if (Number(count.rows[0].n) >= MAX_CREATURES_PER_USER) return fail("invalid");
      const result = await client.query<CreatureRow>(
        `INSERT INTO "creature" ("ownerId", "name", "xp", "source", "monsterSlug", "cr", "type", "roleTags")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT ("ownerId", "monsterSlug") WHERE "monsterSlug" IS NOT NULL DO UPDATE SET "name" = EXCLUDED."name"
         RETURNING ${creatureColumns}`,
        [user.id, input.name, input.xp, input.source, input.monsterSlug, input.cr, input.type, JSON.stringify(input.roleTags)],
      );
      return { ok: true, value: toCreatureView(result.rows[0]) };
    };
    return db ? run(db) : transaction(run);
  }

  async deleteCreature(user: AppUser, id: string): Promise<DataResult<null>> {
    const result = await pool.query('DELETE FROM "creature" WHERE "id" = $1 AND "ownerId" = $2', [id, user.id]);
    return result.rowCount ? { ok: true, value: null } : fail("not-found");
  }
}
