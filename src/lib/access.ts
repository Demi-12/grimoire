import "server-only";
import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth-session";
import { pool } from "@/lib/db";
import { rateLimiter, type RateLimitPolicy } from "@/lib/rate-limit";
import { isAccountStatus, isSiteRole, parseAdminEmails, type AppUser, type SiteRole } from "@/lib/permissions";

export const jsonError = (status: number, error: string) => NextResponse.json({ error }, { status });

/**
 * The signed-in user with role and status read fresh from PostgreSQL, never from the cached
 * session cookie, so approvals, role changes and blocks apply on the very next request.
 */
export async function getCurrentUser(): Promise<AppUser | null> {
  const session = await getAuthSession();
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

  // Accounts that existed before the email was listed get promoted on their next request.
  if (user.status !== "blocked" && (user.role !== "admin" || user.status !== "approved")
    && parseAdminEmails(process.env.GRIMOIRE_ADMIN_EMAILS).has(user.email.toLowerCase())) {
    await pool.query('UPDATE "user" SET "role" = \'admin\', "status" = \'approved\', "updatedAt" = now() WHERE "id" = $1', [user.id]);
    return { ...user, role: "admin", status: "approved" };
  }
  return user;
}

/**
 * Require an unblocked account (optionally with one of `roles`) for a route handler. Returns the
 * user, or an error response to return as-is: `if (user instanceof NextResponse) return user;`
 */
export async function requireUser(roles?: SiteRole[]): Promise<AppUser | NextResponse> {
  const user = await getCurrentUser();
  if (!user) return jsonError(401, "Sign in to continue.");
  if (user.status !== "approved") return jsonError(403, "Your account has been blocked.");
  if (roles && !roles.includes(user.role)) return jsonError(403, "You don't have permission for that.");
  return user;
}

/** Parse a JSON body without throwing on malformed input. */
export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

/** Map a data-layer failure to an HTTP response. */
export function dataErrorResponse(error: "not-found" | "forbidden" | "invalid") {
  if (error === "not-found") return jsonError(404, "Not found.");
  if (error === "forbidden") return jsonError(403, "You don't have permission for that.");
  return jsonError(400, "That change isn't valid.");
}

/**
 * Apply a rate-limit policy to the signed-in user. Returns a 429 response to return as-is, or null:
 * `const limited = rateLimit(user, WRITE_LIMIT); if (limited) return limited;`
 */
export function rateLimit(user: Pick<AppUser, "id">, policy: RateLimitPolicy): NextResponse | null {
  const result = rateLimiter.consume(policy, user.id);
  if (result.ok) return null;
  const response = jsonError(429, "Too many requests. Please wait a moment and try again.");
  response.headers.set("Retry-After", String(result.retryAfterSeconds));
  return response;
}
