/**
 * Runs the analytics store and the dashboard report against a real PostgreSQL with the Liquibase schema applied.
 * Skipped unless TEST_DATABASE_URL points at a disposable database (see homebrew.integration.test.ts).
 * Other suites may write analytics at the same time, so the checks compare reports before and after.
 */
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { AnalyticsReport } from "../src/lib/analytics";

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("usage analytics on PostgreSQL", () => {
  const tag = randomUUID().slice(0, 8);
  const ids = [`an-${tag}-ada`, `an-${tag}-bo`];
  let pool: typeof import("../src/lib/db").pool;
  let store: typeof import("../src/lib/analytics-server");

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    ({ pool } = await import("../src/lib/db"));
    store = await import("../src/lib/analytics-server");
    for (const id of ids) {
      await pool.query(
        'INSERT INTO "user" ("id", "name", "email", "role", "status", "createdAt", "updatedAt") VALUES ($1, $1, $2, \'user\', \'approved\', now(), now())',
        [id, `${id}@example.test`],
      );
    }
  });

  afterAll(async () => {
    if (!pool) return;
    await pool.query('DELETE FROM "usage_event" WHERE "props"->>\'tag\' = $1', [tag]);
    await pool.query('DELETE FROM "app_error" WHERE "message" LIKE $1', [`%${tag}%`]);
    await pool.query('DELETE FROM "user" WHERE "id" = ANY($1::text[])', [ids]);
    await pool.end();
  });

  const diff = (after: AnalyticsReport, before: AnalyticsReport) => ({
    active: after.kpis.activeUsers.current - before.kpis.activeUsers.current,
    characters: after.kpis.charactersCreated.current - before.kpis.charactersCreated.current,
    creator: after.kpis.charactersCreated.creator - before.kpis.charactersCreated.creator,
    manual: after.kpis.charactersCreated.manual - before.kpis.charactersCreated.manual,
    previousCharacters: after.kpis.charactersCreated.previous - before.kpis.charactersCreated.previous,
    encounters: after.kpis.encountersGenerated.current - before.kpis.encountersGenerated.current,
    campaigns: after.kpis.campaignsCreated.current - before.kpis.campaignsCreated.current,
    joined: after.kpis.campaignsJoined.current - before.kpis.campaignsJoined.current,
    wizard: after.kpis.wizard.started - before.kpis.wizard.started,
    errors: after.kpis.errors.current - before.kpis.errors.current,
    clientErrors: after.kpis.errors.client - before.kpis.errors.client,
    todayCharacters: after.daily.at(-1)!.characters - before.daily.at(-1)!.characters,
  });

  it("counts events in the current and previous periods and splits characters by how they were made", async () => {
    const [ada, bo] = ids;
    const before = await store.buildAnalyticsReport(7, "UTC");
    await store.recordEvent(ada, "character.created", { mode: "creator", level: 1, tag });
    await store.recordEvent(ada, "character.created", { mode: "manual", level: 3, tag });
    await store.recordEvent(bo, "character.wizard_started", { quick: false, tag });
    await store.recordEvent(bo, "encounter.generated", { difficulty: "high", tag });
    await store.recordEvent(bo, "campaign.created", { tag });
    await store.recordEvent(ada, "campaign.joined", { via: "invite", tag });
    await store.recordEvent(ada, "page.view", { section: "characters", tag });
    // Ten days ago: outside the 7-day period, inside the previous one.
    await pool.query(
      `INSERT INTO "usage_event" ("userId", "name", "props", "occurredAt") VALUES ($1, 'character.created', $2, now() - interval '10 days')`,
      [ada, JSON.stringify({ mode: "creator", tag })],
    );
    const after = await store.buildAnalyticsReport(7, "UTC");

    expect(diff(after, before)).toMatchObject({
      active: 2, characters: 2, creator: 1, manual: 1, previousCharacters: 1,
      encounters: 1, campaigns: 1, joined: 1, wizard: 1, todayCharacters: 2,
    });
    expect(after.sections.find((row) => row.section === "characters")?.views).toBeGreaterThanOrEqual(1);
  });

  it("returns one row per day ending today in the requested time zone", async () => {
    for (const timeZone of ["UTC", "Pacific/Kiritimati", "America/Los_Angeles"]) {
      const report = await store.buildAnalyticsReport(30, timeZone);
      expect(report.daily).toHaveLength(30);
      expect(report.daily.at(-1)!.date).toBe(new Intl.DateTimeFormat("en-CA", { timeZone }).format(new Date()));
      expect(report.range).toMatchObject({ days: 30, timeZone, to: report.daily.at(-1)!.date, from: report.daily[0].date });
    }
  });

  it("stores errors cleaned and grouped by fingerprint", async () => {
    const before = await store.buildAnalyticsReport(7, "UTC");
    for (const index of [1, 2, 3]) {
      await store.recordError("client", {
        name: "TypeError", message: `Cannot read item ${index} for ada@example.com (${tag})`, stack: "at Sheet (sheet.tsx:1:1)",
        route: `/characters/${randomUUID()}?invite=secret`, method: null, digest: null,
      }, { userId: ids[0], userAgent: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36" });
    }
    const after = await store.buildAnalyticsReport(7, "UTC");
    expect(diff(after, before)).toMatchObject({ errors: 3, clientErrors: 3 });

    const group = after.errors.find((item) => item.message.includes(tag));
    expect(group).toMatchObject({ source: "client", name: "TypeError", route: "/characters/:id", count: 3, users: 1, userAgent: "Chrome 131 · Linux" });
    expect(group?.message).toContain("[email]");
    expect(group?.message).not.toContain("ada@example.com");
  });

  it("keeps an account's events but unlinks them when the account is deleted", async () => {
    const id = `an-${tag}-gone`;
    await pool.query('INSERT INTO "user" ("id", "name", "email", "role", "status", "createdAt", "updatedAt") VALUES ($1, $1, $2, \'user\', \'approved\', now(), now())', [id, `${id}@example.test`]);
    await store.recordEvent(id, "encounter.generated", { tag: `${tag}-gone` });
    await pool.query('DELETE FROM "user" WHERE "id" = $1', [id]);
    const rows = await pool.query('SELECT "userId" FROM "usage_event" WHERE "props"->>\'tag\' = $1', [`${tag}-gone`]);
    expect(rows.rows).toEqual([{ userId: null }]);
    await pool.query('DELETE FROM "usage_event" WHERE "props"->>\'tag\' = $1', [`${tag}-gone`]);
  });

  it("rejects oversized properties at the database too", async () => {
    await expect(pool.query('INSERT INTO "usage_event" ("name", "props") VALUES (\'page.view\', $1)', [JSON.stringify({ x: "y".repeat(3000) })])).rejects.toThrow();
  });
});
