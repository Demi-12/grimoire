/**
 * /api/export and /api/import: download a JSON backup of the caller's own data, and put one back. The
 * import also takes the payload of the one-time move of data an old version kept in the browser.
 */
import { Controller, Get, HttpCode, Post, Res } from "@nestjs/common";
import type { Response } from "express";
import { backupFilename, BackupRestoreError, looksLikeBackup, MAX_BACKUP_BYTES, parseBackup, parseLegacyImport } from "@grimoire/shared/backup";
import type { AppUser } from "@grimoire/shared/permissions";
import { ApiError } from "../common/api-error.js";
import { Approved, CurrentUser } from "../common/auth.guard.js";
import { JsonBody } from "../common/params.js";
import { RateLimit } from "../common/rate-limit.guard.js";
import { IMPORT_LIMIT } from "../common/rate-limit.js";
import { BackupService } from "./backup.service.js";

const backupError = (status: number, error: string, code: string, path?: string) => new ApiError(status, error, code, path ? { path } : {});

@Controller()
@Approved()
export class BackupController {
  constructor(private readonly backups: BackupService) {}

  /** Download a JSON backup of the signed-in user's own data (characters, owned campaigns, creatures, encounter journal). */
  @Get("export")
  async export(@CurrentUser() user: AppUser, @Res({ passthrough: true }) response: Response): Promise<string> {
    const now = new Date();
    const backup = await this.backups.exportBackup(user, now);
    response.set({
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${backupFilename(now)}"`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    });
    // Indented by hand: the file is meant to be opened and read, not only restored.
    return JSON.stringify(backup, null, 2);
  }

  /**
   * POST a backup file (`{ version: 1, ... }`) to restore it, or the legacy browser-storage payload
   * (`{ characters, campaigns, creatures }`) for the one-time import of data saved in the browser.
   */
  @Post("import")
  @HttpCode(200)
  @RateLimit(IMPORT_LIMIT)
  // Backups can be larger than the legacy browser import; item counts still cap the legacy payload.
  async import(@CurrentUser() user: AppUser, @JsonBody(MAX_BACKUP_BYTES) parsedBody: unknown) {
    if (looksLikeBackup(parsedBody)) return this.restoreBackup(user, parsedBody);
    const legacy = parseLegacyImport(parsedBody);
    if (!legacy.ok) {
      throw legacy.error === "too-many" ? new ApiError(413, "Too many items to import at once.") : new ApiError(400, "Invalid import, or the data is too large.");
    }
    const imported = await this.backups.importLocalData(user, legacy.value);
    return { imported };
  }

  /** Restore a versioned backup (see @grimoire/shared/backup): strict validation, then a duplicate-free insert. */
  private async restoreBackup(user: AppUser, body: Record<string, unknown>) {
    const parsed = parseBackup(body);
    if (!parsed.ok) {
      const { code, path } = parsed.error;
      throw backupError(code === "too-many" ? 413 : 400, `Invalid backup (${code}${path ? `: ${path}` : ""}).`, code, path);
    }
    try {
      const result = await this.backups.importBackup(user, parsed.value);
      const imported: Record<string, number> = {};
      const skipped: Record<string, number> = {};
      for (const [name, counts] of Object.entries(result)) { imported[name] = counts.created; skipped[name] = counts.skipped; }
      return { imported, skipped, ignored: parsed.value.ignored };
    } catch (error) {
      if (error instanceof BackupRestoreError) throw backupError(409, `Backup exceeds the account limit for ${error.section}.`, "limit", error.section);
      throw error;
    }
  }
}
