import { afterEach, describe, expect, it, vi } from "vitest";
import {
  creatureTypeKey, creatureTypeLabel, fetchMonster, fetchMonsterCatalog, fetchSrdCatalog, formatChallenge, inferMonsterRoles, MonsterApiError,
  sourceLabel, type MonsterStatBlock,
} from "./monster-api.js";

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
      sources: [{ key: "srd-2024", name: "SRD 5.2", count: 2 }, { key: 1, name: "No key" }, { key: "no-name" }],
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
    serve(500, { error: "" });
    expect(await failure(fetchMonsterCatalog())).toMatchObject({ message: "", status: 500 });
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

describe("inferMonsterRoles", () => {
  const bite = { name: "Bite", desc: "Melee Attack Roll: +4, reach 5 ft. Hit: 6 (1d8 + 2) Piercing damage." };
  /** A creature with one plain attack, so only the numbers under test decide the roles. */
  const plain = (stats: Partial<MonsterStatBlock>): MonsterStatBlock => ({ name: "Test creature", actions: [bite], ...stats });

  it("tags a tough melee brute as frontline damage", () => {
    const ogre = plain({
      name: "Ogre", challenge_rating: 2, armor_class: 11, hit_points: 68, speed: { walk: "40 ft." },
      actions: [{ name: "Greatclub", desc: "Melee Attack Roll: +6, reach 5 ft. Hit: 13 (2d8 + 4) Bludgeoning damage." }],
    });
    expect(inferMonsterRoles(ogre)).toEqual(["frontline", "damage"]);
  });

  it("puts heavily armoured creatures on the front line from AC 16 up, using the best listed value", () => {
    const knight = (armor: MonsterStatBlock["armor_class"]) => inferMonsterRoles(plain({ challenge_rating: 3, hit_points: 52, armor_class: armor }));
    expect(knight([{ type: "armor", value: 16 }])).toEqual(["frontline", "damage"]);
    expect(knight([{ type: "natural" }, { type: "armor", value: 18 }])).toEqual(["frontline", "damage"]);
    expect(knight(16)).toEqual(["frontline", "damage"]);
    expect(knight([{ type: "armor", value: 15 }])).toEqual(["damage"]);
    expect(knight(undefined)).toEqual(["damage"]);
  });

  it("asks for 19.2 hit points per challenge rating before HP alone makes a creature frontline", () => {
    const atCr5 = (hit_points: number) => inferMonsterRoles(plain({ challenge_rating: 5, armor_class: 13, hit_points }));
    expect(atCr5(96)).toContain("frontline");
    expect(atCr5(95)).not.toContain("frontline");
    expect(atCr5(50)).not.toContain("frontline");
  });

  it("treats a missing rating as CR 1 and gives CR 1/8 and below the smallest HP bar", () => {
    const roles = (challenge_rating: number | undefined, hit_points: number) =>
      inferMonsterRoles(plain({ challenge_rating, armor_class: 10, hit_points })).includes("frontline");
    expect([roles(undefined, 19), roles(undefined, 20)]).toEqual([false, true]);
    expect([roles(0, 2), roles(0, 3), roles(0.125, 2), roles(0.125, 3)]).toEqual([false, true, false, true]);
  });

  it("reads a spellcaster's paragraphs and bonus actions: control, damage and a teleport to scout", () => {
    const mage = plain({
      name: "Mage", challenge_rating: 6, armor_class: 15, hit_points: 81, speed: { walk: "30 ft." },
      actions: [
        { name: "Arcane Burst", desc: "Ranged Attack Roll: +6, range 120 ft. Hit: 19 (3d8 + 6) Force damage." },
        { name: "Spellcasting", desc: ["The mage casts one of its spells.", "At will: Light, Mage Hand."] },
      ],
      bonus_actions: [{ name: "Misty Step", desc: "The mage teleports up to 30 feet to a space it can see." }],
    });
    expect(inferMonsterRoles(mage)).toEqual(["control", "damage", "scouting"]);
  });

  it("calls a healer that helps its allies support, even when the healing is a reaction", () => {
    const priest = plain({
      name: "Priest", challenge_rating: 2, armor_class: 13, hit_points: 38, actions: [],
      reactions: [{ name: "Mending Word", desc: "One creature the priest can see regains 7 hit points." }],
    });
    expect(inferMonsterRoles(priest)).toEqual(["support"]);
  });

  it("finds restraining effects in a creature's traits", () => {
    const ooze = plain({
      name: "Ooze", challenge_rating: 2, armor_class: 8, hit_points: 30, actions: [],
      special_abilities: [{ name: "Sticky Body", desc: "A creature that touches the ooze is Restrained." }],
    });
    expect(inferMonsterRoles(ooze)).toEqual(["control"]);
  });

  it("scouts with any fly speed or a climb or swim speed of 40 ft. or more, not with a fast walk or darkvision", () => {
    const skirmisher = (speed: Record<string, string>) =>
      inferMonsterRoles(plain({ challenge_rating: 1, armor_class: 13, hit_points: 11, speed, senses: { darkvision: "60 ft." } }));
    expect(skirmisher({ walk: "40 ft.", climb: "40 ft." })).toEqual(["damage", "scouting"]);
    expect(skirmisher({ walk: "30 ft.", swim: "60 ft." })).toEqual(["damage", "scouting"]);
    expect(skirmisher({ walk: "10 ft.", fly: "30 ft." })).toEqual(["damage", "scouting"]);
    expect(skirmisher({ walk: "50 ft.", climb: "30 ft." })).toEqual(["damage"]);
  });

  it("gives no role to a creature with nothing to read", () => {
    expect(inferMonsterRoles({ name: "Shrub" })).toEqual([]);
  });
});

describe("sourceLabel", () => {
  it("names the book, takes a name as it is, and falls back to Open5e", () => {
    expect(sourceLabel({ name: "SRD 5.2" })).toBe("SRD 5.2");
    expect(sourceLabel("Tome of Beasts")).toBe("Tome of Beasts");
    expect(sourceLabel(undefined)).toBe("Open5e");
  });
});

describe("creatureTypeKey and creatureTypeLabel", () => {
  it("groups variants of a type under one key", () => {
    expect(["Beast", "  Undead ", "Humanoid (goblinoid)", "swarm of Tiny beasts", "Swarm"].map(creatureTypeKey))
      .toEqual(["beast", "undead", "humanoid", "swarm", "swarm"]);
  });

  it("keeps unknown types as they are and files blank ones under other", () => {
    expect(["Spirit", "", "   "].map(creatureTypeKey)).toEqual(["spirit", "other", "other"]);
  });

  it("labels known types in both languages and capitalises unknown keys", () => {
    expect([creatureTypeLabel("dragon", "en"), creatureTypeLabel("dragon", "es")]).toEqual(["Dragon", "Dragón"]);
    expect([creatureTypeLabel("swarm", "en"), creatureTypeLabel("swarm", "es")]).toEqual(["Swarm", "Enjambre"]);
    expect([creatureTypeLabel("spirit", "es"), creatureTypeLabel("other", "en")]).toEqual(["Spirit", "Other"]);
  });
});
