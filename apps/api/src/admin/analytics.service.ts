/**
 * The admin dashboard's report: usage and error figures read from what data/analytics-server.ts records.
 * Only the queries live here; shapeAnalyticsReport in @grimoire/shared/analytics turns their rows into the report.
 */
import { Injectable } from "@nestjs/common";
import { shapeAnalyticsReport, type AnalyticsRange, type AnalyticsReport, type AnalyticsRows } from "@grimoire/shared/analytics";
import { pool } from "../database/db.js";

@Injectable()
export class AnalyticsService {
  /** Everything the admin dashboard shows for the last `days` days (today included), cut at `timeZone`'s midnight. */
  async buildAnalyticsReport(days: AnalyticsRange, timeZone: string): Promise<AnalyticsReport> {
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
      pool.query<AnalyticsRows["events"][number]>(
        `SELECT "name",
                count(*) FILTER (WHERE "occurredAt" >= $1) AS current,
                count(*) FILTER (WHERE "occurredAt" < $1) AS previous,
                count(*) FILTER (WHERE "occurredAt" >= $1 AND "props"->>'mode' = 'creator') AS creator,
                count(*) FILTER (WHERE "occurredAt" >= $1 AND "props"->>'mode' = 'manual') AS manual
           FROM "usage_event" WHERE "occurredAt" >= $2 AND "name" <> 'page.view'
          GROUP BY "name"`,
        [start, prevStart],
      ),
      pool.query<NonNullable<AnalyticsRows["active"]>>(
        `SELECT count(DISTINCT "userId") FILTER (WHERE "occurredAt" >= $1) AS current,
                count(DISTINCT "userId") FILTER (WHERE "occurredAt" < $1) AS previous,
                count(DISTINCT "userId") FILTER (WHERE "occurredAt" >= $3) AS today
           FROM "usage_event" WHERE "occurredAt" >= $2`,
        [start, prevStart, todayStart],
      ),
      pool.query<NonNullable<AnalyticsRows["users"]>>(
        `SELECT count(*) FILTER (WHERE "status" = 'approved') AS approved,
                count(*) FILTER (WHERE "createdAt" >= $1) AS current,
                count(*) FILTER (WHERE "createdAt" >= $2 AND "createdAt" < $1) AS previous
           FROM "user"`,
        [start, prevStart],
      ),
      pool.query<NonNullable<AnalyticsRows["errorTotals"]>>(
        `SELECT count(*) FILTER (WHERE "occurredAt" >= $1) AS current,
                count(*) FILTER (WHERE "occurredAt" < $1) AS previous,
                count(DISTINCT "userId") FILTER (WHERE "occurredAt" >= $1) AS users,
                count(*) FILTER (WHERE "occurredAt" >= $1 AND "source" = 'server') AS server,
                count(*) FILTER (WHERE "occurredAt" >= $1 AND "source" = 'client') AS client
           FROM "app_error" WHERE "occurredAt" >= $2`,
        [start, prevStart],
      ),
      pool.query<AnalyticsRows["daily"][number]>(
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
      pool.query<AnalyticsRows["sections"][number]>(
        `SELECT "props"->>'section' AS section, count(*) AS views, count(DISTINCT "userId") AS users
           FROM "usage_event" WHERE "name" = 'page.view' AND "occurredAt" >= $1
          GROUP BY 1 ORDER BY views DESC`,
        [start],
      ),
      pool.query<AnalyticsRows["errors"][number]>(
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

    return shapeAnalyticsReport(
      { days, timeZone, from: fromDay, to: toDay },
      {
        events: events.rows, active: active.rows[0], users: users.rows[0], errorTotals: errorTotals.rows[0],
        daily: daily.rows, sections: sections.rows, errors: errors.rows,
      },
      new Date(),
    );
  }
}
