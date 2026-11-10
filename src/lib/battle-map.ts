/**
 * Shared battle map of a campaign: a square grid with hero and monster tokens.
 * Pure rules (validation, permissions, applying changes, what each viewer sees) so they can be unit tested;
 * storage and real-time delivery live in battle-map-data.ts and battle-map-hub.ts.
 */

export const MAP_MIN_SIZE = 4;
export const MAP_MAX_SIZE = 40;
export const MAP_DEFAULT_COLS = 20;
export const MAP_DEFAULT_ROWS = 14;
export const MAP_MAX_TOKENS = 120;
export const MAP_MAX_OPS = 40;
export const MAP_MAX_MONSTERS_PER_ADD = 20;
export const TOKEN_LABEL_MAX = 40;
/** Longest vision cone, in squares (120 ft). */
export const VISION_MAX_RANGE = 24;
/** Cone widths the DM can pick; 360 is all-round sight. */
export const VISION_ANGLES = [60, 90, 120, 180, 360] as const;
export type VisionAngle = (typeof VISION_ANGLES)[number];
/** Heroes see 60 ft in a 90° cone unless the DM says otherwise. */
export const DEFAULT_HERO_VISION: TokenVision = { range: 12, angle: 90 };

/** Creature size in grid squares per side: Medium/Small/Tiny 1, Large 2, Huge 3, Gargantuan 4. */
export type TokenSize = 1 | 2 | 3 | 4;
export type TokenKind = "hero" | "monster";
/** Where a token looks, in eighths of a turn clockwise from the top of the map: 0 north, 2 east, 4 south, 6 west. */
export type Facing = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
/** Vision cone: how far (squares, 0 = none) and how wide (degrees). */
export interface TokenVision { range: number; angle: VisionAngle }

export interface MapToken {
  id: string;
  kind: TokenKind;
  label: string;
  /** Top-left square of the token (0-based column and row). */
  x: number;
  y: number;
  size: TokenSize;
  /** Heroes: the campaign character the token stands for. */
  characterId?: string;
  /** Monsters: SRD slug, so the DM can open the stat block. */
  monsterSlug?: string;
  /** Monsters the DM placed but players can't see yet. */
  hidden?: boolean;
  defeated?: boolean;
  /** Defaults to north. */
  facing?: Facing;
  /** Explicit cone; heroes fall back to DEFAULT_HERO_VISION and monsters to none (see tokenVision). */
  vision?: TokenVision;
}

/** Background picture stretched over the grid; `key` changes on every upload, so its URL does too. */
export interface MapBackground { key: string }

export interface MapState {
  cols: number;
  rows: number;
  tokens: MapToken[];
  background?: MapBackground;
  /** Fog of war: players only see the squares inside the heroes' vision cones (and monsters standing there). */
  fog?: boolean;
  /** Grid lines switched off (the background picture usually brings its own). */
  gridHidden?: boolean;
}

export type MapOp =
  | { type: "move"; tokenId: string; x: number; y: number }
  | { type: "place-hero"; characterId: string; x?: number; y?: number }
  | { type: "add-monster"; label: string; count: number; size: TokenSize; hidden: boolean; monsterSlug?: string }
  | { type: "update"; tokenId: string; label?: string; hidden?: boolean; defeated?: boolean; size?: TokenSize; vision?: TokenVision }
  | { type: "face"; tokenId: string; facing: Facing }
  | { type: "settings"; fog?: boolean; gridHidden?: boolean }
  | { type: "remove"; tokenId: string }
  | { type: "clear-monsters" }
  | { type: "resize"; cols: number; rows: number };

/** A character currently in the campaign (only these can have hero tokens). */
export interface MapHero { id: string; name: string; ownerId: string }

export interface MapActor {
  userId: string;
  /** Campaign owner, co-DM or site admin. */
  isDm: boolean;
}

export const emptyMapState = (): MapState => ({ cols: MAP_DEFAULT_COLS, rows: MAP_DEFAULT_ROWS, tokens: [] });

const isInt = (value: unknown, min: number, max: number): value is number => Number.isInteger(value) && (value as number) >= min && (value as number) <= max;
const isSize = (value: unknown): value is TokenSize => isInt(value, 1, 4);
const tokenIdPattern = /^[A-Za-z0-9_-]{1,40}$/;
const isTokenId = (value: unknown): value is string => typeof value === "string" && tokenIdPattern.test(value);
const isFacing = (value: unknown): value is Facing => isInt(value, 0, 7);
const backgroundKeyPattern = /^[A-Za-z0-9_-]{1,40}$/;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function parseVision(value: unknown): TokenVision | null {
  if (!value || typeof value !== "object") return null;
  const { range, angle } = value as Record<string, unknown>;
  return isInt(range, 0, VISION_MAX_RANGE) && VISION_ANGLES.includes(angle as VisionAngle) ? { range, angle: angle as VisionAngle } : null;
}

function label(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.replace(/\s+/g, " ").trim();
  return trimmed && trimmed.length <= TOKEN_LABEL_MAX ? trimmed : null;
}

/** Validate one change from the browser. Null when anything is out of bounds. */
export function parseMapOp(raw: unknown): MapOp | null {
  if (!raw || typeof raw !== "object") return null;
  const op = raw as Record<string, unknown>;
  switch (op.type) {
    case "move":
      return isTokenId(op.tokenId) && isInt(op.x, 0, MAP_MAX_SIZE - 1) && isInt(op.y, 0, MAP_MAX_SIZE - 1)
        ? { type: "move", tokenId: op.tokenId, x: op.x, y: op.y } : null;
    case "place-hero": {
      if (typeof op.characterId !== "string" || !uuidPattern.test(op.characterId)) return null;
      const hasPosition = op.x !== undefined || op.y !== undefined;
      if (hasPosition && !(isInt(op.x, 0, MAP_MAX_SIZE - 1) && isInt(op.y, 0, MAP_MAX_SIZE - 1))) return null;
      return { type: "place-hero", characterId: op.characterId, ...(hasPosition ? { x: op.x as number, y: op.y as number } : {}) };
    }
    case "add-monster": {
      const name = label(op.label);
      const size = op.size === undefined ? 1 : op.size;
      if (!name || !isInt(op.count, 1, MAP_MAX_MONSTERS_PER_ADD) || !isSize(size)) return null;
      if (op.hidden !== undefined && typeof op.hidden !== "boolean") return null;
      if (op.monsterSlug !== undefined && (typeof op.monsterSlug !== "string" || !/^[a-z0-9-]{1,100}$/.test(op.monsterSlug))) return null;
      return { type: "add-monster", label: name, count: op.count, size, hidden: op.hidden === true, ...(op.monsterSlug ? { monsterSlug: op.monsterSlug as string } : {}) };
    }
    case "update": {
      if (!isTokenId(op.tokenId)) return null;
      const result: Extract<MapOp, { type: "update" }> = { type: "update", tokenId: op.tokenId };
      if (op.label !== undefined) { const name = label(op.label); if (!name) return null; result.label = name; }
      if (op.hidden !== undefined) { if (typeof op.hidden !== "boolean") return null; result.hidden = op.hidden; }
      if (op.defeated !== undefined) { if (typeof op.defeated !== "boolean") return null; result.defeated = op.defeated; }
      if (op.size !== undefined) { if (!isSize(op.size)) return null; result.size = op.size; }
      if (op.vision !== undefined) { const vision = parseVision(op.vision); if (!vision) return null; result.vision = vision; }
      return Object.keys(result).length > 2 ? result : null;
    }
    case "face":
      return isTokenId(op.tokenId) && isFacing(op.facing) ? { type: "face", tokenId: op.tokenId, facing: op.facing } : null;
    case "settings": {
      const result: Extract<MapOp, { type: "settings" }> = { type: "settings" };
      if (op.fog !== undefined) { if (typeof op.fog !== "boolean") return null; result.fog = op.fog; }
      if (op.gridHidden !== undefined) { if (typeof op.gridHidden !== "boolean") return null; result.gridHidden = op.gridHidden; }
      return Object.keys(result).length > 1 ? result : null;
    }
    case "remove":
      return isTokenId(op.tokenId) ? { type: "remove", tokenId: op.tokenId } : null;
    case "clear-monsters":
      return { type: "clear-monsters" };
    case "resize":
      return isInt(op.cols, MAP_MIN_SIZE, MAP_MAX_SIZE) && isInt(op.rows, MAP_MIN_SIZE, MAP_MAX_SIZE) ? { type: "resize", cols: op.cols, rows: op.rows } : null;
    default:
      return null;
  }
}

/** Validate a batch of changes (`{ ops: [...] }`). Null when the batch or any change is invalid. */
export function parseMapOps(body: unknown): MapOp[] | null {
  if (!body || typeof body !== "object") return null;
  const ops = (body as { ops?: unknown }).ops;
  if (!Array.isArray(ops) || ops.length < 1 || ops.length > MAP_MAX_OPS) return null;
  const parsed = ops.map(parseMapOp);
  return parsed.every((op): op is MapOp => op !== null) ? parsed : null;
}

/** Read a stored state defensively: drop anything malformed instead of failing the whole map. */
export function normalizeMapState(raw: unknown): MapState {
  const fallback = emptyMapState();
  if (!raw || typeof raw !== "object") return fallback;
  const value = raw as Record<string, unknown>;
  const cols = isInt(value.cols, MAP_MIN_SIZE, MAP_MAX_SIZE) ? value.cols : fallback.cols;
  const rows = isInt(value.rows, MAP_MIN_SIZE, MAP_MAX_SIZE) ? value.rows : fallback.rows;
  const tokens: MapToken[] = [];
  for (const item of Array.isArray(value.tokens) ? value.tokens : []) {
    if (!item || typeof item !== "object") continue;
    const token = item as Record<string, unknown>;
    const name = label(token.label);
    if (!isTokenId(token.id) || (token.kind !== "hero" && token.kind !== "monster") || !name || !isSize(token.size)) continue;
    if (!isInt(token.x, 0, MAP_MAX_SIZE - 1) || !isInt(token.y, 0, MAP_MAX_SIZE - 1)) continue;
    if (token.kind === "hero" && (typeof token.characterId !== "string" || !uuidPattern.test(token.characterId))) continue;
    const vision = parseVision(token.vision);
    tokens.push(clampToken({
      id: token.id, kind: token.kind, label: name, x: token.x, y: token.y, size: token.size,
      ...(token.kind === "hero" ? { characterId: token.characterId as string } : {}),
      ...(typeof token.monsterSlug === "string" ? { monsterSlug: token.monsterSlug } : {}),
      ...(token.hidden === true ? { hidden: true } : {}),
      ...(token.defeated === true ? { defeated: true } : {}),
      ...(isFacing(token.facing) && token.facing !== 0 ? { facing: token.facing } : {}),
      ...(vision ? { vision } : {}),
    }, cols, rows));
  }
  const background = value.background && typeof value.background === "object" ? (value.background as Record<string, unknown>).key : undefined;
  return {
    cols, rows, tokens: tokens.slice(0, MAP_MAX_TOKENS),
    ...(typeof background === "string" && backgroundKeyPattern.test(background) ? { background: { key: background } } : {}),
    ...(value.fog === true ? { fog: true } : {}),
    ...(value.gridHidden === true ? { gridHidden: true } : {}),
  };
}

function clampToken(token: MapToken, cols: number, rows: number): MapToken {
  const size = Math.min(token.size, cols, rows) as TokenSize;
  return { ...token, size, x: Math.max(0, Math.min(token.x, cols - size)), y: Math.max(0, Math.min(token.y, rows - size)) };
}

/**
 * Keep hero tokens in step with the campaign: drop those whose character left it and use the
 * character's current name.
 */
export function syncHeroes(state: MapState, heroes: MapHero[]): MapState {
  const byId = new Map(heroes.map((hero) => [hero.id, hero]));
  return {
    ...state,
    tokens: state.tokens.flatMap((token) => {
      if (token.kind !== "hero") return [token];
      const hero = token.characterId ? byId.get(token.characterId) : undefined;
      return hero ? [{ ...token, label: label(hero.name) ?? token.label }] : [];
    }),
  };
}

/** The cone a token sees with, or null when it has none. */
export function tokenVision(token: MapToken): TokenVision | null {
  const vision = token.vision ?? (token.kind === "hero" ? DEFAULT_HERO_VISION : null);
  return vision && vision.range > 0 ? vision : null;
}

/** Facing as an angle on screen in degrees (0 = right/east, 90 = down/south), the way SVG and atan2 measure it. */
export const facingScreenAngle = (facing: Facing | undefined) => (facing ?? 0) * 45 - 90;

/** Smallest difference between two angles in degrees (0…180). */
function angleGap(a: number, b: number): number {
  const gap = Math.abs(((a - b) % 360 + 360) % 360);
  return gap > 180 ? 360 - gap : gap;
}

/**
 * Squares ("x,y") a token sees: its own squares plus every square whose centre falls inside its cone.
 * Range is counted from the token's edge (a Medium hero with 12 squares sees 60 ft around it). No walls.
 */
export function tokenSight(token: MapToken, cols: number, rows: number): Set<string> {
  const cells = new Set<string>();
  for (let dx = 0; dx < token.size; dx++) for (let dy = 0; dy < token.size; dy++) cells.add(`${token.x + dx},${token.y + dy}`);
  const vision = tokenVision(token);
  if (!vision) return cells;
  const cx = token.x + token.size / 2;
  const cy = token.y + token.size / 2;
  const reach = vision.range + token.size / 2;
  const facing = facingScreenAngle(token.facing);
  const eps = 1e-9;
  for (let x = Math.max(0, Math.floor(cx - reach)); x <= Math.min(cols - 1, Math.ceil(cx + reach)); x++) {
    for (let y = Math.max(0, Math.floor(cy - reach)); y <= Math.min(rows - 1, Math.ceil(cy + reach)); y++) {
      const px = x + 0.5 - cx;
      const py = y + 0.5 - cy;
      if (Math.hypot(px, py) > reach + eps) continue;
      if (vision.angle < 360 && angleGap(Math.atan2(py, px) * 180 / Math.PI, facing) > vision.angle / 2 + eps) continue;
      cells.add(`${x},${y}`);
    }
  }
  return cells;
}

/** Squares the party sees together: the union of every hero's sight. */
export function partySight(state: MapState): Set<string> {
  const cells = new Set<string>();
  for (const token of state.tokens) if (token.kind === "hero") for (const cell of tokenSight(token, state.cols, state.rows)) cells.add(cell);
  return cells;
}

const tokenCells = (token: MapToken) => Array.from({ length: token.size * token.size }, (_, i) => `${token.x + (i % token.size)},${token.y + Math.floor(i / token.size)}`);

/** Is any square of this token in sight? */
export const tokenInSight = (token: MapToken, sight: Set<string>) => tokenCells(token).some((cell) => sight.has(cell));

/**
 * What a viewer may see: players (and the table display) never receive hidden monsters, and with fog of war
 * they don't receive monsters outside every hero's vision either.
 */
export function visibleMapState(state: MapState, showHidden: boolean): MapState {
  if (showHidden) return state;
  const sight = state.fog ? partySight(state) : null;
  return { ...state, tokens: state.tokens.filter((token) => !token.hidden && (!sight || token.kind !== "monster" || tokenInSight(token, sight))) };
}

/** Squares covered by tokens, to place new ones without stacking them. */
function occupied(state: MapState): Set<string> {
  const cells = new Set<string>();
  for (const token of state.tokens) {
    for (let dx = 0; dx < token.size; dx++) for (let dy = 0; dy < token.size; dy++) cells.add(`${token.x + dx},${token.y + dy}`);
  }
  return cells;
}

/** First free spot scanning columns from the left (heroes) or from the right (monsters). */
export function findFreeSpot(state: MapState, size: TokenSize, from: "left" | "right"): { x: number; y: number } {
  const taken = occupied(state);
  const fits = (x: number, y: number) => {
    for (let dx = 0; dx < size; dx++) for (let dy = 0; dy < size; dy++) if (taken.has(`${x + dx},${y + dy}`)) return false;
    return true;
  };
  const maxX = state.cols - size;
  const maxY = state.rows - size;
  for (let step = 0; step <= maxX; step++) {
    const x = from === "left" ? step : maxX - step;
    for (let y = 0; y <= maxY; y++) if (fits(x, y)) return { x, y };
  }
  return { x: from === "left" ? 0 : Math.max(0, maxX), y: 0 };
}

/** Next free number for "Goblin 1", "Goblin 2"… so new monsters don't repeat labels already on the map. */
function nextNumber(state: MapState, base: string): number {
  const pattern = new RegExp(`^${base.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} (\\d+)$`, "i");
  return state.tokens.reduce((max, token) => {
    const match = pattern.exec(token.label);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0) + 1;
}

export type MapOpError = "forbidden" | "invalid";
export type MapApplyResult = { ok: true; state: MapState } | { ok: false; error: MapOpError };

/** May this actor move or remove the token? DMs: any. Players: only heroes of their own characters. */
export function canControlToken(actor: MapActor, token: MapToken, heroes: MapHero[]): boolean {
  if (actor.isDm) return true;
  if (token.kind !== "hero") return false;
  return heroes.some((hero) => hero.id === token.characterId && hero.ownerId === actor.userId);
}

/**
 * Apply a batch of changes atomically: if any one is not allowed the whole batch is rejected.
 * `newId` makes token ids (random on the server, predictable in tests).
 */
export function applyMapOps(start: MapState, ops: MapOp[], actor: MapActor, heroes: MapHero[], newId: () => string): MapApplyResult {
  let state: MapState = { ...start, tokens: [...start.tokens] };
  const fail = (error: MapOpError): MapApplyResult => ({ ok: false, error });
  const replace = (id: string, change: (token: MapToken) => MapToken) => {
    state = { ...state, tokens: state.tokens.map((token) => token.id === id ? change(token) : token) };
  };

  for (const op of ops) {
    switch (op.type) {
      case "move": {
        const token = state.tokens.find((item) => item.id === op.tokenId);
        if (!token) return fail("invalid");
        if (!canControlToken(actor, token, heroes)) return fail("forbidden");
        replace(token.id, (item) => clampToken({ ...item, x: op.x, y: op.y }, state.cols, state.rows));
        break;
      }
      case "place-hero": {
        const hero = heroes.find((item) => item.id === op.characterId);
        if (!hero) return fail("invalid");
        if (!actor.isDm && hero.ownerId !== actor.userId) return fail("forbidden");
        const existing = state.tokens.find((item) => item.kind === "hero" && item.characterId === hero.id);
        const spot = op.x !== undefined && op.y !== undefined ? { x: op.x, y: op.y } : existing ?? findFreeSpot(state, 1, "left");
        if (existing) replace(existing.id, (item) => clampToken({ ...item, x: spot.x, y: spot.y }, state.cols, state.rows));
        else {
          if (state.tokens.length >= MAP_MAX_TOKENS) return fail("invalid");
          state = { ...state, tokens: [...state.tokens, clampToken({ id: newId(), kind: "hero", label: label(hero.name) ?? "?", characterId: hero.id, size: 1, ...spot }, state.cols, state.rows)] };
        }
        break;
      }
      case "add-monster": {
        if (!actor.isDm) return fail("forbidden");
        if (state.tokens.length + op.count > MAP_MAX_TOKENS) return fail("invalid");
        const first = op.count > 1 ? nextNumber(state, op.label) : 0;
        for (let index = 0; index < op.count; index++) {
          const name = op.count > 1 ? `${op.label.slice(0, TOKEN_LABEL_MAX - 4)} ${first + index}` : op.label;
          const spot = findFreeSpot(state, op.size, "right");
          state = { ...state, tokens: [...state.tokens, clampToken({
            id: newId(), kind: "monster", label: name, size: op.size, ...spot,
            ...(op.hidden ? { hidden: true } : {}), ...(op.monsterSlug ? { monsterSlug: op.monsterSlug } : {}),
          }, state.cols, state.rows)] };
        }
        break;
      }
      case "update": {
        if (!actor.isDm) return fail("forbidden");
        const token = state.tokens.find((item) => item.id === op.tokenId);
        if (!token) return fail("invalid");
        if (token.kind === "hero" && (op.label !== undefined || op.hidden !== undefined)) return fail("invalid");
        replace(token.id, (item) => {
          const next: MapToken = {
            ...item, ...(op.label !== undefined ? { label: op.label } : {}), ...(op.size !== undefined ? { size: op.size } : {}),
            ...(op.vision !== undefined ? { vision: op.vision } : {}),
          };
          if (op.hidden !== undefined) { if (op.hidden) next.hidden = true; else delete next.hidden; }
          if (op.defeated !== undefined) { if (op.defeated) next.defeated = true; else delete next.defeated; }
          return clampToken(next, state.cols, state.rows);
        });
        break;
      }
      case "face": {
        const token = state.tokens.find((item) => item.id === op.tokenId);
        if (!token) return fail("invalid");
        if (!canControlToken(actor, token, heroes)) return fail("forbidden");
        replace(token.id, (item) => {
          const next: MapToken = { ...item, facing: op.facing };
          if (op.facing === 0) delete next.facing;
          return next;
        });
        break;
      }
      case "settings": {
        if (!actor.isDm) return fail("forbidden");
        const next: MapState = { ...state };
        if (op.fog !== undefined) { if (op.fog) next.fog = true; else delete next.fog; }
        if (op.gridHidden !== undefined) { if (op.gridHidden) next.gridHidden = true; else delete next.gridHidden; }
        state = next;
        break;
      }
      case "remove": {
        const token = state.tokens.find((item) => item.id === op.tokenId);
        if (!token) break; // already gone: removing twice is harmless
        if (!canControlToken(actor, token, heroes)) return fail("forbidden");
        state = { ...state, tokens: state.tokens.filter((item) => item.id !== token.id) };
        break;
      }
      case "clear-monsters":
        if (!actor.isDm) return fail("forbidden");
        state = { ...state, tokens: state.tokens.filter((token) => token.kind !== "monster") };
        break;
      case "resize":
        if (!actor.isDm) return fail("forbidden");
        state = { ...state, cols: op.cols, rows: op.rows, tokens: state.tokens.map((token) => clampToken(token, op.cols, op.rows)) };
        break;
    }
  }
  return { ok: true, state };
}

/** Spreadsheet-style column name for a 0-based index: A…Z, then AA, AB… */
export function columnName(index: number): string {
  let name = "";
  let n = index + 1;
  while (n > 0) {
    const rest = (n - 1) % 26;
    name = String.fromCharCode(65 + rest) + name;
    n = Math.floor((n - 1) / 26);
  }
  return name;
}

/** Square reference players say out loud at the table, e.g. "C4". */
export const squareName = (x: number, y: number) => `${columnName(x)}${y + 1}`;

/** Picture formats accepted as a map background (no SVG: it can carry scripts). */
export type MapImageType = "image/png" | "image/jpeg" | "image/webp" | "image/gif";

/** Recognise an uploaded picture by its first bytes, not by what the browser claims it is. */
export function sniffImageType(bytes: Uint8Array): MapImageType | null {
  const starts = (...signature: number[]) => signature.every((byte, index) => bytes[index] === byte);
  if (starts(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return "image/png";
  if (starts(0xff, 0xd8, 0xff)) return "image/jpeg";
  if (starts(0x47, 0x49, 0x46, 0x38)) return "image/gif";
  if (starts(0x52, 0x49, 0x46, 0x46) && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return "image/webp";
  return null;
}

/** Rows that keep a picture's proportions with the given number of columns (square squares), within the map limits. */
export function rowsForImage(cols: number, width: number, height: number): number {
  if (!(width > 0 && height > 0)) return MAP_DEFAULT_ROWS;
  return Math.max(MAP_MIN_SIZE, Math.min(MAP_MAX_SIZE, Math.round(cols * height / width)));
}
