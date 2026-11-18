/** Accounts as the admin panel sees and changes them: approve, block, promote, sign out, delete. */
import { Injectable } from "@nestjs/common";
import type { AccountStatus, SiteRole } from "@grimoire/shared/permissions";
import { pool, transaction } from "../database/db.js";

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

@Injectable()
export class AdminService {
  async listUsersForAdmin(): Promise<AdminUserView[]> {
    const result = await pool.query<Omit<AdminUserView, "createdAt"> & { createdAt: Date }>(
      `SELECT u."id", u."name", u."email", u."role", u."status", u."emailVerified", u."twoFactorEnabled", u."createdAt",
              (SELECT count(*)::int FROM "campaign_member" m WHERE m."userId" = u."id") AS "campaignCount",
              (SELECT count(*)::int FROM "character" c WHERE c."ownerId" = u."id") AS "characterCount"
         FROM "user" u
        ORDER BY CASE u."status" WHEN 'pending' THEN 0 WHEN 'approved' THEN 1 ELSE 2 END, u."createdAt" DESC`,
    );
    return result.rows.map((row) => ({ ...row, createdAt: new Date(row.createdAt).toISOString() }));
  }

  async readUserForAdmin(id: string) {
    const result = await pool.query<{ id: string; role: SiteRole; status: AccountStatus }>('SELECT "id", "role", "status" FROM "user" WHERE "id" = $1', [id]);
    return result.rows[0] ?? null;
  }

  async applyAdminChange(id: string, change: { role?: SiteRole; status?: AccountStatus }) {
    await transaction(async (client) => {
      if (change.role) await client.query('UPDATE "user" SET "role" = $2, "updatedAt" = now() WHERE "id" = $1', [id, change.role]);
      if (change.status) await client.query('UPDATE "user" SET "status" = $2, "updatedAt" = now() WHERE "id" = $1', [id, change.status]);
      // A blocked or un-approved account loses every open session immediately.
      if (change.status && change.status !== "approved") await client.query('DELETE FROM "session" WHERE "userId" = $1', [id]);
    });
  }

  async revokeUserSessions(id: string) {
    await pool.query('DELETE FROM "session" WHERE "userId" = $1', [id]);
  }

  /** Deleting an account removes its characters and the campaigns it created (cascade). */
  async deleteUser(id: string) {
    await pool.query('DELETE FROM "user" WHERE "id" = $1', [id]);
  }
}
