/**
 * How many approved admins the site has. A plain function, outside Nest's injection: better-auth's sign-up
 * hook (auth/auth.ts) and the account lookup of every request (common/current-user.ts) need it too.
 */
import { pool } from "../database/db.js";

export async function countApprovedAdmins(): Promise<number> {
  const result = await pool.query<{ count: number }>(`SELECT count(*)::int AS "count" FROM "user" WHERE "role" = 'admin' AND "status" = 'approved'`);
  return result.rows[0]?.count ?? 0;
}
