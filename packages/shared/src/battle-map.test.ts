import { describe, expect, it } from "vitest";
import {
  applyMapOps, blockingEdges, canReach, columnName, currentSight, exploredCells, lineIsClear, nearDoor, parseWall, emptyMapState, findFreeSpot, normalizeMapState, parseMapOp, parseMapOps, partySight, rowsForImage, sniffImageType,
  squareName, syncHeroes, tokenSight, tokenVision, visibleMapState, combatantOf, pathLength, isMonsterSlug, tokenSizeFor, viewMap,
  type MapHero, type MapOp, type MapState, type MapToken,
} from "./battle-map.js";

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

describe("the map as one viewer receives it", () => {
  const stored = () => ({ state: JSON.parse(JSON.stringify(withParty())), version: 7, updatedAt: new Date("2026-11-20T18:30:00.000Z") });

  it("shows a DM everything, unless they asked for the players' view", () => {
    const view = viewMap(stored(), heroes, { ...dm, audience: "auto" });
    expect(view).toMatchObject({ version: 7, isDm: true, showsHidden: true, updatedAt: "2026-11-20T18:30:00.000Z" });
    expect(view.state.tokens).toHaveLength(5);
    const table = viewMap(stored(), heroes, { ...dm, audience: "players" });
    expect(table).toMatchObject({ isDm: true, showsHidden: false });
    expect(table.state.tokens.map((token) => token.label)).toEqual(["Lia", "Brom", "Goblin 1", "Goblin 2"]);
  });

  it("never shows a player hidden monsters, whatever they ask for", () => {
    const view = viewMap(stored(), heroes, { ...alice, audience: "auto" });
    expect(view).toMatchObject({ isDm: false, showsHidden: false });
    expect(view.state.tokens.some((token) => token.hidden)).toBe(false);
  });

  it("marks the viewer's own heroes and keeps hero tokens in step with the campaign", () => {
    const remaining = [{ ...heroes[0], name: "Lia the Bold" }];
    const view = viewMap(stored(), remaining, { ...alice, audience: "auto" });
    expect(view.heroes).toEqual([{ id: aliceHero, name: "Lia the Bold", ownerId: "alice", mine: true }]);
    expect(view.state.tokens.filter((token) => token.kind === "hero").map((token) => token.label)).toEqual(["Lia the Bold"]);
    expect(viewMap(stored(), heroes, { ...dm, audience: "auto" }).heroes.map((hero) => hero.mine)).toEqual([false, false]);
  });

  it("serves an empty map at version 0 to a campaign that has none yet", () => {
    expect(viewMap(undefined, heroes, { ...dm, audience: "auto" })).toEqual({
      version: 0, isDm: true, showsHidden: true, heroes: heroes.map((hero) => ({ ...hero, mine: false })),
      state: emptyMapState(), updatedAt: "1970-01-01T00:00:00.000Z",
    });
  });

  it("reads damaged stored state as a valid map", () => {
    expect(viewMap({ state: "junk", version: 3, updatedAt: new Date(0) }, [], { ...dm, audience: "auto" }).state).toEqual(emptyMapState());
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
    // A player gets the same answer for no door as for a door out of reach, so the fog can't be probed.
    expect(applyMapOps(placed.state, [{ ...open, x1: 9, x2: 9 }], bob, heroes, ids())).toEqual({ ok: false, error: "forbidden" });
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

describe("combat", () => {
  /** Lia t1 at B2, Brom t2, Goblin 1 t3, Goblin 2 t4, the hidden Ogre t5; Lia walks 6 squares a turn. */
  function inCombat(): MapState {
    const result = applyMapOps(withParty(), [{ type: "combat-start", entries: [
      { tokenId: "t3", initiative: 12, speed: 6 }, { tokenId: "t1", initiative: 18, speed: 6 }, { tokenId: "t2", initiative: 7 },
      { tokenId: "t5", initiative: 12, speed: 8 }, { tokenId: "t4", initiative: 12, speed: 6 },
    ] }], dm, heroes, ids());
    if (!result.ok) throw new Error(result.error);
    return result.state;
  }
  const apply = (state: MapState, ops: MapOp[], actor = dm) => applyMapOps(state, ops, actor, heroes, ids());
  const ok = (result: ReturnType<typeof applyMapOps>) => { if (!result.ok) throw new Error(result.error); return result.state; };

  it("validates combat changes", () => {
    expect(parseMapOp({ type: "combat-start", entries: [{ tokenId: "a", initiative: 15, speed: 6 }] })).toEqual({ type: "combat-start", entries: [{ tokenId: "a", initiative: 15, speed: 6 }] });
    expect(parseMapOp({ type: "combat-start", entries: [{ tokenId: "a", initiative: 15 }, { tokenId: "a", initiative: 3 }] })).toBeNull();
    expect(parseMapOp({ type: "combat-start", entries: [{ tokenId: "a", initiative: 100 }] })).toBeNull();
    expect(parseMapOp({ type: "combat-start", entries: [{ tokenId: "a", initiative: 1, speed: 41 }] })).toBeNull();
    expect(parseMapOp({ type: "combatant", tokenId: "a", speed: null })).toEqual({ type: "combatant", tokenId: "a", speed: null });
    expect(parseMapOp({ type: "combatant", tokenId: "a" })).toBeNull();
    expect(parseMapOp({ type: "turn", step: 1 })).toEqual({ type: "turn", step: 1 });
    expect(parseMapOp({ type: "turn", step: 2 })).toBeNull();
    expect(parseMapOp({ type: "turn", step: 1, tokenId: "a" })).toBeNull();
    expect(parseMapOp({ type: "dash", tokenId: "a", dash: "yes" })).toBeNull();
    expect(parseMapOp({ type: "update", tokenId: "a", monsterSlug: "goblin" })).toEqual({ type: "update", tokenId: "a", monsterSlug: "goblin" });
    expect(parseMapOp({ type: "update", tokenId: "a", monsterSlug: "Not a slug" })).toBeNull();
  });

  it("links monsters to the keys the bestiary really uses", () => {
    for (const slug of ["srd_goblin", "srd-2024_goblin", "a5e-mm_bandit", "homebrew:3f2b8c1e-9d4a-4b6f-8e2a-1c5d7f9a0b3e"]) {
      expect(isMonsterSlug(slug)).toBe(true);
      expect(parseMapOp({ type: "add-monster", label: "X", count: 1, size: 1, hidden: false, monsterSlug: slug })).toMatchObject({ monsterSlug: slug });
    }
    for (const slug of ["", "_goblin", "homebrew:nope", "a/b", "x".repeat(101)]) expect(isMonsterSlug(slug)).toBe(false);
  });

  it("sizes tokens from the stat block", () => {
    expect([tokenSizeFor("Tiny"), tokenSizeFor("Medium"), tokenSizeFor("Large"), tokenSizeFor("huge"), tokenSizeFor("Gargantuan"), tokenSizeFor(undefined)]).toEqual([1, 1, 2, 3, 4, 1]);
  });

  it("sorts by initiative, keeps ties in order and starts with the highest", () => {
    const state = inCombat();
    expect(state.combat).toMatchObject({ round: 1, active: "t1" });
    expect(state.combat!.order.map((entry) => entry.tokenId)).toEqual(["t1", "t3", "t5", "t4", "t2"]);
    expect(apply(withParty(), [{ type: "combat-start", entries: [{ tokenId: "nope", initiative: 3 }] }])).toEqual({ ok: false, error: "invalid" });
    expect(apply(withParty(), [{ type: "combat-start", entries: [] }], alice)).toEqual({ ok: false, error: "forbidden" });
  });

  it("counts movement round walls and stops players past their speed or out of turn", () => {
    const state = inCombat();
    const walked = ok(apply(state, [{ type: "move", tokenId: "t1", x: 4, y: 3 }], alice)); // 3 squares, diagonals count as one
    expect(combatantOf(walked, "t1")).toMatchObject({ moved: 3 });
    expect(apply(walked, [{ type: "move", tokenId: "t1", x: 8, y: 3 }], alice)).toEqual({ ok: false, error: "movement" });
    const dashed = ok(apply(walked, [{ type: "dash", tokenId: "t1", dash: true }], alice));
    expect(combatantOf(ok(apply(dashed, [{ type: "move", tokenId: "t1", x: 8, y: 3 }], alice)), "t1")).toMatchObject({ moved: 7, dash: true });
    // Bob's Brom isn't up yet; the DM moves anyone, and it still counts.
    const bob = { userId: "bob", isDm: false };
    expect(apply(state, [{ type: "move", tokenId: "t2", x: 2, y: 2 }], bob)).toEqual({ ok: false, error: "turn" });
    expect(combatantOf(ok(apply(walked, [{ type: "move", tokenId: "t1", x: 12, y: 3 }])), "t1")).toMatchObject({ moved: 11 });
    // A wall from x = 3 down to y = 4: going round it (without cutting its end) takes 7 squares, not 3.
    const walled = { ...state, walls: [{ x1: 3, y1: 0, x2: 3, y2: 4 }] };
    expect(pathLength(walled, state.tokens[0], 4, 1)).toBe(7);
    expect(apply(walled, [{ type: "move", tokenId: "t1", x: 4, y: 1 }], alice)).toEqual({ ok: false, error: "movement" });
    expect(combatantOf(ok(apply(walled, [{ type: "move", tokenId: "t1", x: 4, y: 1 }])), "t1")).toMatchObject({ moved: 7 });
  });

  it("passes turns, skips defeated monsters, wraps rounds and resets movement", () => {
    let state = ok(apply(inCombat(), [{ type: "move", tokenId: "t1", x: 3, y: 1 }], alice));
    state = ok(apply(state, [{ type: "update", tokenId: "t3", defeated: true }]));
    // Alice ends Lia's turn; the defeated goblin is skipped.
    state = ok(apply(state, [{ type: "turn", step: 1 }], alice));
    expect(state.combat!.active).toBe("t5");
    expect(apply(state, [{ type: "turn", step: 1 }], alice)).toEqual({ ok: false, error: "forbidden" });
    state = ok(apply(state, [{ type: "turn", step: 1 }, { type: "turn", step: 1 }]));
    expect(state.combat).toMatchObject({ round: 1, active: "t2" });
    state = ok(apply(state, [{ type: "turn", step: 1 }]));
    expect(state.combat).toMatchObject({ round: 2, active: "t1" });
    expect(combatantOf(state, "t1")?.moved).toBeUndefined();
    state = ok(apply(state, [{ type: "turn", step: -1 }]));
    expect(state.combat).toMatchObject({ round: 1, active: "t2" });
    expect(apply(state, [{ type: "turn", step: -1 }], alice)).toEqual({ ok: false, error: "forbidden" });
    expect(ok(apply(state, [{ type: "turn", tokenId: "t4" }])).combat).toMatchObject({ round: 1, active: "t4" });
  });

  it("adds, changes and drops combatants, and hands the turn on when the active one leaves", () => {
    let state = ok(apply(inCombat(), [{ type: "combatant", tokenId: "t2", initiative: 20, speed: 5 }]));
    expect(state.combat!.order.map((entry) => entry.tokenId)).toEqual(["t2", "t1", "t3", "t5", "t4"]);
    expect(combatantOf(state, "t2")).toEqual({ tokenId: "t2", initiative: 20, speed: 5 });
    state = ok(apply(state, [{ type: "combatant", tokenId: "t2", speed: null, moved: 4 }]));
    expect(combatantOf(state, "t2")).toEqual({ tokenId: "t2", initiative: 20, moved: 4 });
    state = ok(apply(state, [{ type: "remove", tokenId: "t1" }]));
    expect(state.combat).toMatchObject({ active: "t3" });
    state = ok(apply(state, [{ type: "combat-leave", tokenId: "t3" }, { type: "clear-monsters" }]));
    expect(state.combat).toMatchObject({ round: 2, active: "t2", order: [{ tokenId: "t2" }] });
    expect(apply(state, [{ type: "combatant", tokenId: "t2", initiative: 3 }], alice)).toEqual({ ok: false, error: "forbidden" });
    expect(ok(apply(state, [{ type: "combat-end" }])).combat).toBeUndefined();
  });

  it("shows players only the creatures they can see, without monster speeds", () => {
    let state = inCombat();
    state = ok(apply(state, [{ type: "turn", tokenId: "t5" }]));
    const players = visibleMapState(state, false);
    expect(players.combat!.order.map((entry) => entry.tokenId)).toEqual(["t1", "t3", "t4", "t2"]);
    expect(players.combat!.order[1]).toEqual({ tokenId: "t3", initiative: 12 });
    expect(players.combat!.order[0]).toMatchObject({ speed: 6 });
    expect(players.combat!.active).toBeUndefined(); // the hidden ogre's turn
    expect(visibleMapState(state, true).combat).toEqual(state.combat);
  });

  it("stores a fight defensively", () => {
    const state = normalizeMapState({ ...inCombat(), combat: { round: 0, active: "gone", order: [
      { tokenId: "t1", initiative: 18, moved: 2, dash: true }, { tokenId: "t1", initiative: 3 }, { tokenId: "gone", initiative: 9 }, { tokenId: "t2", initiative: "x" }, { tokenId: "t3", initiative: 20 },
    ] } });
    expect(state.combat).toEqual({ round: 1, order: [{ tokenId: "t3", initiative: 20 }, { tokenId: "t1", initiative: 18, moved: 2, dash: true }] });
    expect(syncHeroes(inCombat(), [heroes[1]]).combat).toMatchObject({ active: "t3" });
  });
});

describe("parseMapOp, change by change", () => {
  const wall = { x1: 2, y1: 5, x2: 2, y2: 1 };

  it("accepts each kind of change and returns it cleaned up", () => {
    const accepted: [unknown, MapOp][] = [
      [{ type: "move", tokenId: "a", x: 0, y: 39 }, { type: "move", tokenId: "a", x: 0, y: 39 }],
      [{ type: "place-hero", characterId: aliceHero, x: 3, y: 4 }, { type: "place-hero", characterId: aliceHero, x: 3, y: 4 }],
      [{ type: "place-hero", characterId: aliceHero, x: 0, y: 0 }, { type: "place-hero", characterId: aliceHero, x: 0, y: 0 }],
      [{ type: "add-walls", walls: Array.from({ length: 50 }, () => ({ x1: 0, y1: 0, x2: 0, y2: 1 })) }, { type: "add-walls", walls: Array.from({ length: 50 }, () => ({ x1: 0, y1: 0, x2: 0, y2: 1 })) }],
      [{ type: "combat-start", entries: Array.from({ length: 120 }, (_, i) => ({ tokenId: `t${i}`, initiative: 1 })) }, { type: "combat-start", entries: Array.from({ length: 120 }, (_, i) => ({ tokenId: `t${i}`, initiative: 1 })) }],
      [{ type: "add-monster", label: "Goblin", count: 1, size: 2, hidden: true, monsterSlug: "srd_goblin" }, { type: "add-monster", label: "Goblin", count: 1, size: 2, hidden: true, monsterSlug: "srd_goblin" }],
      [{ type: "update", tokenId: "a", label: " Boss  goblin ", hidden: true, defeated: false, size: 4 }, { type: "update", tokenId: "a", label: "Boss goblin", hidden: true, defeated: false, size: 4 }],
      [{ type: "settings", gridHidden: false, resetExplored: true }, { type: "settings", gridHidden: false, resetExplored: true }],
      [{ type: "remove-wall", ...wall, door: "closed" }, { type: "remove-wall", x1: 2, y1: 1, x2: 2, y2: 5 }],
      [{ type: "door", ...wall, open: false }, { type: "door", x1: 2, y1: 1, x2: 2, y2: 5, open: false }],
      [{ type: "clear-walls", extra: 1 }, { type: "clear-walls" }],
      [{ type: "remove", tokenId: "a" }, { type: "remove", tokenId: "a" }],
      [{ type: "clear-monsters" }, { type: "clear-monsters" }],
      [{ type: "resize", cols: 4, rows: 40 }, { type: "resize", cols: 4, rows: 40 }],
      [{ type: "combat-start", entries: [] }, { type: "combat-start", entries: [] }],
      [{ type: "combatant", tokenId: "a", initiative: -20, speed: 40, moved: 999 }, { type: "combatant", tokenId: "a", initiative: -20, speed: 40, moved: 999 }],
      [{ type: "combatant", tokenId: "a", moved: 0 }, { type: "combatant", tokenId: "a", moved: 0 }],
      [{ type: "combat-leave", tokenId: "a" }, { type: "combat-leave", tokenId: "a" }],
      [{ type: "turn", step: -1 }, { type: "turn", step: -1 }],
      [{ type: "turn", tokenId: "a" }, { type: "turn", tokenId: "a" }],
      [{ type: "dash", tokenId: "a", dash: false }, { type: "dash", tokenId: "a", dash: false }],
      [{ type: "combat-end" }, { type: "combat-end" }],
    ];
    for (const [raw, op] of accepted) expect(parseMapOp(raw), JSON.stringify(raw)).toEqual(op);
  });

  it("rejects each kind of change when a field is wrong", () => {
    const rejected: unknown[] = [
      null, "move", 3, { tokenId: "a" },
      { type: "move", tokenId: "a", x: 0, y: 40 },
      { type: "place-hero", characterId: 7 },
      { type: "place-hero", characterId: aliceHero, x: 1, y: 40 },
      { type: "add-monster", label: "Goblin", count: 1, hidden: "no" },
      { type: "add-monster", label: "Goblin", count: 1, monsterSlug: "a/b" },
      { type: "add-monster", label: "   ", count: 1 },
      { type: "add-monster", label: "Goblin", count: 0 },
      { type: "update", tokenId: "a b", hidden: true },
      { type: "update", tokenId: "a", label: "" },
      { type: "update", tokenId: "a", hidden: "yes" },
      { type: "update", tokenId: "a", defeated: 1 },
      { type: "update", tokenId: "a", size: 0 },
      { type: "update", tokenId: "a", vision: "far" },
      { type: "face", tokenId: "a" },
      { type: "settings", fog: "on" },
      { type: "settings", resetExplored: false },
      { type: "add-walls", walls: "wall" },
      { type: "add-walls", walls: Array.from({ length: 51 }, () => wall) },
      { type: "add-walls", walls: [wall, { x1: 0, y1: 0, x2: 1, y2: 1 }] },
      { type: "remove-wall", x1: 0, y1: 0, x2: 1, y2: 1 },
      { type: "remove-wall", x1: 0, y1: 0, x2: 0 },
      { type: "door", x1: 0, y1: 0, x2: 1, y2: 1, open: true },
      { type: "door", ...wall },
      { type: "door", ...wall, open: "yes" },
      { type: "remove", tokenId: "" },
      { type: "remove" },
      { type: "resize", cols: 10, rows: 41 },
      { type: "resize", cols: 10 },
      { type: "combat-start" },
      { type: "combat-start", entries: Array.from({ length: 121 }, (_, i) => ({ tokenId: `t${i}`, initiative: 1 })) },
      { type: "combat-start", entries: [null] },
      { type: "combat-start", entries: [{ tokenId: "a", initiative: 1.5 }] },
      { type: "combatant", tokenId: "a b", initiative: 1 },
      { type: "combatant", tokenId: "a", initiative: 100 },
      { type: "combatant", tokenId: "a", initiative: "high" },
      { type: "combatant", tokenId: "a", speed: 41 },
      { type: "combatant", tokenId: "a", speed: -1 },
      { type: "combatant", tokenId: "a", moved: 1000 },
      { type: "combatant", tokenId: "a", moved: -1 },
      { type: "combat-leave", tokenId: "a b" },
      { type: "combat-leave" },
      { type: "turn" },
      { type: "turn", tokenId: "a b" },
      { type: "turn", step: 0 },
      { type: "dash", tokenId: "a b", dash: true },
      { type: "dash", tokenId: "a" },
      { type: "toString" }, { type: "constructor" }, { type: "__proto__" }, { type: "hasOwnProperty" },
    ];
    for (const raw of rejected) expect(parseMapOp(raw), JSON.stringify(raw)).toBeNull();
  });
});

describe("applyMapOps, change by change", () => {
  const bob = { userId: "bob", isDm: false };
  const apply = (state: MapState, ops: MapOp[], actor = dm, party = heroes) => applyMapOps(state, ops, actor, party, ids());
  const ok = (result: ReturnType<typeof applyMapOps>) => { if (!result.ok) throw new Error(result.error); return result.state; };
  const monsters = (count: number): MapToken[] => Array.from({ length: count }, (_, i) => ({ id: `m${i}`, kind: "monster", label: `Rat ${i}`, x: i % 20, y: Math.floor(i / 20) % 14, size: 1 }));
  /** withParty() with a fight on: Lia (t1) acts first, then Brom (t2), then Goblin 1 (t3). */
  const fight = () => ok(apply(withParty(), [{ type: "combat-start", entries: [{ tokenId: "t1", initiative: 15, speed: 6 }, { tokenId: "t2", initiative: 10 }, { tokenId: "t3", initiative: 5 }] }]));

  it("leaves the starting state untouched, whether the batch is applied or rejected", () => {
    const start = withParty();
    const copy = structuredClone(start);
    ok(apply(start, [{ type: "move", tokenId: "t1", x: 9, y: 9 }, { type: "add-walls", walls: [{ x1: 0, y1: 0, x2: 0, y2: 2 }] }, { type: "settings", fog: true }]));
    expect(apply(start, [{ type: "move", tokenId: "t1", x: 9, y: 9 }, { type: "move", tokenId: "nope", x: 1, y: 1 }])).toEqual({ ok: false, error: "invalid" });
    expect(start).toEqual(copy);
  });

  it("moves tokens: unknown ones are invalid, staying put costs nothing", () => {
    const state = fight();
    expect(apply(state, [{ type: "move", tokenId: "nope", x: 1, y: 1 }])).toEqual({ ok: false, error: "invalid" });
    const stayed = ok(apply(state, [{ type: "move", tokenId: "t1", x: 1, y: 1 }], alice));
    expect(stayed).toEqual(state);
    // Bob's Brom isn't up, but asking it to stay where it is isn't a move.
    expect(ok(apply(state, [{ type: "move", tokenId: "t2", x: 2, y: 1 }], bob))).toEqual(state);
  });

  it("counts a DM's move with no path as the straight distance", () => {
    const state = fight();
    // Lia boxed in at B2 (1, 1): walls on all four sides.
    const boxed: MapState = { ...state, walls: [{ x1: 1, y1: 1, x2: 2, y2: 1 }, { x1: 1, y1: 2, x2: 2, y2: 2 }, { x1: 1, y1: 1, x2: 1, y2: 2 }, { x1: 2, y1: 1, x2: 2, y2: 2 }] };
    expect(apply(boxed, [{ type: "move", tokenId: "t1", x: 3, y: 5 }], alice)).toEqual({ ok: false, error: "blocked" });
    const moved = ok(apply(boxed, [{ type: "move", tokenId: "t1", x: 3, y: 5 }]));
    expect(moved.tokens.find((token) => token.id === "t1")).toMatchObject({ x: 3, y: 5 });
    expect(combatantOf(moved, "t1")).toMatchObject({ moved: 4 });
    expect(combatantOf(ok(apply(boxed, [{ type: "move", tokenId: "t1", x: 6, y: 2 }])), "t1")).toMatchObject({ moved: 5 });
  });

  it("lets a player use the whole speed in one go, and not a square more", () => {
    const state = fight(); // Lia (t1) at B2 walks 6 squares a turn
    expect(combatantOf(ok(apply(state, [{ type: "move", tokenId: "t1", x: 7, y: 1 }], alice)), "t1")).toMatchObject({ moved: 6 });
    expect(apply(state, [{ type: "move", tokenId: "t1", x: 8, y: 1 }], alice)).toEqual({ ok: false, error: "movement" });
  });

  it("places heroes: walks an existing one, caps the token count, falls back on a label", () => {
    expect(apply(fight(), [{ type: "place-hero", characterId: bobHero, x: 6, y: 6 }], bob)).toEqual({ ok: false, error: "turn" });
    const full: MapState = { ...emptyMapState(), tokens: monsters(120) };
    expect(apply(full, [{ type: "place-hero", characterId: aliceHero }])).toEqual({ ok: false, error: "invalid" });
    const nameless = ok(apply(emptyMapState(), [{ type: "place-hero", characterId: aliceHero, x: 2, y: 3 }], dm, [{ id: aliceHero, name: "   ", ownerId: "alice" }]));
    expect(nameless.tokens).toEqual([{ id: "t1", kind: "hero", label: "?", characterId: aliceHero, size: 1, x: 2, y: 3 }]);
    // Placed again without a square: it stays where it is.
    expect(ok(apply(nameless, [{ type: "place-hero", characterId: aliceHero }])).tokens).toEqual(nameless.tokens);
    // Without a square, the first free one scanning from the left.
    const second = ok(apply(nameless, [{ type: "place-hero", characterId: bobHero }, { type: "add-monster", label: "Rat", count: 1, size: 1, hidden: false }, { type: "place-hero", characterId: aliceHero }]));
    expect(second.tokens.find((token) => token.characterId === bobHero)).toMatchObject({ x: 0, y: 0 });
    expect(ok(apply({ ...emptyMapState(), tokens: [{ id: "m", kind: "monster", label: "Rat", x: 0, y: 0, size: 1 }] }, [{ type: "place-hero", characterId: aliceHero }])).tokens[1]).toMatchObject({ x: 0, y: 1 });
    const dmPlaced = ok(apply(emptyMapState(), [{ type: "place-hero", characterId: bobHero, x: 39, y: 39 }]));
    expect(dmPlaced.tokens[0]).toMatchObject({ label: "Brom", x: 19, y: 13 });
  });

  it("adds monsters: one keeps its name, the slug is kept, the token count is capped", () => {
    const one = ok(apply(emptyMapState(), [{ type: "add-monster", label: "Goblin", count: 1, size: 1, hidden: false, monsterSlug: "srd_goblin" }]));
    expect(one.tokens).toEqual([{ id: "t1", kind: "monster", label: "Goblin", size: 1, x: 19, y: 0, monsterSlug: "srd_goblin" }]);
    expect(apply({ ...emptyMapState(), tokens: monsters(119) }, [{ type: "add-monster", label: "Rat", count: 2, size: 1, hidden: false }])).toEqual({ ok: false, error: "invalid" });
    expect(ok(apply({ ...emptyMapState(), tokens: monsters(118) }, [{ type: "add-monster", label: "Rat", count: 2, size: 1, hidden: false }])).tokens).toHaveLength(120);
    const long = ok(apply(emptyMapState(), [{ type: "add-monster", label: "x".repeat(40), count: 2, size: 1, hidden: false }]));
    expect(long.tokens.map((token) => token.label)).toEqual([`${"x".repeat(36)} 1`, `${"x".repeat(36)} 2`]);
  });

  it("updates tokens: renames, relinks, hides and revives monsters; heroes keep name and link", () => {
    const state = withParty();
    expect(apply(state, [{ type: "update", tokenId: "nope", defeated: true }])).toEqual({ ok: false, error: "invalid" });
    const changed = ok(apply(state, [{ type: "update", tokenId: "t3", label: "Boss", monsterSlug: "srd_hobgoblin", hidden: true, defeated: true }]));
    expect(changed.tokens.find((token) => token.id === "t3")).toEqual({ id: "t3", kind: "monster", label: "Boss", x: 19, y: 0, size: 1, monsterSlug: "srd_hobgoblin", hidden: true, defeated: true });
    const revived = ok(apply(changed, [{ type: "update", tokenId: "t3", defeated: false }]));
    expect(revived.tokens.find((token) => token.id === "t3")).not.toHaveProperty("defeated");
    expect(apply(state, [{ type: "update", tokenId: "t1", label: "Lia the Bold" }])).toEqual({ ok: false, error: "invalid" });
    expect(apply(state, [{ type: "update", tokenId: "t1", monsterSlug: "srd_goblin" }])).toEqual({ ok: false, error: "invalid" });
    const downed = ok(apply(state, [{ type: "update", tokenId: "t1", defeated: true, size: 2 }]));
    expect(downed.tokens.find((token) => token.id === "t1")).toMatchObject({ defeated: true, size: 2 });
  });

  it("turns tokens: unknown ones are invalid, facing north drops the field", () => {
    const state = withParty();
    expect(apply(state, [{ type: "face", tokenId: "nope", facing: 2 }])).toEqual({ ok: false, error: "invalid" });
    const north = ok(apply(state, [{ type: "face", tokenId: "t1", facing: 2 }, { type: "face", tokenId: "t1", facing: 0 }], alice));
    expect(north.tokens.find((token) => token.id === "t1")).not.toHaveProperty("facing");
  });

  it("changes settings: the grid comes back, the fog stays on", () => {
    const hidden = ok(apply(withParty(), [{ type: "settings", gridHidden: true, fog: true }]));
    const shown = ok(apply(hidden, [{ type: "settings", gridHidden: false }]));
    expect(shown).not.toHaveProperty("gridHidden");
    expect(shown.fog).toBe(true);
    expect(shown.explored).toBe(hidden.explored);
  });

  it("adds walls only inside the grid and up to the limit", () => {
    expect(apply(emptyMapState(), [{ type: "add-walls", walls: [{ x1: 21, y1: 0, x2: 21, y2: 3 }] }])).toEqual({ ok: false, error: "invalid" });
    const full: MapState = { ...emptyMapState(), walls: Array.from({ length: 300 }, (_, i) => ({ x1: i % 20, y1: Math.floor(i / 20), x2: (i % 20) + 1, y2: Math.floor(i / 20) })) };
    expect(apply(full, [{ type: "add-walls", walls: [{ x1: 0, y1: 0, x2: 1, y2: 0, door: "closed" }] }]).ok).toBe(true); // drawn over an existing one
    expect(apply(full, [{ type: "add-walls", walls: [{ x1: 5, y1: 0, x2: 5, y2: 1 }] }])).toEqual({ ok: false, error: "invalid" });
  });

  it("removes walls, keeps the rest, and is DM-only", () => {
    const span = { x1: 2, y1: 0, x2: 2, y2: 4 };
    expect(apply(emptyMapState(), [{ type: "remove-wall", ...span }], alice)).toEqual({ ok: false, error: "forbidden" });
    const none = ok(apply(emptyMapState(), [{ type: "remove-wall", ...span }]));
    expect(none).not.toHaveProperty("walls");
    const two = ok(apply(emptyMapState(), [{ type: "add-walls", walls: [span, { x1: 0, y1: 1, x2: 3, y2: 1 }] }]));
    expect(ok(apply(two, [{ type: "remove-wall", x1: 9, y1: 9, x2: 9, y2: 10 }])).walls).toHaveLength(2);
    const last = ok(apply(two, [{ type: "remove-wall", ...span }, { type: "remove-wall", x1: 0, y1: 1, x2: 3, y2: 1 }]));
    expect(last).not.toHaveProperty("walls");
    expect(apply(two, [{ type: "clear-walls" }], alice)).toEqual({ ok: false, error: "forbidden" });
    expect(ok(apply(emptyMapState(), [{ type: "clear-walls" }]))).not.toHaveProperty("walls");
  });

  it("closes doors and keeps every other wall as it was", () => {
    const state = ok(apply(emptyMapState(), [{ type: "add-walls", walls: [{ x1: 2, y1: 0, x2: 2, y2: 1, door: "open" }, { x1: 2, y1: 1, x2: 2, y2: 2 }] }]));
    expect(ok(apply(state, [{ type: "door", x1: 2, y1: 0, x2: 2, y2: 1, open: false }])).walls).toEqual([{ x1: 2, y1: 0, x2: 2, y2: 1, door: "closed" }, { x1: 2, y1: 1, x2: 2, y2: 2 }]);
    expect(apply(emptyMapState(), [{ type: "door", x1: 2, y1: 0, x2: 2, y2: 1, open: true }])).toEqual({ ok: false, error: "invalid" });
    expect(apply(emptyMapState(), [{ type: "door", x1: 2, y1: 0, x2: 2, y2: 1, open: true }], alice)).toEqual({ ok: false, error: "forbidden" });
  });

  it("removes a token that is already gone without complaint", () => {
    const state = withParty();
    expect(ok(apply(state, [{ type: "remove", tokenId: "nope" }], alice))).toEqual(state);
    expect(apply(state, [{ type: "clear-monsters" }], alice)).toEqual({ ok: false, error: "forbidden" });
  });

  it("resizes the grid, keeping walls that still fit and redoing the explored map", () => {
    const state = ok(apply(withParty(), [{ type: "settings", fog: true }, { type: "add-walls", walls: [{ x1: 2, y1: 0, x2: 2, y2: 4 }, { x1: 15, y1: 1, x2: 15, y2: 3 }] }]));
    const smaller = ok(apply(state, [{ type: "resize", cols: 12, rows: 10 }]));
    expect(smaller).toMatchObject({ cols: 12, rows: 10, walls: [{ x1: 2, y1: 0, x2: 2, y2: 4 }] });
    expect(smaller.explored).toBeDefined(); // worked out again for the new size, after the batch
    expect(smaller.explored).not.toBe(state.explored);
    expect(ok(apply(state, [{ type: "resize", cols: 12, rows: 10 }, { type: "settings", fog: false }]))).not.toHaveProperty("explored");
    expect(ok(apply(withParty(), [{ type: "resize", cols: 30, rows: 30 }]))).not.toHaveProperty("walls");
  });

  it("starts a fight with nobody, then gives the turn to the first one added", () => {
    const empty = ok(apply(withParty(), [{ type: "combat-start", entries: [] }]));
    expect(empty.combat).toEqual({ round: 1, order: [] });
    expect(apply(empty, [{ type: "turn", step: 1 }])).toEqual({ ok: false, error: "invalid" });
    const joined = ok(apply(empty, [{ type: "combatant", tokenId: "t3", initiative: 9, speed: 6 }]));
    expect(joined.combat).toEqual({ round: 1, active: "t3", order: [{ tokenId: "t3", initiative: 9, speed: 6 }] });
  });

  it("changes combatants only in a fight, on the map, with an initiative to join", () => {
    expect(apply(withParty(), [{ type: "combatant", tokenId: "t1", initiative: 3 }])).toEqual({ ok: false, error: "invalid" });
    const state = fight();
    expect(apply(state, [{ type: "combatant", tokenId: "nope", initiative: 3 }])).toEqual({ ok: false, error: "invalid" });
    expect(apply(state, [{ type: "combatant", tokenId: "t4", speed: 6 }])).toEqual({ ok: false, error: "invalid" });
    const joined = ok(apply(state, [{ type: "combatant", tokenId: "t4", initiative: 10, moved: 3 }]));
    expect(joined.combat!.order.map((entry) => entry.tokenId)).toEqual(["t1", "t2", "t4", "t3"]);
    expect(combatantOf(joined, "t4")).toEqual({ tokenId: "t4", initiative: 10, moved: 3 });
    const reset = ok(apply(joined, [{ type: "combatant", tokenId: "t4", moved: 0, speed: 4 }]));
    expect(combatantOf(reset, "t4")).toEqual({ tokenId: "t4", initiative: 10, speed: 4 });
    // Only speed or movement: it keeps its place among equal initiatives.
    expect(reset.combat!.order.map((entry) => entry.tokenId)).toEqual(["t1", "t2", "t4", "t3"]);
    expect(ok(apply(reset, [{ type: "combatant", tokenId: "t4", initiative: 10 }])).combat!.order.map((entry) => entry.tokenId)).toEqual(["t1", "t2", "t4", "t3"]);
    expect(ok(apply(reset, [{ type: "combatant", tokenId: "t2", initiative: 10 }])).combat!.order.map((entry) => entry.tokenId)).toEqual(["t1", "t4", "t2", "t3"]);
    expect(ok(apply(reset, [{ type: "combatant", tokenId: "t2", speed: 3 }])).combat!.order.map((entry) => entry.tokenId)).toEqual(["t1", "t2", "t4", "t3"]);
  });

  it("gives the turn to the highest initiative when a stored fight has nobody active", () => {
    const stored = normalizeMapState({ ...fight(), combat: { round: 2, active: "gone", order: [{ tokenId: "t1", initiative: 15 }, { tokenId: "t2", initiative: 10 }] } });
    expect(stored.combat).not.toHaveProperty("active");
    expect(ok(apply(stored, [{ type: "combatant", tokenId: "t2", speed: 5 }])).combat).toMatchObject({ round: 2, active: "t1" });
  });

  it("never lets a player pass the turn back, even on their own hero's turn", () => {
    expect(apply(fight(), [{ type: "turn", step: -1 }], alice)).toEqual({ ok: false, error: "forbidden" });
    expect(ok(apply(fight(), [{ type: "turn", step: 1 }], alice)).combat).toMatchObject({ active: "t2" });
  });

  it("lets only the DM take creatures out of a fight or end it, and leaving no fight is harmless", () => {
    const state = fight();
    expect(apply(state, [{ type: "combat-leave", tokenId: "t1" }], alice)).toEqual({ ok: false, error: "forbidden" });
    expect(apply(state, [{ type: "combat-end" }], alice)).toEqual({ ok: false, error: "forbidden" });
    expect(ok(apply(withParty(), [{ type: "combat-leave", tokenId: "t1" }]))).toEqual(withParty());
    expect(ok(apply(state, [{ type: "combat-leave", tokenId: "t4" }]))).toEqual(state);
    expect(ok(apply(withParty(), [{ type: "combat-end" }]))).toEqual(withParty());
  });

  it("jumps the turn only for the DM and only to a creature in the fight", () => {
    expect(apply(withParty(), [{ type: "turn", tokenId: "t1" }])).toEqual({ ok: false, error: "invalid" });
    const state = fight();
    expect(apply(state, [{ type: "turn", tokenId: "t3" }], alice)).toEqual({ ok: false, error: "forbidden" });
    expect(apply(state, [{ type: "turn", tokenId: "t4" }])).toEqual({ ok: false, error: "invalid" });
    // A player can't pass the turn while it belongs to a token that is gone.
    expect(apply({ ...state, combat: { ...state.combat!, active: "gone" } }, [{ type: "turn", step: 1 }], alice)).toEqual({ ok: false, error: "forbidden" });
  });

  it("dashes only for a creature in the fight, by its owner on its turn", () => {
    const state = fight();
    expect(apply(state, [{ type: "dash", tokenId: "nope", dash: true }])).toEqual({ ok: false, error: "invalid" });
    expect(apply(state, [{ type: "dash", tokenId: "t4", dash: true }])).toEqual({ ok: false, error: "invalid" });
    expect(apply(state, [{ type: "dash", tokenId: "t2", dash: true }], bob)).toEqual({ ok: false, error: "forbidden" });
    expect(apply(state, [{ type: "dash", tokenId: "t1", dash: true }], bob)).toEqual({ ok: false, error: "forbidden" });
    const dashed = ok(apply(state, [{ type: "dash", tokenId: "t2", dash: true }]));
    expect(combatantOf(dashed, "t2")).toEqual({ tokenId: "t2", initiative: 10, dash: true });
    expect(combatantOf(ok(apply(dashed, [{ type: "dash", tokenId: "t2", dash: false }])), "t2")).toEqual({ tokenId: "t2", initiative: 10 });
  });
});
