/**
 * Who is calling: the signed-in account behind a request, with role and status read fresh from PostgreSQL.
 * The guards in auth.guard.ts use it; controllers receive the result through `@CurrentUser()`.
 */
import type { Request } from "express";
import { fromNodeHeaders } from "better-auth/node";
import { isAccountStatus, isSiteRole, parseAdminEmails, type AppUser } from "@grimoire/shared/permissions";
import { auth } from "../auth/auth.js";
import { countApprovedAdmins } from "../admin/admin-count.js";
import { pool } from "../database/db.js";

/** Express request once a guard has resolved its account (null: looked up, nobody signed in). */
export type AppRequest = Request & { grimoireUser?: AppUser | null };

/**
 * The signed-in user with role and status read fresh from PostgreSQL, never from the cached
 * session cookie, so approvals, role changes and blocks apply on the very next request.
 * The answer is kept on the request, so a guard and a controller asking twice cost one lookup.
 */
export async function getCurrentUser(request: AppRequest): Promise<AppUser | null> {
  if (request.grimoireUser !== undefined) return request.grimoireUser;
  const user = await lookUp(request);
  request.grimoireUser = user;
  return user;
}

async function lookUp(request: Request): Promise<AppUser | null> {
  const session = await auth.api.getSession({ headers: fromNodeHeaders(request.headers) });
  if (!session?.user) return null;
  const result = await pool.query<{ id: string; name: string; email: string; role: string; status: string }>(
    'SELECT "id", "name", "email", "role", "status" FROM "user" WHERE "id" = $1',
    [session.user.id],
  );
  const row = result.rows[0];
  if (!row) return null;
  const { role, status } = row;
  if (!isSiteRole(role) || !isAccountStatus(status)) return null;
  const user: AppUser = { id: row.id, name: row.name, email: row.email, role, status };

  // Accounts that existed before the email was listed get promoted on their next request. Sign-up doesn't verify
  // emails, so the list only bootstraps the first admin; after that, admins are named from the admin panel.
  if (user.status !== "blocked" && (user.role !== "admin" || user.status !== "approved")
    && parseAdminEmails(process.env.GRIMOIRE_ADMIN_EMAILS).has(user.email.toLowerCase())
    && await countApprovedAdmins() === 0) {
    await pool.query('UPDATE "user" SET "role" = \'admin\', "status" = \'approved\', "updatedAt" = now() WHERE "id" = $1', [user.id]);
    return { ...user, role: "admin", status: "approved" };
  }
  return user;
}
