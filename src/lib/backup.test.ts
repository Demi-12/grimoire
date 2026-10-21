import { describe, expect, it } from "vitest";
import {
  BACKUP_VERSION,
  backupFilename,
  backupSections,
  looksLikeBackup,
  parseBackup,
  runRestore,
  serializeBackup,
  type IdMap,
  type SectionStore,
} from "./backup";

const scores = { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 };
const campaignId = "11111111-1111-4111-8111-111111111111";
const foreignCampaignId = "22222222-2222-4222-8222-222222222222";
const now = new Date("2026-10-21T10:00:00.000Z");

// Views as the data layer returns them, with extra fields that must never reach the file.
const views = {
  campaigns: [
    {
      id: campaignId, name: "Lost Mine", description: "Phandalin", ownerId: "user-1", ownerName: "Ana", myRole: "dm", isOwner: true, canManage: true,
      members: [{ userId: "user-1", name: "Ana", role: "dm" }, { userId: "user-2", name: "Bruno", role: "player", email: "bruno@example.com" }],
    },
  ],
  characters: [
    { id: "c1", ownerId: "user-1", ownerName: "Ana", editable: true, campaignId, name: "Mira", level: 3, className: "Wizard", species: "Elf", background: "Sage", scores, notes: "Likes owls", build: { class: "wizard", picks: { b: 1, a: 2 } } },
    { id: "c2", ownerId: "user-1", ownerName: "Ana", editable: true, campaignId: foreignCampaignId, name: "Tor", level: 1, className: "", species: "", background: "", scores, notes: "" },
  ],
  creatures: [
    { id: "cr1", name: "Goblin", xp: 50, source: "SRD", monsterSlug: "goblin", cr: 0.25, type: "humanoid", roleTags: ["damage"] },
    { id: "cr2", name: "Mi bestia", xp: 200, source: "Catálogo propio" },
  ],
  encounters: [
    {
      id: "e1", campaignId, createdByName: "Ana", title: "Ambush", notes: "", status: "played", difficulty: "moderate", budget: 300, totalXp: 150,
      partyLevels: [3, 3], lines: [{ name: "Goblin", xp: 50, count: 3, monsterSlug: "goblin" }], playedAt: "2026-10-01T18:00:00.000Z", createdAt: "2026-09-30T12:00:00.000Z", updatedAt: "2026-10-01T18:00:00.000Z",
    },
  ],
};

describe("serializeBackup", () => {
  const file = serializeBackup(views, now);

  it("writes a versioned file with every registered section", () => {
    expect(file.version).toBe(BACKUP_VERSION);
    expect(file.exportedAt).toBe("2026-10-21T10:00:00.000Z");
    for (const section of backupSections) expect(Array.isArray(file[section.key])).toBe(true);
    expect(backupFilename(now)).toBe("grimoire-backup-2026-10-21.json");
  });

  it("never leaks ids of people, emails, roles in other campaigns or server-only fields", () => {
    const json = JSON.stringify(file);
    for (const secret of ["user-1", "user-2", "bruno@example.com", "ownerId", "ownerName", "editable", "myRole", "canManage", "createdByName", "token", "password"]) {
      expect(json).not.toContain(secret);
    }
    expect((file.campaigns as { members: unknown[] }[])[0].members).toEqual([{ name: "Ana", role: "dm" }, { name: "Bruno", role: "player" }]);
  });

  it("drops the campaign link of characters whose campaign isn't exported", () => {
    const characters = file.characters as { id: string; campaignId: string | null }[];
    expect(characters.find((c) => c.id === "c1")?.campaignId).toBe(campaignId);
    expect(characters.find((c) => c.id === "c2")?.campaignId).toBeNull();
  });

  it("omits encounters of campaigns that aren't in the file", () => {
    const orphan = serializeBackup({ ...views, encounters: [{ ...views.encounters[0], campaignId: foreignCampaignId }] }, now);
    expect(orphan.encounters).toEqual([]);
  });

  it("round-trips through the validator", () => {
    const parsed = parseBackup(JSON.parse(JSON.stringify(file)));
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value.sections.characters).toHaveLength(2);
      expect(parsed.value.sections.encounters).toHaveLength(1);
      expect(parsed.value.ignored).toEqual([]);
    }
  });
});

describe("parseBackup", () => {
  const valid = () => JSON.parse(JSON.stringify(serializeBackup(views, now)));
  const errorOf = (body: unknown) => {
    const result = parseBackup(body);
    return result.ok ? null : result.error;
  };

  it("tells backups apart from the legacy browser payload", () => {
    expect(looksLikeBackup(valid())).toBe(true);
    expect(looksLikeBackup({ characters: [] })).toBe(false);
    expect(looksLikeBackup([])).toBe(false);
  });

  it("rejects non-objects, unknown versions and bad dates", () => {
    expect(errorOf(null)).toEqual({ code: "invalid" });
    expect(errorOf([])).toEqual({ code: "invalid" });
    expect(errorOf({ ...valid(), version: 2 })?.code).toBe("version");
    expect(errorOf({ ...valid(), version: "1" })?.code).toBe("version");
    expect(errorOf({ ...valid(), exportedAt: "yesterday" })).toEqual({ code: "invalid", path: "exportedAt" });
  });

  it("accepts a file with only some sections", () => {
    const result = parseBackup({ version: 1, exportedAt: now.toISOString(), creatures: valid().creatures });
    expect(result.ok && Object.keys(result.value.sections)).toEqual(["creatures"]);
  });

  it("rejects the whole file when any item is invalid, naming the entry", () => {
    const body = valid();
    body.characters[1].level = 99;
    expect(errorOf(body)).toEqual({ code: "item", path: "characters[1]" });
    const badCreature = valid();
    badCreature.creatures[0].xp = -5;
    expect(errorOf(badCreature)).toEqual({ code: "item", path: "creatures[0]" });
    const badRole = valid();
    badRole.campaigns[0].members[0].role = "owner";
    expect(errorOf(badRole)).toEqual({ code: "item", path: "campaigns[0]" });
  });

  it("rejects sections that aren't arrays and unusually large sections", () => {
    expect(errorOf({ ...valid(), characters: {} })).toEqual({ code: "section", path: "characters" });
    expect(errorOf({ ...valid(), creatures: Array.from({ length: 501 }, () => views.creatures[1]) })).toEqual({ code: "too-many", path: "creatures" });
  });

  it("rejects references to campaigns missing from the file and duplicate ids", () => {
    const dangling = valid();
    dangling.characters[0].campaignId = foreignCampaignId;
    expect(errorOf(dangling)).toEqual({ code: "item", path: "characters[0]" });
    const encounter = valid();
    encounter.encounters[0].campaignId = foreignCampaignId;
    expect(errorOf(encounter)).toEqual({ code: "item", path: "encounters[0]" });
    const dupes = valid();
    dupes.campaigns.push({ ...dupes.campaigns[0] });
    expect(errorOf(dupes)).toEqual({ code: "item", path: "campaigns[1]" });
  });

  it("rejects bad encounter dates and oversized builds", () => {
    const badDate = valid();
    badDate.encounters[0].playedAt = "soon";
    expect(errorOf(badDate)?.path).toBe("encounters[0]");
    const bigBuild = valid();
    bigBuild.characters[0].build = { blob: "x".repeat(17_000) };
    expect(errorOf(bigBuild)?.path).toBe("characters[0]");
  });

  it("reports unknown sections instead of importing them", () => {
    const result = parseBackup({ ...valid(), homebrewMonsters: [{ name: "x" }] });
    expect(result.ok && result.value.ignored).toEqual(["homebrewMonsters"]);
    expect(result.ok && "homebrewMonsters" in result.value.sections).toBe(false);
  });

  it("does not carry unvalidated properties through", () => {
    const body = valid();
    body.characters[0].isAdmin = true;
    body.characters[0].ownerId = "someone-else";
    const result = parseBackup(body);
    expect(result.ok && JSON.stringify(result.value.sections.characters)).not.toMatch(/isAdmin|someone-else/);
  });
});

/** In-memory account that behaves like the SQL stores: same fingerprints, jsonb-style key reordering. */
function memoryAccount() {
  const rows: Record<string, { id: string; item: any }[]> = { campaigns: [], characters: [], creatures: [], encounters: [] }; // eslint-disable-line @typescript-eslint/no-explicit-any
  let nextId = 1;
  const reorder = (value: unknown): unknown => Array.isArray(value) ? value.map(reorder)
    : value && typeof value === "object" ? Object.fromEntries(Object.entries(value).reverse().map(([k, v]) => [k, reorder(v)])) : value;
  const stores: Record<string, SectionStore> = {};
  for (const section of backupSections) {
    const identity: IdMap = {};
    stores[section.key] = {
      async existing() {
        const found = new Map<string, string>();
        for (const row of rows[section.key]) found.set(section.fingerprint(row.item, identity), row.id);
        return found;
      },
      async create(item, idMap) {
        const id = `db-${nextId++}`;
        const stored = reorder(item) as Record<string, unknown>;
        // Like the real tables, rows point at real ids, not backup-local ones.
        if (section.key === "characters" || section.key === "encounters") {
          const local = stored.campaignId as string | null;
          stored.campaignId = local ? idMap.campaigns.get(local) ?? null : null;
        }
        rows[section.key].push({ id, item: stored });
        return id;
      },
    };
  }
  return { rows, stores };
}

describe("runRestore idempotence", () => {
  const parsed = () => {
    const result = parseBackup(JSON.parse(JSON.stringify(serializeBackup(views, now))));
    if (!result.ok) throw new Error("fixture must be valid");
    return result.value;
  };

  it("creates everything the first time and nothing the second", async () => {
    const account = memoryAccount();
    const first = await runRestore(parsed(), account.stores);
    expect(first).toEqual({
      campaigns: { created: 1, skipped: 0 }, characters: { created: 2, skipped: 0 },
      creatures: { created: 2, skipped: 0 }, encounters: { created: 1, skipped: 0 },
    });
    const before = JSON.stringify(account.rows);
    const second = await runRestore(parsed(), account.stores);
    expect(second).toEqual({
      campaigns: { created: 0, skipped: 1 }, characters: { created: 0, skipped: 2 },
      creatures: { created: 0, skipped: 2 }, encounters: { created: 0, skipped: 1 },
    });
    expect(JSON.stringify(account.rows)).toBe(before);
  });

  it("links restored characters and encounters to the real campaign, new or existing", async () => {
    const account = memoryAccount();
    await runRestore(parsed(), account.stores);
    const [campaign] = account.rows.campaigns;
    expect(account.rows.characters.find((row) => row.item.name === "Mira")?.item.campaignId).toBe(campaign.id);
    expect(account.rows.encounters[0].item.campaignId).toBe(campaign.id);
  });

  it("collapses duplicates inside the file", async () => {
    const account = memoryAccount();
    const body = JSON.parse(JSON.stringify(serializeBackup(views, now)));
    body.creatures.push({ ...body.creatures[1] }, { ...body.creatures[0], name: "Goblin (copy)" });
    body.characters.push({ ...body.characters[1], id: "c3" });
    const result = parseBackup(body);
    if (!result.ok) throw new Error("fixture must be valid");
    const counts = await runRestore(result.value, account.stores);
    expect(counts.creatures).toEqual({ created: 2, skipped: 2 });
    expect(counts.characters).toEqual({ created: 2, skipped: 1 });
  });

  it("restores an encounter into the matching campaign even if its id changed", async () => {
    const account = memoryAccount();
    await runRestore(parsed(), account.stores);
    const body = JSON.parse(JSON.stringify(serializeBackup(views, now)));
    const renumbered = JSON.parse(JSON.stringify(body).replaceAll(campaignId, "99999999-9999-4999-8999-999999999999"));
    const result = parseBackup(renumbered);
    if (!result.ok) throw new Error("fixture must be valid");
    const counts = await runRestore(result.value, account.stores);
    expect(counts.campaigns.created).toBe(0);
    expect(counts.encounters.created).toBe(0);
    expect(account.rows.encounters).toHaveLength(1);
  });

  it("restores changed content as new items instead of overwriting", async () => {
    const account = memoryAccount();
    await runRestore(parsed(), account.stores);
    const body = JSON.parse(JSON.stringify(serializeBackup(views, now)));
    body.characters[0].level = 4;
    const result = parseBackup(body);
    if (!result.ok) throw new Error("fixture must be valid");
    const counts = await runRestore(result.value, account.stores);
    expect(counts.characters).toEqual({ created: 1, skipped: 1 });
    expect(account.rows.characters.map((row) => row.item.level).sort()).toEqual([1, 3, 4]);
  });

  it("only runs stores for sections present in the file", async () => {
    const account = memoryAccount();
    const result = parseBackup({ version: 1, exportedAt: now.toISOString(), creatures: [{ name: "Wolf", xp: 50, source: "" }] });
    if (!result.ok) throw new Error("fixture must be valid");
    const counts = await runRestore(result.value, account.stores);
    expect(counts.creatures.created).toBe(1);
    expect(account.rows.campaigns).toHaveLength(0);
  });
});
