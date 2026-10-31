import { describe, expect, it } from "vitest";
import {
  applyMapOps, columnName, emptyMapState, findFreeSpot, normalizeMapState, parseMapOp, parseMapOps, squareName, syncHeroes, visibleMapState,
  type MapHero, type MapState,
} from "./battle-map";

const aliceHero = "11111111-1111-4111-8111-111111111111";
const bobHero = "22222222-2222-4222-8222-222222222222";
const heroes: MapHero[] = [
  { id: aliceHero, name: "Lia", ownerId: "alice" },
  { id: bobHero, name: "Brom", ownerId: "bob" },
];
const dm = { userId: "dm", isDm: true };
const alice = { userId: "alice", isDm: false };

function ids() {
  let n = 0;
  return () => `t${++n}`;
}

function withParty(): MapState {
  const result = applyMapOps(emptyMapState(), [
    { type: "place-hero", characterId: aliceHero, x: 1, y: 1 },
    { type: "place-hero", characterId: bobHero, x: 2, y: 1 },
    { type: "add-monster", label: "Goblin", count: 2, size: 1, hidden: false },
    { type: "add-monster", label: "Ogre", count: 1, size: 2, hidden: true },
  ], dm, heroes, ids());
  if (!result.ok) throw new Error(result.error);
  return result.state;
}

describe("parseMapOp", () => {
  it("accepts well-formed changes and fills defaults", () => {
    expect(parseMapOp({ type: "move", tokenId: "abc", x: 3, y: 4 })).toEqual({ type: "move", tokenId: "abc", x: 3, y: 4 });
    expect(parseMapOp({ type: "add-monster", label: "  Goblin   boss ", count: 2 })).toEqual({ type: "add-monster", label: "Goblin boss", count: 2, size: 1, hidden: false });
    expect(parseMapOp({ type: "place-hero", characterId: aliceHero })).toEqual({ type: "place-hero", characterId: aliceHero });
  });

  it("rejects anything out of bounds", () => {
    expect(parseMapOp({ type: "move", tokenId: "abc", x: -1, y: 0 })).toBeNull();
    expect(parseMapOp({ type: "move", tokenId: "a b", x: 1, y: 0 })).toBeNull();
    expect(parseMapOp({ type: "add-monster", label: "Goblin", count: 21 })).toBeNull();
    expect(parseMapOp({ type: "add-monster", label: "x".repeat(41), count: 1 })).toBeNull();
    expect(parseMapOp({ type: "add-monster", label: "Goblin", count: 1, size: 5 })).toBeNull();
    expect(parseMapOp({ type: "place-hero", characterId: "not-a-uuid" })).toBeNull();
    expect(parseMapOp({ type: "place-hero", characterId: aliceHero, x: 2 })).toBeNull();
    expect(parseMapOp({ type: "update", tokenId: "abc" })).toBeNull();
    expect(parseMapOp({ type: "resize", cols: 3, rows: 10 })).toBeNull();
    expect(parseMapOp({ type: "teleport" })).toBeNull();
  });

  it("rejects a batch if any change is invalid, empty or too long", () => {
    expect(parseMapOps({ ops: [{ type: "clear-monsters" }] })).toHaveLength(1);
    expect(parseMapOps({ ops: [{ type: "clear-monsters" }, { type: "nope" }] })).toBeNull();
    expect(parseMapOps({ ops: [] })).toBeNull();
    expect(parseMapOps({ ops: Array.from({ length: 41 }, () => ({ type: "clear-monsters" })) })).toBeNull();
    expect(parseMapOps(null)).toBeNull();
  });
});

describe("applyMapOps", () => {
  it("numbers monsters and places them from the right without stacking", () => {
    const state = withParty();
    const monsters = state.tokens.filter((token) => token.kind === "monster");
    expect(monsters.map((token) => token.label)).toEqual(["Goblin 1", "Goblin 2", "Ogre"]);
    expect(monsters[0]).toMatchObject({ x: 19, y: 0 });
    expect(monsters[1]).toMatchObject({ x: 19, y: 1 });
    // The ogre is 2×2 and doesn't fit in column 19 any more.
    expect(monsters[2]).toMatchObject({ x: 18, y: 2, size: 2, hidden: true });
    const more = applyMapOps(state, [{ type: "add-monster", label: "Goblin", count: 2, size: 1, hidden: false }], dm, heroes, ids());
    expect(more.ok && more.state.tokens.slice(-2).map((token) => token.label)).toEqual(["Goblin 3", "Goblin 4"]);
  });

  it("lets a player move and remove only their own hero", () => {
    const state = withParty();
    const lia = state.tokens.find((token) => token.characterId === aliceHero)!;
    const brom = state.tokens.find((token) => token.characterId === bobHero)!;
    const goblin = state.tokens.find((token) => token.kind === "monster")!;
    const moved = applyMapOps(state, [{ type: "move", tokenId: lia.id, x: 5, y: 6 }], alice, heroes, ids());
    expect(moved.ok && moved.state.tokens.find((token) => token.id === lia.id)).toMatchObject({ x: 5, y: 6 });
    expect(applyMapOps(state, [{ type: "move", tokenId: brom.id, x: 5, y: 6 }], alice, heroes, ids())).toEqual({ ok: false, error: "forbidden" });
    expect(applyMapOps(state, [{ type: "move", tokenId: goblin.id, x: 5, y: 6 }], alice, heroes, ids())).toEqual({ ok: false, error: "forbidden" });
    expect(applyMapOps(state, [{ type: "remove", tokenId: brom.id }], alice, heroes, ids())).toEqual({ ok: false, error: "forbidden" });
    const removed = applyMapOps(state, [{ type: "remove", tokenId: lia.id }], alice, heroes, ids());
    expect(removed.ok && removed.state.tokens.some((token) => token.id === lia.id)).toBe(false);
  });

  it("lets players place their own heroes once (placing again moves the token)", () => {
    const first = applyMapOps(emptyMapState(), [{ type: "place-hero", characterId: aliceHero }], alice, heroes, ids());
    expect(first.ok && first.state.tokens).toEqual([{ id: "t1", kind: "hero", label: "Lia", characterId: aliceHero, size: 1, x: 0, y: 0 }]);
    if (!first.ok) return;
    const again = applyMapOps(first.state, [{ type: "place-hero", characterId: aliceHero, x: 4, y: 4 }], alice, heroes, ids());
    expect(again.ok && again.state.tokens).toHaveLength(1);
    expect(again.ok && again.state.tokens[0]).toMatchObject({ x: 4, y: 4 });
    expect(applyMapOps(emptyMapState(), [{ type: "place-hero", characterId: bobHero }], alice, heroes, ids())).toEqual({ ok: false, error: "forbidden" });
    expect(applyMapOps(emptyMapState(), [{ type: "place-hero", characterId: "33333333-3333-4333-8333-333333333333" }], dm, heroes, ids())).toEqual({ ok: false, error: "invalid" });
  });

  it("keeps DM-only changes away from players and rejects the whole batch", () => {
    const state = withParty();
    const lia = state.tokens.find((token) => token.characterId === aliceHero)!;
    for (const op of [
      { type: "add-monster", label: "Rat", count: 1, size: 1, hidden: false },
      { type: "update", tokenId: lia.id, defeated: true },
      { type: "clear-monsters" },
      { type: "resize", cols: 10, rows: 10 },
    ] as const) {
      expect(applyMapOps(state, [{ type: "move", tokenId: lia.id, x: 3, y: 3 }, op], alice, heroes, ids())).toEqual({ ok: false, error: "forbidden" });
    }
  });

  it("hides, reveals, defeats and resizes monsters; heroes can't be hidden", () => {
    const state = withParty();
    const ogre = state.tokens.find((token) => token.label === "Ogre")!;
    const lia = state.tokens.find((token) => token.characterId === aliceHero)!;
    const revealed = applyMapOps(state, [{ type: "update", tokenId: ogre.id, hidden: false, defeated: true, size: 3 }], dm, heroes, ids());
    const after = revealed.ok ? revealed.state.tokens.find((token) => token.id === ogre.id) : null;
    expect(after).toMatchObject({ defeated: true, size: 3, x: 17 });
    expect(after && "hidden" in after).toBe(false);
    expect(applyMapOps(state, [{ type: "update", tokenId: lia.id, hidden: true }], dm, heroes, ids())).toEqual({ ok: false, error: "invalid" });
  });

  it("keeps every token inside the grid when moving or shrinking it", () => {
    const state = withParty();
    const ogre = state.tokens.find((token) => token.label === "Ogre")!;
    const moved = applyMapOps(state, [{ type: "move", tokenId: ogre.id, x: 39, y: 39 }], dm, heroes, ids());
    expect(moved.ok && moved.state.tokens.find((token) => token.id === ogre.id)).toMatchObject({ x: 18, y: 12 });
    const shrunk = applyMapOps(state, [{ type: "resize", cols: 6, rows: 5 }], dm, heroes, ids());
    expect(shrunk.ok && shrunk.state.tokens.every((token) => token.x + token.size <= 6 && token.y + token.size <= 5)).toBe(true);
  });

  it("clears monsters but keeps heroes", () => {
    const cleared = applyMapOps(withParty(), [{ type: "clear-monsters" }], dm, heroes, ids());
    expect(cleared.ok && cleared.state.tokens.map((token) => token.kind)).toEqual(["hero", "hero"]);
  });
});

describe("what each viewer sees", () => {
  it("drops hidden monsters for players", () => {
    const state = withParty();
    expect(visibleMapState(state, false).tokens.map((token) => token.label)).toEqual(["Lia", "Brom", "Goblin 1", "Goblin 2"]);
    expect(visibleMapState(state, true).tokens).toHaveLength(5);
  });

  it("drops heroes that left the campaign and follows renames", () => {
    const synced = syncHeroes(withParty(), [{ id: aliceHero, name: "Lia the Bold", ownerId: "alice" }]);
    expect(synced.tokens.filter((token) => token.kind === "hero").map((token) => token.label)).toEqual(["Lia the Bold"]);
  });

  it("reads damaged stored state without failing", () => {
    expect(normalizeMapState(null)).toEqual(emptyMapState());
    const state = normalizeMapState({
      cols: 8, rows: 99,
      tokens: [
        { id: "ok", kind: "monster", label: "Rat", x: 30, y: 2, size: 1 },
        { id: "bad id!", kind: "monster", label: "Rat", x: 0, y: 0, size: 1 },
        { id: "nohero", kind: "hero", label: "Ghost", x: 0, y: 0, size: 1 },
        "junk",
      ],
    });
    expect(state.cols).toBe(8);
    expect(state.rows).toBe(14);
    expect(state.tokens).toEqual([{ id: "ok", kind: "monster", label: "Rat", x: 7, y: 2, size: 1 }]);
  });
});

describe("grid helpers", () => {
  it("names squares like the table says them", () => {
    expect(columnName(0)).toBe("A");
    expect(columnName(25)).toBe("Z");
    expect(columnName(26)).toBe("AA");
    expect(squareName(2, 3)).toBe("C4");
  });

  it("finds a free spot from either side", () => {
    expect(findFreeSpot(emptyMapState(), 1, "left")).toEqual({ x: 0, y: 0 });
    expect(findFreeSpot(emptyMapState(), 2, "right")).toEqual({ x: 18, y: 0 });
  });
});
