import { BACKUP_VERSION, BackupRestoreError } from "@grimoire/shared/backup";
import type { AppUser } from "@grimoire/shared/permissions";
import { describe, expect, it, vi } from "vitest";
import { BackupController } from "./backup.controller.js";
import type { BackupService } from "./backup.service.js";

// The data layer is a stand-in that answers like BackupService; parsing and the HTTP errors are the real ones.
const user: AppUser = { id: "user-1", name: "Test", email: "test@example.invalid", role: "user", status: "approved" };
const exportedAt = "2026-01-02T03:04:05.000Z";

function controller(restore: () => Promise<unknown> = async () => ({})) {
  const backups = {
    importBackup: vi.fn(restore),
    importLocalData: vi.fn(async () => ({ characters: 1, campaigns: 0, creatures: 0 })),
  };
  return { backups, api: new BackupController(backups as unknown as BackupService) };
}

/** The status and body an ApiError leaves with. */
async function failure(call: Promise<unknown>): Promise<{ status: number; body: unknown }> {
  try {
    await call;
  } catch (error) {
    const thrown = error as { getStatus(): number; getResponse(): unknown };
    return { status: thrown.getStatus(), body: thrown.getResponse() };
  }
  throw new Error("expected the call to fail");
}

describe("POST /api/import with a backup file", () => {
  it("restores it and reports what was created, skipped and left out", async () => {
    const { api, backups } = controller(async () => ({ characters: { created: 2, skipped: 1 }, campaigns: { created: 0, skipped: 3 } }));
    expect(await api.import(user, { version: BACKUP_VERSION, exportedAt, characters: [], future: [] })).toEqual({
      imported: { characters: 2, campaigns: 0 },
      skipped: { characters: 1, campaigns: 3 },
      ignored: ["future"],
    });
    expect(backups.importBackup).toHaveBeenCalledWith(user, expect.objectContaining({ sections: { characters: [] } }));
  });

  it("answers 400 naming what is wrong, and 413 when a section has too many items", async () => {
    const { api, backups } = controller();
    expect(await failure(api.import(user, { version: 99, exportedAt })))
      .toEqual({ status: 400, body: { error: "Invalid backup (version: version).", code: "version", path: "version" } });
    expect(await failure(api.import(user, { version: BACKUP_VERSION, exportedAt: "yesterday" })))
      .toEqual({ status: 400, body: { error: "Invalid backup (invalid: exportedAt).", code: "invalid", path: "exportedAt" } });
    expect(await failure(api.import(user, { version: BACKUP_VERSION, exportedAt, campaigns: Array.from({ length: 201 }, () => ({})) })))
      .toEqual({ status: 413, body: { error: "Invalid backup (too-many: campaigns).", code: "too-many", path: "campaigns" } });
    expect(backups.importBackup).not.toHaveBeenCalled();
  });

  it("answers 409 when the restore would pass an account limit, and lets any other failure through", async () => {
    const full = controller(async () => { throw new BackupRestoreError("limit", "creatures"); });
    expect(await failure(full.api.import(user, { version: BACKUP_VERSION, exportedAt })))
      .toEqual({ status: 409, body: { error: "Backup exceeds the account limit for creatures.", code: "limit", path: "creatures" } });

    const broken = new Error("database down");
    const down = controller(async () => { throw broken; });
    await expect(down.api.import(user, { version: BACKUP_VERSION, exportedAt })).rejects.toBe(broken);
  });
});

describe("POST /api/import with data saved by an old version in the browser", () => {
  it("imports it", async () => {
    const { api, backups } = controller();
    expect(await api.import(user, { characters: [] })).toEqual({ imported: { characters: 1, campaigns: 0, creatures: 0 } });
    expect(backups.importLocalData).toHaveBeenCalledWith(user, expect.anything());
  });

  it("answers 400 to anything else and 413 to too many items", async () => {
    const { api, backups } = controller();
    expect(await failure(api.import(user, null))).toEqual({ status: 400, body: { error: "Invalid import, or the data is too large." } });
    expect(await failure(api.import(user, { characters: Array.from({ length: 201 }, () => ({})) })))
      .toEqual({ status: 413, body: { error: "Too many items to import at once." } });
    expect(backups.importLocalData).not.toHaveBeenCalled();
  });
});
