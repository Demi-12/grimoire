import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { inferMonsterRoles } from "@grimoire/shared/monster-api";
import { toStatBlock } from "@grimoire/shared/open5e";

/** Minimal Open5e creature as the list endpoint returns it with `fields=`. */
const creature = (key: string, name: string, document: string, cr: number, xp?: number) => ({
  key, name, challenge_rating: cr, experience_points: xp ?? null, armor_class: 12, hit_points: 10,
  type: { name: "Humanoid", key: "humanoid" }, size: { name: "Small", key: "small" }, speed: { walk: 30, unit: "feet" },
  document: { key: document, name: document, display_name: document.toUpperCase(), publisher: { name: "Pub" } },
  actions: [{ name: "Scimitar", desc: "Melee Attack Roll: +4. Hit: 5 Slashing damage.", action_type: "ACTION" }], traits: [],
});

const pages: Record<number, unknown[]> = {
  1: [creature("srd-2024_goblin-boss", "Goblin Boss", "srd-2024", 1, 200), creature("srd_goblin-boss", "Goblin Boss", "srd-2014", 1)],
  2: [creature("tob_aboleth", "Aboleth", "tob", 10), creature("srd_lich", "Lich", "srd-2014", 21)],
};

/** Keeps only the fields a list request asks for, as Open5e's `fields=` and `actions__fields=` do. */
function trimmed(creature: Record<string, unknown>, params: URLSearchParams) {
  const keep = (value: Record<string, unknown>, fields: string | null) =>
    fields ? Object.fromEntries(Object.entries(value).filter(([key]) => fields.split(",").includes(key))) : value;
  const top = keep(creature, params.get("fields"));
  for (const list of ["actions", "traits"] as const) {
    if (Array.isArray(top[list])) top[list] = (top[list] as Record<string, unknown>[]).map((entry) => keep(entry, params.get(`${list}__fields`)));
  }
  return top;
}

function listPage(url: URL, results: unknown[], count = results.length): Response {
  return Response.json({ count, results: results.map((entry) => trimmed(entry as Record<string, unknown>, url.searchParams)) });
}

function respond(url: string): Response {
  const parsed = new URL(url);
  if (parsed.pathname === "/v2/creatures/") {
    const page = Number(parsed.searchParams.get("page"));
    return listPage(parsed, pages[page] ?? [], 250);
  }
  if (parsed.pathname === "/v2/creatures/srd_goblin/") return Response.json(creature("srd_goblin", "Goblin", "srd-2014", 0.25, 50));
  return new Response("Not found", { status: 404 });
}

describe("Open5e upstream", () => {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => respond(String(input)));
  beforeEach(() => { vi.stubGlobal("fetch", fetchMock); vi.resetModules(); fetchMock.mockClear(); });
  afterEach(() => vi.unstubAllGlobals());

  it("builds the catalog from every page, skipping copies a newer edition replaces", async () => {
    const { fetchMonsterCatalog } = await import("./monster-upstream.js");
    const { monsters, sources } = await fetchMonsterCatalog();
    expect(monsters.map((monster) => monster.index)).toEqual(["srd-2024_goblin-boss", "tob_aboleth", "srd_lich"]);
    expect(monsters[0]).toMatchObject({ cr: 1, xp: 200, source: "SRD-2024", sourceKey: "srd-2024", type: "humanoid" });
    expect(monsters[1].xp).toBe(5900);
    expect(sources).toEqual([
      { key: "srd-2014", name: "SRD-2014", publisher: "Pub", count: 1 },
      { key: "srd-2024", name: "SRD-2024", publisher: "Pub", count: 1 },
      { key: "tob", name: "TOB", publisher: "Pub", count: 1 },
    ]);
    const firstUrl = new URL(String(fetchMock.mock.calls[0][0]));
    expect(firstUrl.searchParams.get("limit")).toBe("200");
    expect(firstUrl.searchParams.get("fields")).toContain("challenge_rating");
  });

  it("retries a catalog page that times out instead of failing the whole catalog", async () => {
    let failedOnce = false;
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (!failedOnce && new URL(url).searchParams.get("page") === "2") {
        failedOnce = true;
        throw new DOMException("The operation timed out.", "TimeoutError");
      }
      return respond(url);
    });
    const { fetchMonsterCatalog } = await import("./monster-upstream.js");
    const { monsters } = await fetchMonsterCatalog();
    expect(failedOnce).toBe(true);
    expect(monsters.map((monster) => monster.index)).toEqual(["srd-2024_goblin-boss", "tob_aboleth", "srd_lich"]);
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => respond(String(input)));
  });

  it("keeps serving the last catalog when a refresh fails", async () => {
    vi.useFakeTimers();
    try {
      const { fetchMonsterCatalog } = await import("./monster-upstream.js");
      const first = await fetchMonsterCatalog();
      fetchMock.mockImplementation(async () => new Response("down", { status: 503 }));
      vi.setSystemTime(Date.now() + 25 * 60 * 60 * 1000);
      expect(await fetchMonsterCatalog()).toBe(first);
      await vi.advanceTimersByTimeAsync(0);
      expect(await fetchMonsterCatalog()).toBe(first);
    } finally {
      vi.useRealTimers();
      fetchMock.mockImplementation(async (input: RequestInfo | URL) => respond(String(input)));
    }
  });

  it("asks Open5e for every field the role rules read, so catalog roles match the stat block's", async () => {
    const base = creature("x", "X", "srd-2024", 1, 200);
    const scouts = [
      { ...base, key: "sneak", name: "Sneak", challenge_rating: 0.25, skill_bonuses: { stealth: 6 } },
      { ...base, key: "digger", name: "Digger", tremorsense_range: 60 },
      { ...base, key: "seer", name: "Seer", truesight_range: 30 },
    ];
    const legend = {
      ...base, key: "legend", name: "Legend", challenge_rating: 10, armor_class: 17, hit_points: 130, size: { name: "Huge", key: "huge" },
      actions: [...base.actions, { name: "Gaze", desc: "One creature it can see has the Paralyzed condition.", action_type: "LEGENDARY_ACTION" }],
    };
    const full = [...scouts, legend];
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => listPage(new URL(String(input)), full));
    try {
      const { fetchMonsterCatalog } = await import("./monster-upstream.js");
      const { monsters } = await fetchMonsterCatalog();
      const roles = Object.fromEntries(monsters.map((monster) => [monster.index, monster.roles]));
      expect(roles).toEqual(Object.fromEntries(full.map((entry) => [entry.key, inferMonsterRoles(toStatBlock(entry))])));
      expect(roles).toEqual({ sneak: ["scouting"], digger: ["scouting"], seer: ["scouting"], legend: ["frontline", "control"] });
    } finally {
      fetchMock.mockImplementation(async (input: RequestInfo | URL) => respond(String(input)));
    }
  });

  it("tells a creature's catalog roles only once a catalog is in memory, without fetching one", async () => {
    const { catalogRolesFor, fetchMonsterCatalog } = await import("./monster-upstream.js");
    expect(catalogRolesFor("srd-2024_goblin-boss")).toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
    await fetchMonsterCatalog();
    expect(catalogRolesFor("srd-2024_goblin-boss")).toEqual([]);
    // Old dnd5eapi slugs resolve to the SRD 5.2 first, as when opening a stat block.
    expect(catalogRolesFor("goblin-boss")).toEqual([]);
    expect(catalogRolesFor("tob_nothing")).toBeUndefined();
  });

  it("opens old saved slugs from the SRD 5.2, then the SRD 5.1", async () => {
    const { fetchMonsterDetail } = await import("./monster-upstream.js");
    const goblin = await fetchMonsterDetail("goblin");
    expect(goblin).toMatchObject({ index: "srd_goblin", name: "Goblin", xp: 50, source: { key: "srd-2014" } });
    expect(fetchMock.mock.calls.map(([url]) => new URL(String(url)).pathname)).toEqual(["/v2/creatures/srd-2024_goblin/", "/v2/creatures/srd_goblin/"]);
    expect(await fetchMonsterDetail("tob_nothing")).toBeNull();
  });
});
