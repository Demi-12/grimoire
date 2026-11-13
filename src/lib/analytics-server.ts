import "server-only";
import { createHash } from "node:crypto";
import { pool } from "@/lib/db";
import {
  RETENTION_DAYS, SECTIONS, errorGroupKey, sanitizeError, summarizeUserAgent,
  type AnalyticsRange, type AnalyticsReport, type ErrorReport, type EventName, type EventProps, type Section,
} from "@/lib/analytics";

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
    const { auth } = await import("@/lib/auth");
    const session = await auth.api.getSession({ headers });
    return session?.user.id ?? null;
  } catch {
    return null;
  }
}

const count = (value: unknown) => Number(value ?? 0);

/** Everything the admin dashboard shows for the last `days` days (today included), cut at `timeZone`'s midnight. */
export async function buildAnalyticsReport(days: AnalyticsRange, timeZone: string): Promise<AnalyticsReport> {
  const bounds = await pool.query<{ fromDay: string; toDay: string; start: Date; prevStart: Date; todayStart: Date }>(
    `SELECT to_char(d.today - ($2::int - 1), 'YYYY-MM-DD') AS "fromDay",
            to_char(d.today, 'YYYY-MM-DD') AS "toDay",
            ((d.today - ($2::int - 1))::timestamp AT TIME ZONE $1) AS "start",
            ((d.today - ($2::int * 2 - 1))::timestamp AT TIME ZONE $1) AS "prevStart",
            (d.today::timestamp AT TIME ZONE $1) AS "todayStart"
       FROM (SELECT (now() AT TIME ZONE $1)::date AS today) d`,
    [timeZone, days],
  );
  const { fromDay, toDay, start, prevStart, todayStart } = bounds.rows[0];

  const [events, active, users, errorTotals, daily, sections, errors] = await Promise.all([
    pool.query<{ name: string; current: string; previous: string; creator: string; manual: string }>(
      `SELECT "name",
              count(*) FILTER (WHERE "occurredAt" >= $1) AS current,
              count(*) FILTER (WHERE "occurredAt" < $1) AS previous,
              count(*) FILTER (WHERE "occurredAt" >= $1 AND "props"->>'mode' = 'creator') AS creator,
              count(*) FILTER (WHERE "occurredAt" >= $1 AND "props"->>'mode' = 'manual') AS manual
         FROM "usage_event" WHERE "occurredAt" >= $2 AND "name" <> 'page.view'
        GROUP BY "name"`,
      [start, prevStart],
    ),
    pool.query<{ current: string; previous: string; today: string }>(
      `SELECT count(DISTINCT "userId") FILTER (WHERE "occurredAt" >= $1) AS current,
              count(DISTINCT "userId") FILTER (WHERE "occurredAt" < $1) AS previous,
              count(DISTINCT "userId") FILTER (WHERE "occurredAt" >= $3) AS today
         FROM "usage_event" WHERE "occurredAt" >= $2`,
      [start, prevStart, todayStart],
    ),
    pool.query<{ approved: string; current: string; previous: string }>(
      `SELECT count(*) FILTER (WHERE "status" = 'approved') AS approved,
              count(*) FILTER (WHERE "createdAt" >= $1) AS current,
              count(*) FILTER (WHERE "createdAt" >= $2 AND "createdAt" < $1) AS previous
         FROM "user"`,
      [start, prevStart],
    ),
    pool.query<{ current: string; previous: string; users: string; server: string; client: string }>(
      `SELECT count(*) FILTER (WHERE "occurredAt" >= $1) AS current,
              count(*) FILTER (WHERE "occurredAt" < $1) AS previous,
              count(DISTINCT "userId") FILTER (WHERE "occurredAt" >= $1) AS users,
              count(*) FILTER (WHERE "occurredAt" >= $1 AND "source" = 'server') AS server,
              count(*) FILTER (WHERE "occurredAt" >= $1 AND "source" = 'client') AS client
         FROM "app_error" WHERE "occurredAt" >= $2`,
      [start, prevStart],
    ),
    pool.query<{ date: string; activeUsers: string; characters: string; encounters: string; campaigns: string; errors: string }>(
      `SELECT to_char(d.day, 'YYYY-MM-DD') AS date,
              coalesce(e."activeUsers", 0) AS "activeUsers", coalesce(e.characters, 0) AS characters,
              coalesce(e.encounters, 0) AS encounters, coalesce(e.campaigns, 0) AS campaigns, coalesce(r.errors, 0) AS errors
         FROM generate_series($1::date, $2::date, interval '1 day') AS d(day)
         LEFT JOIN (
           SELECT ("occurredAt" AT TIME ZONE $3)::date AS day,
                  count(DISTINCT "userId") AS "activeUsers",
                  count(*) FILTER (WHERE "name" = 'character.created') AS characters,
                  count(*) FILTER (WHERE "name" = 'encounter.generated') AS encounters,
                  count(*) FILTER (WHERE "name" = 'campaign.created') AS campaigns
             FROM "usage_event" WHERE "occurredAt" >= $4 GROUP BY 1
         ) e ON e.day = d.day::date
         LEFT JOIN (
           SELECT ("occurredAt" AT TIME ZONE $3)::date AS day, count(*) AS errors
             FROM "app_error" WHERE "occurredAt" >= $4 GROUP BY 1
         ) r ON r.day = d.day::date
        ORDER BY d.day`,
      [fromDay, toDay, timeZone, start],
    ),
    pool.query<{ section: string; views: string; users: string }>(
      `SELECT "props"->>'section' AS section, count(*) AS views, count(DISTINCT "userId") AS users
         FROM "usage_event" WHERE "name" = 'page.view' AND "occurredAt" >= $1
        GROUP BY 1 ORDER BY views DESC`,
      [start],
    ),
    pool.query<{
      fingerprint: string; source: "server" | "client"; name: string; message: string; route: string | null;
      count: string; users: string; firstSeen: Date; lastSeen: Date; stack: string | null; digest: string | null; userAgent: string | null; method: string | null;
    }>(
      `SELECT DISTINCT ON (g.fingerprint) g.fingerprint, a."source", a."name", a."message", a."route", g.count, g.users,
              g."firstSeen", g."lastSeen", a."stack", a."digest", a."userAgent", a."method"
         FROM (
           SELECT "fingerprint", count(*) AS count, count(DISTINCT "userId") AS users,
                  min("occurredAt") AS "firstSeen", max("occurredAt") AS "lastSeen"
             FROM "app_error" WHERE "occurredAt" >= $1 GROUP BY "fingerprint"
         ) g
         JOIN "app_error" a ON a."fingerprint" = g.fingerprint AND a."occurredAt" = g."lastSeen"
        ORDER BY g.fingerprint, a."id" DESC`,
      [start],
    ),
  ]);

  const byName = new Map(events.rows.map((row) => [row.name, row]));
  const compare = (name: EventName) => ({ current: count(byName.get(name)?.current), previous: count(byName.get(name)?.previous) });
  const created = byName.get("character.created");

  return {
    range: { days, timeZone, from: fromDay, to: toDay, generatedAt: new Date().toISOString() },
    kpis: {
      activeUsers: { current: count(active.rows[0]?.current), previous: count(active.rows[0]?.previous) },
      activeToday: count(active.rows[0]?.today),
      approvedUsers: count(users.rows[0]?.approved),
      newUsers: { current: count(users.rows[0]?.current), previous: count(users.rows[0]?.previous) },
      charactersCreated: { ...compare("character.created"), creator: count(created?.creator), manual: count(created?.manual) },
      encountersGenerated: compare("encounter.generated"),
      encountersSaved: compare("encounter.saved"),
      campaignsCreated: compare("campaign.created"),
      campaignsJoined: compare("campaign.joined"),
      errors: {
        current: count(errorTotals.rows[0]?.current), previous: count(errorTotals.rows[0]?.previous),
        users: count(errorTotals.rows[0]?.users), server: count(errorTotals.rows[0]?.server), client: count(errorTotals.rows[0]?.client),
      },
      wizard: { started: compare("character.wizard_started").current, completed: count(created?.creator) },
    },
    daily: daily.rows.map((row) => ({
      date: row.date, activeUsers: count(row.activeUsers), characters: count(row.characters),
      encounters: count(row.encounters), campaigns: count(row.campaigns), errors: count(row.errors),
    })),
    sections: sections.rows
      .filter((row): row is typeof row & { section: Section } => (SECTIONS as readonly string[]).includes(row.section))
      .map((row) => ({ section: row.section, views: count(row.views), users: count(row.users) })),
    errors: errors.rows
      .map((row) => ({
        fingerprint: row.fingerprint, source: row.source, name: row.name, message: row.message, route: row.route,
        count: count(row.count), users: count(row.users), firstSeen: row.firstSeen.toISOString(), lastSeen: row.lastSeen.toISOString(),
        stack: row.stack, digest: row.digest, userAgent: row.userAgent, method: row.method,
      }))
      .sort((a, b) => b.lastSeen.localeCompare(a.lastSeen))
      .slice(0, 50),
  };
}
