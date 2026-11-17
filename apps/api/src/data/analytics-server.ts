/**
 * Writing usage events and errors to PostgreSQL. Plain functions, outside Nest's injection: the exception
 * filter and every controller call them. Reading them back for the dashboard is admin/analytics.service.ts.
 */
import { createHash } from "node:crypto";
import { pool } from "../database/db.js";
import {
  RETENTION_DAYS, errorGroupKey, sanitizeError, summarizeUserAgent,
  type ErrorReport, type EventName, type EventProps,
} from "@grimoire/shared/analytics";

/**
 * Analytics must never break or slow down the action being measured: every write here swallows its own
 * errors (a missing table before the migration runs, a full disk, ...) and only logs a one-line warning.
 */
let lastWarning = 0;
function warn(what: string, cause: unknown) {
  const now = Date.now();
  if (now - lastWarning < 60_000) return;
  lastWarning = now;
  console.warn(`[analytics] could not ${what}:`, cause instanceof Error ? cause.message : cause);
}

const PURGE_EVERY_MS = 60 * 60_000;
let lastPurge = 0;

/** Delete rows past the retention period, at most once an hour per process. */
async function purgeOldRows() {
  const now = Date.now();
  if (now - lastPurge < PURGE_EVERY_MS) return;
  lastPurge = now;
  try {
    await pool.query(`DELETE FROM "usage_event" WHERE "occurredAt" < now() - make_interval(days => $1)`, [RETENTION_DAYS]);
    await pool.query(`DELETE FROM "app_error" WHERE "occurredAt" < now() - make_interval(days => $1)`, [RETENTION_DAYS]);
  } catch (cause) {
    warn("delete old analytics", cause);
  }
}

/** Record one usage event. `userId` is null for actions without a signed-in account. */
export async function recordEvent(userId: string | null, name: EventName, props: EventProps = {}): Promise<void> {
  try {
    await pool.query('INSERT INTO "usage_event" ("userId", "name", "props") VALUES ($1, $2, $3)', [userId, name, JSON.stringify(props)]);
  } catch (cause) {
    warn("record an event", cause);
  }
  void purgeOldRows();
}

/** Record a server or browser error, cleaned of e-mails and tokens and grouped by fingerprint. */
export async function recordError(
  source: "server" | "client",
  report: ErrorReport,
  context: { userId?: string | null; userAgent?: string | null } = {},
): Promise<void> {
  const clean = sanitizeError(report);
  const fingerprint = createHash("sha256").update(errorGroupKey(source, clean)).digest("hex").slice(0, 32);
  try {
    await pool.query(
      `INSERT INTO "app_error" ("userId", "source", "fingerprint", "name", "message", "stack", "route", "method", "digest", "userAgent")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [context.userId ?? null, source, fingerprint, clean.name, clean.message, clean.stack, clean.route, clean.method, clean.digest, summarizeUserAgent(context.userAgent)],
    );
  } catch (cause) {
    warn("record an error", cause);
  }
  void purgeOldRows();
}

/** The signed-in account behind a request's headers, for errors caught outside a route handler. */
export async function userIdFromHeaders(headers: Headers): Promise<string | null> {
  if (!headers.get("cookie")) return null;
  try {
    const { auth } = await import("../auth/auth.js");
    const session = await auth.api.getSession({ headers });
    return session?.user.id ?? null;
  } catch {
    return null;
  }
}
