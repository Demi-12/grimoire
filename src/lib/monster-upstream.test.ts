import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

function respond(url: string): Response {
  const parsed = new URL(url);
  if (parsed.pathname === "/v2/creatures/") {
    const page = Number(parsed.searchParams.get("page"));
    return Response.json({ count: 250, results: pages[page] ?? [] });
  }
  if (parsed.pathname === "/v2/creatures/srd_goblin/") return Response.json(creature("srd_goblin", "Goblin", "srd-2014", 0.25, 50));
  return new Response("Not found", { status: 404 });
}

describe("Open5e upstream", () => {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => respond(String(input)));
  beforeEach(() => { vi.stubGlobal("fetch", fetchMock); vi.resetModules(); fetchMock.mockClear(); });
  afterEach(() => vi.unstubAllGlobals());

  it("builds the catalog from every page, skipping copies a newer edition replaces", async () => {
    const { fetchMonsterCatalog } = await import("./monster-upstream");
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
    const { fetchMonsterCatalog } = await import("./monster-upstream");
    const { monsters } = await fetchMonsterCatalog();
    expect(failedOnce).toBe(true);
    expect(monsters.map((monster) => monster.index)).toEqual(["srd-2024_goblin-boss", "tob_aboleth", "srd_lich"]);
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => respond(String(input)));
  });

  it("keeps serving the last catalog when a refresh fails", async () => {
    vi.useFakeTimers();
    try {
      const { fetchMonsterCatalog } = await import("./monster-upstream");
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

  it("opens old saved slugs from the SRD 5.2, then the SRD 5.1", async () => {
    const { fetchMonsterDetail } = await import("./monster-upstream");
    const goblin = await fetchMonsterDetail("goblin");
    expect(goblin).toMatchObject({ index: "srd_goblin", name: "Goblin", xp: 50, source: { key: "srd-2014" } });
    expect(fetchMock.mock.calls.map(([url]) => new URL(String(url)).pathname)).toEqual(["/v2/creatures/srd-2024_goblin/", "/v2/creatures/srd_goblin/"]);
    expect(await fetchMonsterDetail("tob_nothing")).toBeNull();
  });
});
