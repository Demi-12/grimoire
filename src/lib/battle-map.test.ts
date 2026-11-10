import { describe, expect, it } from "vitest";
import {
  applyMapOps, blockingEdges, canReach, columnName, currentSight, exploredCells, lineIsClear, nearDoor, parseWall, emptyMapState, findFreeSpot, normalizeMapState, parseMapOp, parseMapOps, partySight, rowsForImage, sniffImageType,
  squareName, syncHeroes, tokenSight, tokenVision, visibleMapState,
  type MapHero, type MapState, type MapToken,
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

describe("vision cones and fog of war", () => {
  const hero = (over: Partial<MapToken> = {}): MapToken => ({ id: "h", kind: "hero", label: "Lia", characterId: aliceHero, x: 5, y: 5, size: 1, ...over });

  it("validates turning, vision and map settings", () => {
    expect(parseMapOp({ type: "face", tokenId: "abc", facing: 3 })).toEqual({ type: "face", tokenId: "abc", facing: 3 });
    expect(parseMapOp({ type: "face", tokenId: "abc", facing: 8 })).toBeNull();
    expect(parseMapOp({ type: "update", tokenId: "abc", vision: { range: 12, angle: 120 } })).toEqual({ type: "update", tokenId: "abc", vision: { range: 12, angle: 120 } });
    expect(parseMapOp({ type: "update", tokenId: "abc", vision: { range: 12, angle: 45 } })).toBeNull();
    expect(parseMapOp({ type: "update", tokenId: "abc", vision: { range: 99, angle: 90 } })).toBeNull();
    expect(parseMapOp({ type: "settings", fog: true })).toEqual({ type: "settings", fog: true });
    expect(parseMapOp({ type: "settings" })).toBeNull();
    expect(parseMapOp({ type: "settings", gridHidden: "yes" })).toBeNull();
  });

  it("lets players turn their own hero and only the DM change vision or settings", () => {
    const state = withParty();
    const lia = state.tokens.find((token) => token.characterId === aliceHero)!;
    const brom = state.tokens.find((token) => token.characterId === bobHero)!;
    const turned = applyMapOps(state, [{ type: "face", tokenId: lia.id, facing: 2 }], alice, heroes, ids());
    expect(turned.ok && turned.state.tokens.find((token) => token.id === lia.id)?.facing).toBe(2);
    expect(applyMapOps(state, [{ type: "face", tokenId: brom.id, facing: 2 }], alice, heroes, ids())).toEqual({ ok: false, error: "forbidden" });
    expect(applyMapOps(state, [{ type: "update", tokenId: lia.id, vision: { range: 24, angle: 360 } }], alice, heroes, ids())).toEqual({ ok: false, error: "forbidden" });
    expect(applyMapOps(state, [{ type: "settings", fog: true }], alice, heroes, ids())).toEqual({ ok: false, error: "forbidden" });
    const set = applyMapOps(state, [{ type: "update", tokenId: lia.id, vision: { range: 24, angle: 360 } }, { type: "settings", fog: true, gridHidden: true }], dm, heroes, ids());
    expect(set.ok && set.state.fog).toBe(true);
    expect(set.ok && set.state.gridHidden).toBe(true);
    expect(set.ok && set.state.tokens.find((token) => token.id === lia.id)?.vision).toEqual({ range: 24, angle: 360 });
    const back = set.ok ? applyMapOps(set.state, [{ type: "settings", fog: false }, { type: "resize", cols: 10, rows: 10 }], dm, heroes, ids()) : null;
    expect(back?.ok && back.state.fog).toBeUndefined();
    expect(back?.ok && back.state.gridHidden).toBe(true);
  });

  it("gives heroes a default cone and monsters none", () => {
    expect(tokenVision(hero())).toEqual({ range: 12, angle: 90 });
    expect(tokenVision(hero({ vision: { range: 0, angle: 90 } }))).toBeNull();
    expect(tokenVision({ id: "m", kind: "monster", label: "Rat", x: 0, y: 0, size: 1 })).toBeNull();
  });

  it("sees squares inside the cone in the direction the token faces", () => {
    const north = tokenSight(hero({ vision: { range: 3, angle: 90 } }), 20, 20);
    expect(north.has("5,5")).toBe(true); // its own square
    expect(north.has("5,2")).toBe(true); // three squares straight ahead
    expect(north.has("5,1")).toBe(false); // out of range
    expect(north.has("5,6")).toBe(false); // behind
    expect(north.has("8,5")).toBe(false); // to the side
    const east = tokenSight(hero({ facing: 2, vision: { range: 3, angle: 90 } }), 20, 20);
    expect(east.has("8,5")).toBe(true);
    expect(east.has("5,2")).toBe(false);
    const around = tokenSight(hero({ vision: { range: 2, angle: 360 } }), 20, 20);
    expect(around.has("5,7") && around.has("3,5") && around.has("7,5")).toBe(true);
    // Never outside the grid.
    expect([...tokenSight(hero({ x: 0, y: 0, vision: { range: 5, angle: 360 } }), 4, 4)].every((cell) => cell.split(",").every((n) => Number(n) >= 0 && Number(n) < 4))).toBe(true);
  });

  it("keeps monsters out of the heroes' sight away from players when the fog is on", () => {
    const state: MapState = {
      cols: 20, rows: 20, fog: true,
      tokens: [
        hero({ vision: { range: 4, angle: 90 } }),
        { id: "seen", kind: "monster", label: "Goblin", x: 5, y: 2, size: 1 },
        { id: "behind", kind: "monster", label: "Goblin", x: 5, y: 9, size: 1 },
        { id: "big", kind: "monster", label: "Ogre", x: 6, y: 0, size: 2 }, // only its lower-left square is in sight
      ],
    };
    expect(partySight(state).has("6,1")).toBe(true);
    expect(visibleMapState(state, false).tokens.map((token) => token.id)).toEqual(["h", "seen", "big"]);
    expect(visibleMapState(state, true).tokens).toHaveLength(4);
    expect(visibleMapState({ ...state, fog: false }, false).tokens).toHaveLength(4);
  });

  it("stores facing, vision, fog and background, dropping malformed values", () => {
    const state = normalizeMapState({
      cols: 10, rows: 10, fog: true, gridHidden: true, background: { key: "abc_123" },
      tokens: [
        { id: "a", kind: "monster", label: "Rat", x: 0, y: 0, size: 1, facing: 3, vision: { range: 6, angle: 180 } },
        { id: "b", kind: "monster", label: "Rat", x: 1, y: 0, size: 1, facing: 9, vision: { range: 6, angle: 33 } },
      ],
    });
    expect(state).toMatchObject({ fog: true, gridHidden: true, background: { key: "abc_123" } });
    expect(state.tokens[0]).toMatchObject({ facing: 3, vision: { range: 6, angle: 180 } });
    expect(state.tokens[1].facing).toBeUndefined();
    expect(state.tokens[1].vision).toBeUndefined();
    expect(normalizeMapState({ background: { key: "../etc" } }).background).toBeUndefined();
  });
});

describe("background pictures", () => {
  it("recognises pictures by their bytes", () => {
    expect(sniffImageType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]))).toBe("image/png");
    expect(sniffImageType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
    expect(sniffImageType(new TextEncoder().encode("GIF89a"))).toBe("image/gif");
    expect(sniffImageType(new TextEncoder().encode("RIFF\0\0\0\0WEBPVP8 "))).toBe("image/webp");
    expect(sniffImageType(new TextEncoder().encode("<svg onload=alert(1)>"))).toBeNull();
    expect(sniffImageType(new Uint8Array())).toBeNull();
  });

  it("suggests rows that keep the picture's proportions", () => {
    expect(rowsForImage(20, 2000, 1400)).toBe(14);
    expect(rowsForImage(20, 100, 1000)).toBe(40);
    expect(rowsForImage(20, 1000, 10)).toBe(4);
    expect(rowsForImage(20, 0, 0)).toBe(14);
  });
});

describe("walls and doors", () => {
  const lia = (x: number, y: number, over: Partial<MapToken> = {}): MapToken => ({ id: "h", kind: "hero", label: "Lia", characterId: aliceHero, x, y, size: 1, ...over });
  // A room: wall along x = 5 from the top to y = 6, with a door from y = 2 to y = 3.
  const room = (door: "open" | "closed" = "closed"): MapState => ({
    cols: 10, rows: 8,
    tokens: [lia(3, 2, { facing: 2, vision: { range: 8, angle: 180 } })],
    walls: [{ x1: 5, y1: 0, x2: 5, y2: 2 }, { x1: 5, y1: 2, x2: 5, y2: 3, door }, { x1: 5, y1: 3, x2: 5, y2: 6 }],
  });

  it("accepts only straight walls along grid lines", () => {
    expect(parseWall({ x1: 3, y1: 4, x2: 3, y2: 1 })).toEqual({ x1: 3, y1: 1, x2: 3, y2: 4 });
    expect(parseWall({ x1: 0, y1: 0, x2: 2, y2: 0, door: "open" })).toEqual({ x1: 0, y1: 0, x2: 2, y2: 0, door: "open" });
    expect(parseWall({ x1: 0, y1: 0, x2: 2, y2: 2 })).toBeNull();
    expect(parseWall({ x1: 1, y1: 1, x2: 1, y2: 1 })).toBeNull();
    expect(parseWall({ x1: 0, y1: 0, x2: 0, y2: 2, door: "ajar" })).toBeNull();
    expect(parseMapOp({ type: "add-walls", walls: [{ x1: 0, y1: 0, x2: 0, y2: 2 }] })).toEqual({ type: "add-walls", walls: [{ x1: 0, y1: 0, x2: 0, y2: 2 }] });
    expect(parseMapOp({ type: "add-walls", walls: [] })).toBeNull();
    expect(parseMapOp({ type: "door", x1: 5, y1: 3, x2: 5, y2: 2, open: true })).toEqual({ type: "door", x1: 5, y1: 2, x2: 5, y2: 3, open: true });
  });

  it("blocks sight lines through walls and closed doors only", () => {
    const blocked = blockingEdges(room().walls);
    expect(blocked.has("v:5,0") && blocked.has("v:5,2") && blocked.has("v:5,5")).toBe(true);
    expect(blockingEdges(room("open").walls).has("v:5,2")).toBe(false);
    expect(lineIsClear(3.5, 2.5, 7.5, 2.5, blocked)).toBe(false);
    expect(lineIsClear(3.5, 2.5, 4.5, 7.5, blocked)).toBe(true);
    expect(lineIsClear(3.5, 6.5, 7.5, 6.5, blocked)).toBe(true); // below the end of the wall
  });

  it("cuts vision behind walls and lets it through an open door", () => {
    const closed = room();
    const sight = partySight(closed);
    expect(sight.has("4,2")).toBe(true);
    expect(sight.has("6,2")).toBe(false);
    expect(sight.has("5,7")).toBe(true); // around the end of the wall
    expect(sight.has("7,7")).toBe(false); // the wall is still in the way
    const open = partySight(room("open"));
    expect(open.has("6,2") && open.has("9,2")).toBe(true);
    expect(open.has("7,3")).toBe(true); // through the doorway at an angle
    expect(open.has("6,0")).toBe(false); // but not past the wall beside it
  });

  it("keeps players from walking through walls but lets them go around", () => {
    const state = room();
    const token = state.tokens[0];
    expect(canReach(state, token, 6, 2)).toBe(true); // around the bottom of the wall
    const sealed: MapState = { ...state, walls: [...state.walls!, { x1: 5, y1: 6, x2: 5, y2: 8 }] };
    expect(canReach(sealed, token, 6, 2)).toBe(false);
    expect(canReach({ ...sealed, walls: sealed.walls!.map((wall) => wall.door ? { ...wall, door: "open" as const } : wall) }, token, 6, 2)).toBe(true);
    // No squeezing diagonally past the end of a wall.
    const corner: MapState = { cols: 4, rows: 4, tokens: [], walls: [{ x1: 0, y1: 1, x2: 1, y2: 1 }, { x1: 1, y1: 0, x2: 1, y2: 1 }] };
    expect(canReach(corner, lia(0, 0), 1, 1)).toBe(false);

    const withHero = applyMapOps(emptyMapState(), [{ type: "resize", cols: 10, rows: 8 }, { type: "place-hero", characterId: aliceHero, x: 3, y: 2 }, { type: "add-walls", walls: sealed.walls! }], dm, heroes, ids());
    if (!withHero.ok) throw new Error(withHero.error);
    const id = withHero.state.tokens[0].id;
    expect(applyMapOps(withHero.state, [{ type: "move", tokenId: id, x: 6, y: 2 }], alice, heroes, ids())).toEqual({ ok: false, error: "blocked" });
    expect(applyMapOps(withHero.state, [{ type: "move", tokenId: id, x: 2, y: 5 }], alice, heroes, ids()).ok).toBe(true);
    expect(applyMapOps(withHero.state, [{ type: "move", tokenId: id, x: 6, y: 2 }], dm, heroes, ids()).ok).toBe(true); // the DM isn't held back
  });

  it("lets a player open a door only with their hero next to it", () => {
    const placed = applyMapOps(emptyMapState(), [
      { type: "resize", cols: 10, rows: 8 },
      { type: "place-hero", characterId: aliceHero, x: 4, y: 2 },
      { type: "place-hero", characterId: bobHero, x: 0, y: 7 },
      { type: "add-walls", walls: room().walls! },
    ], dm, heroes, ids());
    if (!placed.ok) throw new Error(placed.error);
    const open = { type: "door" as const, x1: 5, y1: 2, x2: 5, y2: 3, open: true };
    const opened = applyMapOps(placed.state, [open], alice, heroes, ids());
    expect(opened.ok && opened.state.walls?.find((wall) => wall.door)?.door).toBe("open");
    const bob = { userId: "bob", isDm: false };
    expect(applyMapOps(placed.state, [open], bob, heroes, ids())).toEqual({ ok: false, error: "forbidden" });
    expect(applyMapOps(placed.state, [{ ...open, y1: 0, y2: 2 }], dm, heroes, ids())).toEqual({ ok: false, error: "invalid" }); // a wall, not a door
    expect(applyMapOps(placed.state, [{ type: "add-walls", walls: [{ x1: 0, y1: 0, x2: 1, y2: 0 }] }], alice, heroes, ids())).toEqual({ ok: false, error: "forbidden" });
    expect(nearDoor({ x: 6, y: 1, size: 1 }, { x1: 5, y1: 2, x2: 5, y2: 3 })).toBe(true);
    expect(nearDoor({ x: 5, y: 2, size: 1 }, { x1: 5, y1: 2, x2: 5, y2: 3 })).toBe(true); // right next to it
    expect(nearDoor({ x: 6, y: 2, size: 1 }, { x1: 5, y1: 2, x2: 5, y2: 3 })).toBe(true); // one square away
    expect(nearDoor({ x: 7, y: 2, size: 1 }, { x1: 5, y1: 2, x2: 5, y2: 3 })).toBe(false);
  });

  it("draws a door over a wall, removes walls and drops them when the grid shrinks", () => {
    const start = applyMapOps(emptyMapState(), [{ type: "add-walls", walls: [{ x1: 2, y1: 0, x2: 2, y2: 4 }, { x1: 15, y1: 1, x2: 15, y2: 3 }] }], dm, heroes, ids());
    if (!start.ok) throw new Error(start.error);
    const door = applyMapOps(start.state, [{ type: "add-walls", walls: [{ x1: 2, y1: 0, x2: 2, y2: 4, door: "closed" }] }], dm, heroes, ids());
    expect(door.ok && door.state.walls).toEqual([{ x1: 2, y1: 0, x2: 2, y2: 4, door: "closed" }, { x1: 15, y1: 1, x2: 15, y2: 3 }]);
    const removed = applyMapOps(start.state, [{ type: "remove-wall", x1: 2, y1: 0, x2: 2, y2: 4 }], dm, heroes, ids());
    expect(removed.ok && removed.state.walls).toEqual([{ x1: 15, y1: 1, x2: 15, y2: 3 }]);
    const shrunk = applyMapOps(start.state, [{ type: "resize", cols: 10, rows: 3 }], dm, heroes, ids());
    expect(shrunk.ok && shrunk.state.walls).toEqual([{ x1: 2, y1: 0, x2: 2, y2: 3 }]);
    const cleared = applyMapOps(start.state, [{ type: "clear-walls" }], dm, heroes, ids());
    expect(cleared.ok && cleared.state.walls).toBeUndefined();
  });

  it("remembers what the party explored and only tells players about walls they've seen", () => {
    const placed = applyMapOps(emptyMapState(), [
      { type: "resize", cols: 10, rows: 8 },
      { type: "place-hero", characterId: aliceHero, x: 3, y: 2 },
      { type: "add-walls", walls: [...room().walls!, { x1: 5, y1: 6, x2: 5, y2: 8 }, { x1: 8, y1: 0, x2: 8, y2: 8 }] },
      { type: "settings", fog: true },
    ], dm, heroes, ids());
    if (!placed.ok) throw new Error(placed.error);
    const id = placed.state.tokens[0].id;
    const facingEast = applyMapOps(placed.state, [{ type: "face", tokenId: id, facing: 2 }], alice, heroes, ids());
    if (!facingEast.ok) throw new Error(facingEast.error);
    expect(exploredCells(placed.state).has("3,0")).toBe(true); // straight ahead (north)
    expect(exploredCells(placed.state).has("3,7")).toBe(false);
    const moved = applyMapOps(placed.state, [{ type: "move", tokenId: id, x: 3, y: 6 }, { type: "face", tokenId: id, facing: 4 }], alice, heroes, ids());
    if (!moved.ok) throw new Error(moved.error);
    const memory = exploredCells(moved.state);
    expect(memory.has("3,0") && memory.has("3,7")).toBe(true); // what it saw before is kept
    // The wall at x = 8, behind the closed room, never reaches the players.
    const players = visibleMapState(facingEast.state, false);
    expect(players.walls?.some((wall) => wall.x1 === 8)).toBe(false);
    expect(players.walls?.some((wall) => wall.door)).toBe(true);
    expect(visibleMapState(facingEast.state, true).walls).toHaveLength(5);
    // Players get the party's sight worked out with every wall; the DM's copy doesn't need it.
    expect(currentSight(players)).toEqual(partySight(facingEast.state));
    expect(visibleMapState(facingEast.state, true).sight).toBeUndefined();
    expect(normalizeMapState(players).sight).toBeUndefined();
    const forgotten = applyMapOps(moved.state, [{ type: "settings", resetExplored: true }], dm, heroes, ids());
    expect(forgotten.ok && exploredCells(forgotten.state).has("3,0")).toBe(false);
    const fogOff = applyMapOps(moved.state, [{ type: "settings", fog: false }], dm, heroes, ids());
    expect(fogOff.ok && fogOff.state.explored).toBeUndefined();
  });

  it("stores walls and the explored map, dropping malformed ones", () => {
    const state = normalizeMapState({
      cols: 4, rows: 4, explored: "f000",
      walls: [{ x1: 1, y1: 0, x2: 1, y2: 9 }, { x1: 9, y1: 0, x2: 9, y2: 2 }, { x1: 0, y1: 0, x2: 2, y2: 2 }],
    });
    expect(state.walls).toEqual([{ x1: 1, y1: 0, x2: 1, y2: 4 }]);
    expect([...exploredCells(state)]).toEqual(["0,0", "1,0", "2,0", "3,0"]);
    expect(normalizeMapState({ cols: 4, rows: 4, explored: "zz" }).explored).toBeUndefined();
  });
});
