/** What an account keeps about itself: language, theme and whether its browser-saved data was dealt with. */
import { Injectable } from "@nestjs/common";
import type { PreferencesInput } from "@grimoire/shared/permissions";
import { pool } from "../database/db.js";

export interface PreferencesView { locale: "en" | "es" | null; theme: "light" | "dark" | null; legacyImported: boolean }

@Injectable()
export class MeService {
  async readPreferences(userId: string): Promise<PreferencesView> {
    const result = await pool.query<{ locale: "en" | "es" | null; theme: "light" | "dark" | null; legacyImportedAt: Date | null }>(
      'SELECT "locale", "theme", "legacyImportedAt" FROM "user" WHERE "id" = $1', [userId]);
    const row = result.rows[0];
    return { locale: row?.locale ?? null, theme: row?.theme ?? null, legacyImported: Boolean(row?.legacyImportedAt) };
  }

  async updatePreferences(userId: string, change: PreferencesInput & { legacyImported?: true }) {
    await pool.query(
      `UPDATE "user" SET "locale" = COALESCE($2, "locale"), "theme" = COALESCE($3, "theme"),
         "legacyImportedAt" = CASE WHEN $4::boolean THEN COALESCE("legacyImportedAt", now()) ELSE "legacyImportedAt" END
       WHERE "id" = $1`,
      [userId, change.locale ?? null, change.theme ?? null, change.legacyImported === true],
    );
  }
}
