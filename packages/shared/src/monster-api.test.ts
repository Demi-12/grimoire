import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchMonster, fetchMonsterCatalog, fetchSrdCatalog, formatChallenge, MonsterApiError } from "./monster-api.js";

/** Answer every fetch with this status and JSON body, and remember the URLs asked for. */
function serve(status: number, body: unknown) {
  const urls: string[] = [];
  vi.stubGlobal("fetch", async (url: string) => {
    urls.push(url);
    return new Response(body === undefined ? "not json" : JSON.stringify(body), { status });
  });
  return urls;
}

const failure = (promise: Promise<unknown>) => promise.then(() => null, (error: unknown) => error);

afterEach(() => vi.unstubAllGlobals());

describe("fetchMonsterCatalog", () => {
  it("sends only the filters that are set, with the search trimmed", async () => {
    const urls = serve(200, { results: [] });
    await fetchMonsterCatalog();
    await fetchMonsterCatalog({ challengeRating: "0.25", source: "srd-2024", search: "  goblin ", page: 2, limit: 24 });
    await fetchMonsterCatalog({ search: "   " });
    expect(urls).toEqual(["/api/monsters", "/api/monsters?challenge_rating=0.25&source=srd-2024&search=goblin&page=2&limit=24", "/api/monsters"]);
  });

  it("keeps the well-formed entries and books and counts them when the total is missing", async () => {
    serve(200, {
      sources: [{ key: "srd-2024", name: "SRD 5.2", count: 2 }, { key: 1 }],
      results: [{ index: "goblin", name: "Goblin", cr: 0.25 }, { index: "orc" }, null],
    });
    expect(await fetchMonsterCatalog()).toEqual({
      count: 1, sources: [{ key: "srd-2024", name: "SRD 5.2", count: 2 }], results: [{ index: "goblin", name: "Goblin", cr: 0.25 }],
    });
    serve(200, { count: 340, results: [] });
    expect((await fetchMonsterCatalog()).count).toBe(340);
  });

  it("raises the API's error with its status, or a generic one", async () => {
    serve(400, { error: "Invalid book filter." });
    expect(await failure(fetchMonsterCatalog())).toMatchObject({ message: "Invalid book filter.", status: 400 });
    serve(502, undefined);
    expect(await failure(fetchMonsterCatalog())).toMatchObject({ message: "Could not load the bestiary.", status: 502 });
  });

  it("rejects an answer that is not a catalog", async () => {
    serve(200, { results: "none" });
    expect(await failure(fetchMonsterCatalog())).toBeInstanceOf(MonsterApiError);
    serve(200, null);
    expect(await failure(fetchMonsterCatalog())).toBeInstanceOf(MonsterApiError);
  });
});

describe("fetchMonster", () => {
  it("asks for the encoded slug and returns the stat block", async () => {
    const urls = serve(200, { name: "Goblin" });
    expect(await fetchMonster("homebrew:a b")).toEqual({ name: "Goblin" });
    expect(urls).toEqual(["/api/monsters/homebrew%3Aa%20b"]);
  });

  it("raises on errors and on answers without a name", async () => {
    serve(404, { error: "Not found." });
    expect(await failure(fetchMonster("x"))).toMatchObject({ message: "Not found.", status: 404 });
    serve(500, undefined);
    expect(await failure(fetchMonster("x"))).toMatchObject({ message: "Could not load this creature.", status: 500 });
    serve(200, { index: "x" });
    expect(await failure(fetchMonster("x"))).toBeInstanceOf(MonsterApiError);
  });
});

describe("fetchSrdCatalog", () => {
  it("keeps the monsters that have an index, XP and rating", async () => {
    const goblin = { index: "goblin", name: "Goblin", cr: 0.25, xp: 50 };
    serve(200, { sources: [{ key: "srd-2024", name: "SRD 5.2", count: 1 }], monsters: [goblin, { index: "orc", cr: 1 }] });
    expect(await fetchSrdCatalog()).toEqual({ sources: [{ key: "srd-2024", name: "SRD 5.2", count: 1 }], monsters: [goblin] });
    serve(200, { monsters: [] });
    expect((await fetchSrdCatalog()).sources).toEqual([]);
  });

  it("raises on errors and on answers without a monster list", async () => {
    serve(503, { error: "Open5e is down." });
    expect(await failure(fetchSrdCatalog())).toMatchObject({ message: "Open5e is down.", status: 503 });
    serve(200, {});
    expect(await failure(fetchSrdCatalog())).toBeInstanceOf(MonsterApiError);
  });
});

describe("formatChallenge", () => {
  it("writes fractional ratings as fractions", () => {
    expect([0, 0.125, 0.25, 0.5, 1, 30, undefined].map(formatChallenge)).toEqual(["0", "1/8", "1/4", "1/2", "1", "30", "—"]);
  });
});
