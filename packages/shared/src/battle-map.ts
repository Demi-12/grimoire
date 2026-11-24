/**
 * Shared battle map of a campaign: a square grid with hero and monster tokens.
 * Pure rules (validation, permissions, applying changes, what each viewer sees) so they can be unit tested;
 * storage and real-time delivery live in the API (apps/api/src/map: map.service.ts and battle-map-hub.ts).
 */

export const MAP_MIN_SIZE = 4;
export const MAP_MAX_SIZE = 40;
export const MAP_DEFAULT_COLS = 20;
export const MAP_DEFAULT_ROWS = 14;
export const MAP_MAX_TOKENS = 120;
export const MAP_MAX_OPS = 40;
export const MAP_MAX_MONSTERS_PER_ADD = 20;
export const TOKEN_LABEL_MAX = 40;
/** Wall segments per map (each one can run the whole width or height of the grid). */
export const MAP_MAX_WALLS = 300;
export const MAP_MAX_WALLS_PER_ADD = 50;
/** A hero may open or close a door this many squares away (0 = standing right next to it). */
export const DOOR_REACH = 1;
/** Longest vision cone, in squares (120 ft). */
export const VISION_MAX_RANGE = 24;
/** Cone widths the DM can pick; 360 is all-round sight. */
export const VISION_ANGLES = [60, 90, 120, 180, 360] as const;
export type VisionAngle = (typeof VISION_ANGLES)[number];
/** Heroes see 60 ft in a 90° cone unless the DM says otherwise. */
export const DEFAULT_HERO_VISION: TokenVision = { range: 12, angle: 90 };
/** Initiative values a combatant may have (a d20 plus modifiers, with room for homebrew). */
export const INITIATIVE_MIN = -20;
export const INITIATIVE_MAX = 99;
/** Fastest speed tracked, in squares (200 ft). */
export const COMBAT_MAX_SPEED = 40;
const COMBAT_MAX_MOVED = 999;
const COMBAT_MAX_ROUND = 999;

/** Creature size in grid squares per side: Medium/Small/Tiny 1, Large 2, Huge 3, Gargantuan 4. */
export type TokenSize = 1 | 2 | 3 | 4;
/** Squares per side for a stat block's size ("Large", "huge"…); Medium and smaller, or unknown, take one. */
export function tokenSizeFor(size: string | undefined): TokenSize {
  const name = (size ?? "").toLowerCase();
  return name.includes("gargantuan") ? 4 : name.includes("huge") ? 3 : name.includes("large") ? 2 : 1;
}
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

/**
 * A wall along the grid lines, from corner (x1, y1) to corner (x2, y2): horizontal or vertical, stored with
 * x1 <= x2 and y1 <= y2. It blocks sight and, for players, movement. A door does the same only while closed.
 */
export interface MapWall { x1: number; y1: number; x2: number; y2: number; door?: "open" | "closed" }

/** Background picture stretched over the grid; `key` changes on every upload, so its URL does too. */
export interface MapBackground { key: string }

/** One creature in the initiative order. Speeds and movement are counted in squares (5 ft, 1.5 m each). */
export interface Combatant {
  tokenId: string;
  initiative: number;
  /** Squares it may move in a turn; when unknown its movement isn't limited, only counted. */
  speed?: number;
  /** Squares moved since its turn began. */
  moved?: number;
  /** Took the Dash action this turn: twice the speed. */
  dash?: boolean;
}

/** A fight in progress: whose turn it is, in what round, and everyone in initiative order (highest first). */
export interface MapCombat {
  round: number;
  /** The token whose turn it is (missing in the players' view while it's a creature they can't see). */
  active?: string;
  order: Combatant[];
}

export interface MapState {
  cols: number;
  rows: number;
  tokens: MapToken[];
  background?: MapBackground;
  /** Fog of war: players only see the squares inside the heroes' vision cones (and monsters standing there). */
  fog?: boolean;
  /** Grid lines switched off (the background picture usually brings its own). */
  gridHidden?: boolean;
  walls?: MapWall[];
  /** Squares the party has seen while the fog was on (a bitmap in hex, row by row), shown dimmed. */
  explored?: string;
  /**
   * Players' view only, never stored: the squares the party sees right now, worked out by the server with every
   * wall (players only receive the walls they have seen, too few to work it out themselves). Same bitmap format.
   */
  sight?: string;
  /** Initiative order, turns and movement while a fight is on. */
  combat?: MapCombat;
}

/** Initiative and speed of one creature when the fight starts or when it joins later. */
export interface CombatEntry { tokenId: string; initiative: number; speed?: number }

export type MapOp =
  | { type: "move"; tokenId: string; x: number; y: number }
  | { type: "place-hero"; characterId: string; x?: number; y?: number }
  | { type: "add-monster"; label: string; count: number; size: TokenSize; hidden: boolean; monsterSlug?: string }
  | { type: "update"; tokenId: string; label?: string; hidden?: boolean; defeated?: boolean; size?: TokenSize; vision?: TokenVision; monsterSlug?: string }
  | { type: "face"; tokenId: string; facing: Facing }
  | { type: "settings"; fog?: boolean; gridHidden?: boolean; resetExplored?: true }
  | { type: "add-walls"; walls: MapWall[] }
  | { type: "remove-wall"; x1: number; y1: number; x2: number; y2: number }
  | { type: "door"; x1: number; y1: number; x2: number; y2: number; open: boolean }
  | { type: "clear-walls" }
  | { type: "remove"; tokenId: string }
  | { type: "clear-monsters" }
  | { type: "resize"; cols: number; rows: number }
  | { type: "combat-start"; entries: CombatEntry[] }
  /** Add a creature to the fight, or change its initiative, speed (null: unknown) or the movement it has used. */
  | { type: "combatant"; tokenId: string; initiative?: number; speed?: number | null; moved?: number }
  | { type: "combat-leave"; tokenId: string }
  /** Pass the turn on (step 1), back (step -1), or straight to one creature. */
  | { type: "turn"; step: 1 | -1 } | { type: "turn"; tokenId: string }
  | { type: "dash"; tokenId: string; dash: boolean }
  | { type: "combat-end" };

/** A character currently in the campaign (only these can have hero tokens). */
export interface MapHero { id: string; name: string; ownerId: string }

export interface MapActor {
  userId: string;
  /** Campaign owner, co-DM or site admin. */
  isDm: boolean;
}

export const emptyMapState = (): MapState => ({ cols: MAP_DEFAULT_COLS, rows: MAP_DEFAULT_ROWS, tokens: [] });

const isInt = (value: unknown, min: number, max: number): value is number => Number.isInteger(value) && (value as number) >= min && (value as number) <= max;
/** Any object (arrays too), to read its fields one by one. */
const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object";
const isSize = (value: unknown): value is TokenSize => isInt(value, 1, 4);
const tokenIdPattern = /^[A-Za-z0-9_-]{1,40}$/;
const isTokenId = (value: unknown): value is string => typeof value === "string" && tokenIdPattern.test(value);
const isFacing = (value: unknown): value is Facing => isInt(value, 0, 7);
const backgroundKeyPattern = /^[A-Za-z0-9_-]{1,40}$/;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Bestiary keys as Open5e writes them ("srd_goblin", "srd-2024_goblin") and homebrew monsters ("homebrew:<uuid>"). */
const monsterSlugPattern = /^(?:[A-Za-z0-9][A-Za-z0-9_-]{0,99}|homebrew:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;
/** A stat block the map can link a monster token to. */
export const isMonsterSlug = (value: unknown): value is string => typeof value === "string" && monsterSlugPattern.test(value);
const isInitiative = (value: unknown): value is number => isInt(value, INITIATIVE_MIN, INITIATIVE_MAX);
const isSpeed = (value: unknown): value is number => isInt(value, 0, COMBAT_MAX_SPEED);

function parseCombatEntry(value: unknown): CombatEntry | null {
  if (!value || typeof value !== "object") return null;
  const { tokenId, initiative, speed } = value as Record<string, unknown>;
  if (!isTokenId(tokenId) || !isInitiative(initiative) || (speed !== undefined && !isSpeed(speed))) return null;
  return { tokenId, initiative, ...(speed !== undefined ? { speed: speed as number } : {}) };
}

function parseVision(value: unknown): TokenVision | null {
  if (!value || typeof value !== "object") return null;
  const { range, angle } = value as Record<string, unknown>;
  return isInt(range, 0, VISION_MAX_RANGE) && VISION_ANGLES.includes(angle as VisionAngle) ? { range, angle: angle as VisionAngle } : null;
}

/** A wall from the browser or storage: whole corners inside the largest grid, horizontal or vertical, not empty. */
export function parseWall(value: unknown): MapWall | null {
  if (!value || typeof value !== "object") return null;
  const wall = value as Record<string, unknown>;
  const { x1, y1, x2, y2 } = wall;
  if (![x1, y1, x2, y2].every((n) => isInt(n, 0, MAP_MAX_SIZE))) return null;
  const [ax, ay, bx, by] = [x1, y1, x2, y2] as number[];
  if ((ax !== bx) === (ay !== by)) return null; // diagonal or a single point
  if (wall.door !== undefined && wall.door !== "open" && wall.door !== "closed") return null;
  return { x1: Math.min(ax, bx), y1: Math.min(ay, by), x2: Math.max(ax, bx), y2: Math.max(ay, by), ...(wall.door ? { door: wall.door as "open" | "closed" } : {}) };
}

const sameSpan = (a: Pick<MapWall, "x1" | "y1" | "x2" | "y2">, b: Pick<MapWall, "x1" | "y1" | "x2" | "y2">) => a.x1 === b.x1 && a.y1 === b.y1 && a.x2 === b.x2 && a.y2 === b.y2;

/** Cut a wall to the grid; null when nothing of it is left inside. */
function clipWall(wall: MapWall, cols: number, rows: number): MapWall | null {
  if (wall.x1 > cols || wall.y1 > rows) return null;
  const clipped = { ...wall, x2: Math.min(wall.x2, cols), y2: Math.min(wall.y2, rows) };
  return clipped.x1 === clipped.x2 && clipped.y1 === clipped.y2 ? null : clipped;
}

function label(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.replace(/\s+/g, " ").trim();
  return trimmed && trimmed.length <= TOKEN_LABEL_MAX ? trimmed : null;
}

type MapOpType = MapOp["type"];
type MapOpOf<K extends MapOpType> = Extract<MapOp, { type: K }>;
/** A change as it arrives from the browser, before it is checked. */
type RawOp = Record<string, unknown>;
type WallSpan = Pick<MapWall, "x1" | "y1" | "x2" | "y2">;

const isBoolean = (value: unknown): value is boolean => typeof value === "boolean";
const isTrue = (value: unknown): value is true => value === true;
const isUuid = (value: unknown): value is string => typeof value === "string" && uuidPattern.test(value);
const isSquare = (value: unknown): value is number => isInt(value, 0, MAP_MAX_SIZE - 1);
const isMoved = (value: unknown): value is number => isInt(value, 0, COMBAT_MAX_MOVED);
/** A combatant's speed, or null to say it isn't known. */
const isSpeedOrUnknown = (value: unknown): value is number | null => value === null || isSpeed(value);
/** Left out, or there and accepted by the guard. */
const isOptional = <T>(value: unknown, guard: (value: unknown) => value is T): value is T | undefined => value === undefined || guard(value);

/** Reads one optional field of a change: its clean value, or undefined when the field is there but wrong. */
type FieldReader<T> = (value: unknown) => T | undefined;
/** A reader for each optional field of a change; the mapped type asks for one per field. */
type FieldReaders<T> = { [K in keyof T]-?: FieldReader<Exclude<T[K], undefined>> };
const checked = <T>(guard: (value: unknown) => value is T): FieldReader<T> => (value) => guard(value) ? value : undefined;
const readLabel: FieldReader<string> = (value) => label(value) ?? undefined;
const readVision: FieldReader<TokenVision> = (value) => parseVision(value) ?? undefined;

/**
 * The optional fields of a change that has to carry at least one: fields left out stay out, and one wrong
 * field, or none at all, rejects the change.
 */
function someFields<T extends object>(op: RawOp, readers: FieldReaders<T>): Partial<T> | null {
  const fields: Partial<T> = {};
  for (const key in readers) {
    if (op[key] === undefined) continue;
    const value = readers[key](op[key]);
    if (value === undefined) return null;
    fields[key] = value;
  }
  return Object.keys(fields).length ? fields : null;
}

type FieldsOf<K extends MapOpType, Fixed extends string> = Omit<MapOpOf<K>, "type" | Fixed>;
const updateFields: FieldReaders<FieldsOf<"update", "tokenId">> = {
  label: readLabel, hidden: checked(isBoolean), defeated: checked(isBoolean), size: checked(isSize), vision: readVision, monsterSlug: checked(isMonsterSlug),
};
const settingsFields: FieldReaders<FieldsOf<"settings", never>> = { fog: checked(isBoolean), gridHidden: checked(isBoolean), resetExplored: checked(isTrue) };
const combatantFields: FieldReaders<FieldsOf<"combatant", "tokenId">> = { initiative: checked(isInitiative), speed: checked(isSpeedOrUnknown), moved: checked(isMoved) };

/** The wall a change points at, by its two corners in either order. */
function parseSpan(op: RawOp): WallSpan | null {
  const wall = parseWall({ x1: op.x1, y1: op.y1, x2: op.x2, y2: op.y2 });
  return wall && { x1: wall.x1, y1: wall.y1, x2: wall.x2, y2: wall.y2 };
}

function parseMoveOp(op: RawOp): MapOpOf<"move"> | null {
  return isTokenId(op.tokenId) && isSquare(op.x) && isSquare(op.y) ? { type: "move", tokenId: op.tokenId, x: op.x, y: op.y } : null;
}

/** Without a square the hero goes to the first free one (or stays where it is). */
function parsePlaceHeroOp(op: RawOp): MapOpOf<"place-hero"> | null {
  if (!isUuid(op.characterId)) return null;
  if (op.x === undefined && op.y === undefined) return { type: "place-hero", characterId: op.characterId };
  return isSquare(op.x) && isSquare(op.y) ? { type: "place-hero", characterId: op.characterId, x: op.x, y: op.y } : null;
}

function parseAddMonsterOp(op: RawOp): MapOpOf<"add-monster"> | null {
  const name = label(op.label);
  const size = op.size === undefined ? 1 : op.size;
  if (!name || !isInt(op.count, 1, MAP_MAX_MONSTERS_PER_ADD) || !isSize(size)) return null;
  if (!isOptional(op.hidden, isBoolean) || !isOptional(op.monsterSlug, isMonsterSlug)) return null;
  return { type: "add-monster", label: name, count: op.count, size, hidden: op.hidden === true, ...(op.monsterSlug ? { monsterSlug: op.monsterSlug } : {}) };
}

function parseUpdateOp(op: RawOp): MapOpOf<"update"> | null {
  if (!isTokenId(op.tokenId)) return null;
  const fields = someFields(op, updateFields);
  return fields && { type: "update", tokenId: op.tokenId, ...fields };
}

function parseFaceOp(op: RawOp): MapOpOf<"face"> | null {
  return isTokenId(op.tokenId) && isFacing(op.facing) ? { type: "face", tokenId: op.tokenId, facing: op.facing } : null;
}

function parseSettingsOp(op: RawOp): MapOpOf<"settings"> | null {
  const fields = someFields(op, settingsFields);
  return fields && { type: "settings", ...fields };
}

function parseAddWallsOp(op: RawOp): MapOpOf<"add-walls"> | null {
  if (!Array.isArray(op.walls) || op.walls.length < 1 || op.walls.length > MAP_MAX_WALLS_PER_ADD) return null;
  const walls = op.walls.map(parseWall);
  return walls.every((wall): wall is MapWall => wall !== null) ? { type: "add-walls", walls } : null;
}

function parseRemoveWallOp(op: RawOp): MapOpOf<"remove-wall"> | null {
  const span = parseSpan(op);
  return span && { type: "remove-wall", ...span };
}

function parseDoorOp(op: RawOp): MapOpOf<"door"> | null {
  const span = parseSpan(op);
  return span && isBoolean(op.open) ? { type: "door", ...span, open: op.open } : null;
}

const parseClearWallsOp = (): MapOpOf<"clear-walls"> => ({ type: "clear-walls" });

function parseRemoveOp(op: RawOp): MapOpOf<"remove"> | null {
  return isTokenId(op.tokenId) ? { type: "remove", tokenId: op.tokenId } : null;
}

const parseClearMonstersOp = (): MapOpOf<"clear-monsters"> => ({ type: "clear-monsters" });

function parseResizeOp(op: RawOp): MapOpOf<"resize"> | null {
  return isInt(op.cols, MAP_MIN_SIZE, MAP_MAX_SIZE) && isInt(op.rows, MAP_MIN_SIZE, MAP_MAX_SIZE) ? { type: "resize", cols: op.cols, rows: op.rows } : null;
}

/** Everyone in the fight once, each with a valid initiative. */
function parseCombatStartOp(op: RawOp): MapOpOf<"combat-start"> | null {
  if (!Array.isArray(op.entries) || op.entries.length > MAP_MAX_TOKENS) return null;
  const entries = op.entries.map(parseCombatEntry);
  if (!entries.every((entry): entry is CombatEntry => entry !== null)) return null;
  return new Set(entries.map((entry) => entry.tokenId)).size === entries.length ? { type: "combat-start", entries } : null;
}

function parseCombatantOp(op: RawOp): MapOpOf<"combatant"> | null {
  if (!isTokenId(op.tokenId)) return null;
  const fields = someFields(op, combatantFields);
  return fields && { type: "combatant", tokenId: op.tokenId, ...fields };
}

function parseCombatLeaveOp(op: RawOp): MapOpOf<"combat-leave"> | null {
  return isTokenId(op.tokenId) ? { type: "combat-leave", tokenId: op.tokenId } : null;
}

/** A step (1 or -1) or a creature, never both. */
function parseTurnOp(op: RawOp): MapOpOf<"turn"> | null {
  if (op.step === undefined) return isTokenId(op.tokenId) ? { type: "turn", tokenId: op.tokenId } : null;
  return op.tokenId === undefined && (op.step === 1 || op.step === -1) ? { type: "turn", step: op.step } : null;
}

function parseDashOp(op: RawOp): MapOpOf<"dash"> | null {
  return isTokenId(op.tokenId) && isBoolean(op.dash) ? { type: "dash", tokenId: op.tokenId, dash: op.dash } : null;
}

const parseCombatEndOp = (): MapOpOf<"combat-end"> => ({ type: "combat-end" });

/** One parser per kind of change; the mapped type makes the compiler ask for one with every new variant. */
const opParsers: { [K in MapOpType]: (op: RawOp) => MapOpOf<K> | null } = {
  move: parseMoveOp,
  "place-hero": parsePlaceHeroOp,
  "add-monster": parseAddMonsterOp,
  update: parseUpdateOp,
  face: parseFaceOp,
  settings: parseSettingsOp,
  "add-walls": parseAddWallsOp,
  "remove-wall": parseRemoveWallOp,
  door: parseDoorOp,
  "clear-walls": parseClearWallsOp,
  remove: parseRemoveOp,
  "clear-monsters": parseClearMonstersOp,
  resize: parseResizeOp,
  "combat-start": parseCombatStartOp,
  combatant: parseCombatantOp,
  "combat-leave": parseCombatLeaveOp,
  turn: parseTurnOp,
  dash: parseDashOp,
  "combat-end": parseCombatEndOp,
};

/** A kind of change the map knows (own keys only, so "toString" and the like are not). */
const isMapOpType = (value: unknown): value is MapOpType => typeof value === "string" && Object.hasOwn(opParsers, value);

/** Validate one change from the browser. Null when anything is out of bounds. */
export function parseMapOp(raw: unknown): MapOp | null {
  if (!raw || typeof raw !== "object") return null;
  const op = raw as RawOp;
  return isMapOpType(op.type) ? opParsers[op.type](op) : null;
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
  if (!isRecord(raw)) return emptyMapState();
  const cols = storedGridSize(raw.cols, MAP_DEFAULT_COLS);
  const rows = storedGridSize(raw.rows, MAP_DEFAULT_ROWS);
  const tokens = storedTokens(raw.tokens, cols, rows);
  const combat = normalizeCombat(raw.combat, new Set(tokens.map((token) => token.id)));
  const walls = storedWalls(raw.walls, cols, rows);
  const explored = storedExplored(raw.explored, cols, rows);
  const background = storedBackground(raw.background);
  return {
    cols, rows, tokens,
    ...(combat ? { combat } : {}),
    ...(walls.length ? { walls } : {}),
    ...(explored ? { explored } : {}),
    ...(background ? { background } : {}),
    ...(raw.fog === true ? { fog: true } : {}),
    ...(raw.gridHidden === true ? { gridHidden: true } : {}),
  };
}

/** Columns or rows of a stored grid: a whole number within the limits, else the default. */
function storedGridSize(value: unknown, fallback: number): number {
  return isInt(value, MAP_MIN_SIZE, MAP_MAX_SIZE) ? value : fallback;
}

/** The stored tokens that are well formed, pulled inside the grid, up to MAP_MAX_TOKENS. */
function storedTokens(value: unknown, cols: number, rows: number): MapToken[] {
  const tokens: MapToken[] = [];
  for (const item of Array.isArray(value) ? value : []) {
    const token = storedToken(item);
    if (token) tokens.push(clampToken(token, cols, rows));
  }
  return tokens.slice(0, MAP_MAX_TOKENS);
}

/** One stored token, or null when a field every token needs is wrong or a hero has no character. */
function storedToken(item: unknown): MapToken | null {
  if (!isRecord(item)) return null;
  const core = storedTokenCore(item);
  const link = core && storedCharacterLink(core.kind, item.characterId);
  return core && link ? { ...core, ...link, ...storedTokenExtras(item) } : null;
}

/** The fields every token needs (id, kind, label, square and size); null when one is missing or wrong. */
function storedTokenCore(item: Record<string, unknown>): Pick<MapToken, "id" | "kind" | "label" | "x" | "y" | "size"> | null {
  const { id, kind, x, y, size } = item;
  const name = label(item.label);
  if (!isTokenId(id) || !isTokenKind(kind) || !name || !isSize(size)) return null;
  return isSquare(x) && isSquare(y) ? { id, kind, label: name, x, y, size } : null;
}

const isTokenKind = (value: unknown): value is TokenKind => value === "hero" || value === "monster";

/** A hero's link to its character (null when it has none that is valid); monsters have no link. */
function storedCharacterLink(kind: TokenKind, characterId: unknown): Pick<MapToken, "characterId"> | null {
  if (kind !== "hero") return {};
  return isUuid(characterId) ? { characterId } : null;
}

/** A stored token's optional fields, each kept only with a valid value; facing north and false flags are left out. */
function storedTokenExtras(item: Record<string, unknown>): Pick<MapToken, "monsterSlug" | "hidden" | "defeated" | "facing" | "vision"> {
  const vision = parseVision(item.vision);
  return {
    ...(typeof item.monsterSlug === "string" ? { monsterSlug: item.monsterSlug } : {}),
    ...(item.hidden === true ? { hidden: true } : {}),
    ...(item.defeated === true ? { defeated: true } : {}),
    ...(isFacing(item.facing) && item.facing !== 0 ? { facing: item.facing } : {}),
    ...(vision ? { vision } : {}),
  };
}

/** The stored walls that are well formed, cut to the grid (those left outside dropped), up to MAP_MAX_WALLS. */
function storedWalls(value: unknown, cols: number, rows: number): MapWall[] {
  return (Array.isArray(value) ? value : []).map(parseWall)
    .map((wall) => wall && clipWall(wall, cols, rows)).filter((wall): wall is MapWall => wall !== null).slice(0, MAP_MAX_WALLS);
}

/** The explored bitmap when it is lowercase hex exactly as long as the grid needs; null otherwise. */
function storedExplored(value: unknown, cols: number, rows: number): string | null {
  return typeof value === "string" && value.length === Math.ceil(cols * rows / 4) && /^[0-9a-f]*$/.test(value) ? value : null;
}

/** The background picture when its key is well formed; null otherwise. */
function storedBackground(value: unknown): MapBackground | null {
  const key = isRecord(value) ? value.key : undefined;
  return typeof key === "string" && backgroundKeyPattern.test(key) ? { key } : null;
}

/** A stored fight: only creatures still on the map, each once, in initiative order. */
function normalizeCombat(raw: unknown, tokenIds: Set<string>): MapCombat | null {
  if (!isRecord(raw)) return null;
  const order = storedOrder(raw.order, tokenIds);
  return {
    round: isInt(raw.round, 1, COMBAT_MAX_ROUND) ? raw.round : 1,
    order: sortOrder(order),
    ...(typeof raw.active === "string" && order.some((entry) => entry.tokenId === raw.active) ? { active: raw.active } : {}),
  };
}

/** The stored initiative order as it was stored: valid entries for creatures on the map, the first one of each. */
function storedOrder(value: unknown, tokenIds: Set<string>): Combatant[] {
  const order: Combatant[] = [];
  for (const item of Array.isArray(value) ? value : []) {
    const entry = storedCombatant(item);
    if (entry && tokenIds.has(entry.tokenId) && !order.some((other) => other.tokenId === entry.tokenId)) order.push(entry);
  }
  return order;
}

/** One stored combatant with the movement it has used (if any) and its Dash; null when its entry is malformed. */
function storedCombatant(item: unknown): Combatant | null {
  const entry = parseCombatEntry(item);
  if (!entry) return null;
  const { moved, dash } = item as Record<string, unknown>;
  return { ...entry, ...(isInt(moved, 1, COMBAT_MAX_MOVED) ? { moved } : {}), ...(dash === true ? { dash: true } : {}) };
}

/** Highest initiative first; ties keep the order they had. */
const sortOrder = (order: Combatant[]) => [...order].sort((a, b) => b.initiative - a.initiative);

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
  return pruneCombat({
    ...state,
    tokens: state.tokens.flatMap((token) => {
      if (token.kind !== "hero") return [token];
      const hero = token.characterId ? byId.get(token.characterId) : undefined;
      return hero ? [{ ...token, label: label(hero.name) ?? token.label }] : [];
    }),
  });
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
 * Unit grid edges that block: "h:x,y" is the edge from corner (x, y) to (x + 1, y), "v:x,y" the one from
 * (x, y) to (x, y + 1). Walls and closed doors block; open doors don't.
 */
export function blockingEdges(walls: MapWall[] | undefined): Set<string> {
  const edges = new Set<string>();
  for (const wall of walls ?? []) {
    if (wall.door === "open") continue;
    if (wall.y1 === wall.y2) for (let x = wall.x1; x < wall.x2; x++) edges.add(`h:${x},${wall.y1}`);
    else for (let y = wall.y1; y < wall.y2; y++) edges.add(`v:${wall.x1},${y}`);
  }
  return edges;
}

/** Is the straight line between two points (in squares) free of blocking edges? Walks the squares it crosses. */
export function lineIsClear(x0: number, y0: number, x1: number, y1: number, blocked: Set<string>): boolean {
  if (!blocked.size) return true;
  const across = axisWalk(x0, x1 - x0);
  const down = axisWalk(y0, y1 - y0);
  while (Math.min(across.next, down.next) <= 1) {
    const vertical = across.next < down.next;
    if (blocked.has(vertical ? `v:${lineAhead(across)},${down.cell}` : `h:${across.cell},${lineAhead(down)}`)) return false;
    advance(vertical ? across : down);
  }
  return true;
}

/**
 * One axis of a walk along a line, square by square: the square it is in, which way it steps, and how far along
 * the line (0 at the start, 1 at the end) it crosses the next grid line and each one after that.
 */
interface AxisWalk { cell: number; step: number; next: number; delta: number }

function axisWalk(from: number, distance: number): AxisWalk {
  const cell = Math.floor(from);
  if (!distance) return { cell, step: 0, next: Infinity, delta: Infinity };
  const step = Math.sign(distance);
  return { cell, step, next: ((step > 0 ? cell + 1 : cell) - from) / distance, delta: Math.abs(1 / distance) };
}

/** The grid line (column or row number) the walk crosses next. */
function lineAhead(walk: AxisWalk): number {
  return walk.step > 0 ? walk.cell + 1 : walk.cell;
}

/** Cross that line: into the next square, and on to the line after. */
function advance(walk: AxisWalk): void {
  walk.cell += walk.step;
  walk.next += walk.delta;
}

/** Where sight lines end inside a square: its centre and four points near its corners, so a square seen only in part counts. */
const SIGHT_SAMPLES: [number, number][] = [[0.5, 0.5], [0.15, 0.15], [0.85, 0.15], [0.15, 0.85], [0.85, 0.85]];

/**
 * Squares ("x,y") a token sees: its own squares plus every square whose centre falls inside its cone and
 * that a straight line from the token reaches without crossing a wall or a closed door.
 * Range is counted from the token's edge (a Medium hero with 12 squares sees 60 ft around it).
 */
export function tokenSight(token: MapToken, cols: number, rows: number, blocked: Set<string> = new Set()): Set<string> {
  const cells = new Set(coveredSquares(token));
  const vision = tokenVision(token);
  if (!vision) return cells;
  const cone = sightCone(token, vision);
  const [left, right] = reachSpan(cone.cx, cone.reach, cols);
  const [top, bottom] = reachSpan(cone.cy, cone.reach, rows);
  for (let x = left; x <= right; x++) for (let y = top; y <= bottom; y++) {
    if (inCone(cone, x, y) && hasLineOfSight(cone, x, y, blocked)) cells.add(`${x},${y}`);
  }
  return cells;
}

/** A token's cone in squares: its centre, how far it reaches from there (range plus half the token) and which way it looks. */
interface SightCone { cx: number; cy: number; reach: number; facing: number; angle: number }

function sightCone(token: MapToken, vision: TokenVision): SightCone {
  return {
    cx: token.x + token.size / 2, cy: token.y + token.size / 2,
    reach: vision.range + token.size / 2, facing: facingScreenAngle(token.facing), angle: vision.angle,
  };
}

/** Slack for squares whose centre lies right on the edge of a cone. */
const SIGHT_EPSILON = 1e-9;

/** First and last column (or row) within `reach` of `centre`, inside a grid `length` squares long. */
function reachSpan(centre: number, reach: number, length: number): [number, number] {
  return [Math.max(0, Math.floor(centre - reach)), Math.min(length - 1, Math.ceil(centre + reach))];
}

/** Does the centre of square (x, y) fall inside the cone, both in range and in angle? */
function inCone(cone: SightCone, x: number, y: number): boolean {
  const px = x + 0.5 - cone.cx;
  const py = y + 0.5 - cone.cy;
  if (Math.hypot(px, py) > cone.reach + SIGHT_EPSILON) return false;
  return !(cone.angle < 360 && angleGap(Math.atan2(py, px) * 180 / Math.PI, cone.facing) > cone.angle / 2 + SIGHT_EPSILON);
}

/**
 * Does a straight line from the cone's centre reach some part of square (x, y) without crossing a blocking edge?
 * The lines start nudged off the exact centre so they never run through a grid corner exactly.
 */
function hasLineOfSight(cone: SightCone, x: number, y: number, blocked: Set<string>): boolean {
  if (!blocked.size) return true;
  const ox = cone.cx + 1.3e-4;
  const oy = cone.cy + 0.7e-4;
  return SIGHT_SAMPLES.some(([sx, sy]) => lineIsClear(ox, oy, x + sx, y + sy, blocked));
}

/** Squares the party sees together: the union of every hero's sight. */
export function partySight(state: MapState): Set<string> {
  const cells = new Set<string>();
  const blocked = blockingEdges(state.walls);
  for (const token of state.tokens) if (token.kind === "hero") for (const cell of tokenSight(token, state.cols, state.rows, blocked)) cells.add(cell);
  return cells;
}

/** Squares the party has explored (see MapState.explored). */
export const exploredCells = (state: MapState) => bitmapCells(state.explored, state.cols, state.rows);

/** What the party sees now: the server's answer in the players' view, otherwise worked out here. */
export const currentSight = (state: MapState) => state.sight !== undefined ? bitmapCells(state.sight, state.cols, state.rows) : partySight(state);

function bitmapCells(hex: string | undefined = "", cols: number, rows: number): Set<string> {
  const cells = new Set<string>();
  const state = { cols, rows };
  for (let i = 0; i < state.cols * state.rows; i++) {
    const nibble = parseInt(hex[i >> 2] ?? "0", 16);
    if (nibble & (8 >> (i & 3))) cells.add(`${i % state.cols},${Math.floor(i / state.cols)}`);
  }
  return cells;
}

function encodeExplored(cols: number, rows: number, cells: Set<string>): string {
  let hex = "";
  for (let i = 0; i < cols * rows; i += 4) {
    let nibble = 0;
    for (let bit = 0; bit < 4 && i + bit < cols * rows; bit++) {
      const n = i + bit;
      if (cells.has(`${n % cols},${Math.floor(n / cols)}`)) nibble |= 8 >> bit;
    }
    hex += nibble.toString(16);
  }
  return hex;
}

/** Add what the party sees now to what it has explored (only while the fog is on). */
function remember(state: MapState): MapState {
  if (!state.fog) return state;
  return { ...state, explored: encodeExplored(state.cols, state.rows, seenCells(state, partySight(state))) };
}

/** Squares on either side of a unit edge. */
function edgeCells(edge: string): [string, string] {
  const [kind, rest] = edge.split(":");
  const [x, y] = rest.split(",").map(Number);
  return kind === "h" ? [`${x},${y - 1}`, `${x},${y}`] : [`${x - 1},${y}`, `${x},${y}`];
}

/** The unit edges a wall covers, in order. */
function wallEdges(wall: MapWall): string[] {
  return wall.y1 === wall.y2
    ? Array.from({ length: wall.x2 - wall.x1 }, (_, i) => `h:${wall.x1 + i},${wall.y1}`)
    : Array.from({ length: wall.y2 - wall.y1 }, (_, i) => `v:${wall.x1},${wall.y1 + i}`);
}

/**
 * The walls players may know about: only the stretches next to a square they see or have explored, so the
 * layout of the rest of the dungeon doesn't reach them. Doors are kept whole, since they open as one piece.
 */
function knownWalls(walls: MapWall[], seen: Set<string>): MapWall[] {
  const known: MapWall[] = [];
  const isSeen = (edge: string) => edgeCells(edge).some((cell) => seen.has(cell));
  for (const wall of walls) {
    const edges = wallEdges(wall);
    if (wall.door) { if (edges.some(isSeen)) known.push(wall); continue; }
    let run: number | null = null;
    const horizontal = wall.y1 === wall.y2;
    const flush = (end: number) => {
      if (run === null) return;
      known.push(horizontal ? { x1: wall.x1 + run, y1: wall.y1, x2: wall.x1 + end, y2: wall.y1 } : { x1: wall.x1, y1: wall.y1 + run, x2: wall.x1, y2: wall.y1 + end });
      run = null;
    };
    edges.forEach((edge, i) => { if (isSeen(edge)) run ??= i; else flush(i); });
    flush(edges.length);
  }
  return known;
}

/** The squares ("x,y") a token covers, column by column. */
function coveredSquares(token: Pick<MapToken, "x" | "y" | "size">): string[] {
  const cells: string[] = [];
  for (let dx = 0; dx < token.size; dx++) for (let dy = 0; dy < token.size; dy++) cells.push(`${token.x + dx},${token.y + dy}`);
  return cells;
}

/** Is any square of this token in sight? */
export const tokenInSight = (token: MapToken, sight: Set<string>) => coveredSquares(token).some((cell) => sight.has(cell));

/**
 * What a viewer may see: players (and the table display) never receive hidden monsters, and with fog of war
 * they don't receive monsters outside every hero's vision either.
 */
export function visibleMapState(state: MapState, showHidden: boolean): MapState {
  if (showHidden) return state;
  const sight = state.fog ? partySight(state) : null;
  const visible: MapState = { ...state, tokens: state.tokens.filter((token) => isSentToPlayers(token, sight)) };
  if (sight) showOnlySeen(visible, state, sight);
  if (state.combat) visible.combat = playersCombat(state.combat, visible.tokens);
  return visible;
}

/** Do players receive this token? Never while hidden; with fog of war (`sight` given), a monster only while the party sees it. */
function isSentToPlayers(token: MapToken, sight: Set<string> | null): boolean {
  return !token.hidden && (!sight || token.kind !== "monster" || tokenInSight(token, sight));
}

/**
 * Fog of war in the players' copy: only the walls next to squares the party sees or has explored (no walls at all
 * when it knows none), and the party's sight worked out with every wall.
 */
function showOnlySeen(visible: MapState, state: MapState, sight: Set<string>): void {
  if (state.walls) {
    const walls = knownWalls(state.walls, seenCells(state, sight));
    if (walls.length) visible.walls = walls; else delete visible.walls;
  }
  visible.sight = encodeExplored(state.cols, state.rows, sight);
}

/** Squares the party has explored plus those it sees now. */
function seenCells(state: MapState, sight: Iterable<string>): Set<string> {
  const seen = exploredCells(state);
  for (const cell of sight) seen.add(cell);
  return seen;
}

/**
 * The fight in the players' copy: only the creatures they receive, no monster speeds or movement (those come from
 * the DM's stat blocks), and whose turn it is only while they can see that creature.
 */
function playersCombat(combat: MapCombat, sent: MapToken[]): MapCombat {
  const shown = new Map(sent.map((token) => [token.id, token]));
  const order = combat.order.flatMap((entry) => {
    const token = shown.get(entry.tokenId);
    if (!token) return [];
    return [token.kind === "monster" ? { tokenId: entry.tokenId, initiative: entry.initiative } : entry];
  });
  const active = combat.active && shown.has(combat.active) ? combat.active : undefined;
  return { round: combat.round, order, ...(active ? { active } : {}) };
}

/** Who is looking: a DM sees hidden monsters unless they asked for the players' view (e.g. the table display). */
export type MapAudience = "auto" | "players";

/** A campaign's map as stored (the battle_map row); undefined before the campaign has one. */
export interface StoredMap { state: unknown; version: number; updatedAt: Date }

/** The map as one viewer receives it; the API adds which campaign it belongs to. */
export interface MapViewerState {
  version: number;
  /** Owner, co-DM or site admin: may add monsters, hide/reveal, resize. */
  isDm: boolean;
  /** Hidden monsters are included (DM with the DM view). */
  showsHidden: boolean;
  heroes: (MapHero & { mine: boolean })[];
  state: MapState;
  updatedAt: string;
}

/**
 * What one viewer receives of a stored map: the state read safely (an empty map before there is one),
 * hero tokens in step with the campaign, and only what this viewer and audience may see.
 */
export function viewMap(stored: StoredMap | undefined, heroes: MapHero[], viewer: MapActor & { audience: MapAudience }): MapViewerState {
  const showsHidden = viewer.isDm && viewer.audience !== "players";
  const state = syncHeroes(normalizeMapState(stored?.state ?? emptyMapState()), heroes);
  return {
    version: stored?.version ?? 0,
    isDm: viewer.isDm,
    showsHidden,
    heroes: heroes.map((hero) => ({ ...hero, mine: hero.ownerId === viewer.userId })),
    state: visibleMapState(state, showsHidden),
    updatedAt: (stored?.updatedAt ?? new Date(0)).toISOString(),
  };
}

/** May a token take one step of (dx, dy) squares? Diagonal steps can't slip past the end or the corner of a wall. */
function stepIsClear(token: Pick<MapToken, "x" | "y" | "size">, dx: number, dy: number, blocked: Set<string>): boolean {
  for (let i = 0; i < token.size; i++) for (let j = 0; j < token.size; j++) {
    const cx = token.x + i;
    const cy = token.y + j;
    const inside = (x: number, y: number) => x >= token.x && x < token.x + token.size && y >= token.y && y < token.y + token.size;
    if (inside(cx + dx, cy + dy)) continue;
    if (dx && dy) {
      const X = cx + (dx > 0 ? 1 : 0);
      const Y = cy + (dy > 0 ? 1 : 0);
      if ([`h:${X - 1},${Y}`, `h:${X},${Y}`, `v:${X},${Y - 1}`, `v:${X},${Y}`].some((edge) => blocked.has(edge))) return false;
    } else if (dx) {
      if (blocked.has(`v:${dx > 0 ? cx + 1 : cx},${cy}`)) return false;
    } else if (blocked.has(`h:${cx},${dy > 0 ? cy + 1 : cy}`)) return false;
  }
  return true;
}

/**
 * Fewest steps the token needs to reach each spot it can get to without crossing a wall or a closed door, keyed
 * "x,y" by its top-left square. Every step costs one square, diagonals too (the 2024 grid rules). Stops looking
 * past `limit` steps, or as soon as it gets to `target`.
 */
export function movementSteps(state: MapState, token: Pick<MapToken, "x" | "y" | "size">, limit = Infinity, target?: { x: number; y: number }): Map<string, number> {
  const blocked = blockingEdges(state.walls);
  const maxX = state.cols - token.size;
  const maxY = state.rows - token.size;
  const steps = new Map([[`${token.x},${token.y}`, 0]]);
  const queue: [number, number][] = [[token.x, token.y]];
  for (let head = 0; head < queue.length; head++) {
    const [px, py] = queue[head];
    const here = steps.get(`${px},${py}`)!;
    if (here >= limit) continue;
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
      const nx = px + dx;
      const ny = py + dy;
      const key = `${nx},${ny}`;
      if ((!dx && !dy) || nx < 0 || ny < 0 || nx > maxX || ny > maxY || steps.has(key)) continue;
      if (!stepIsClear({ x: px, y: py, size: token.size }, dx, dy, blocked)) continue;
      steps.set(key, here + 1);
      if (target && nx === target.x && ny === target.y) return steps;
      queue.push([nx, ny]);
    }
  }
  return steps;
}

/** Squares the token walks to get to (x, y) the shortest way round walls; null when no path gets there. */
export function pathLength(state: MapState, token: MapToken, x: number, y: number): number | null {
  if (token.x === x && token.y === y) return 0;
  if (!state.walls?.some((wall) => wall.door !== "open")) return Math.max(Math.abs(x - token.x), Math.abs(y - token.y));
  return movementSteps(state, token, Infinity, { x, y }).get(`${x},${y}`) ?? null;
}

/** Can the token walk to (x, y) without crossing a wall or a closed door, by any path? */
export const canReach = (state: MapState, token: MapToken, x: number, y: number) => pathLength(state, token, x, y) !== null;

/** Squares a combatant may move this turn (twice its speed after a Dash); null when its speed isn't known. */
export const movementBudget = (entry: Combatant) => entry.speed === undefined ? null : entry.speed * (entry.dash ? 2 : 1);

/** The token's place in the fight, if it's in one. */
export const combatantOf = (state: MapState, tokenId: string) => state.combat?.order.find((entry) => entry.tokenId === tokenId);

/** A new turn begins for the active creature: its movement and Dash start over. */
function startTurn(combat: MapCombat): MapCombat {
  return { ...combat, order: combat.order.map((entry) => {
    if (entry.tokenId !== combat.active) return entry;
    const fresh = { ...entry };
    delete fresh.moved;
    delete fresh.dash;
    return fresh;
  }) };
}

/**
 * Pass the turn `step` places along the order from position `from`, wrapping into the next (or previous) round.
 * Defeated monsters are skipped; defeated heroes still get their turn, for death saving throws.
 */
function passTurn(combat: MapCombat, tokens: MapToken[], step: 1 | -1, from = combat.order.findIndex((entry) => entry.tokenId === combat.active)): MapCombat {
  const { order } = combat;
  if (!order.length) return { round: combat.round, order };
  const byId = new Map(tokens.map((token) => [token.id, token]));
  const skip = (entry: Combatant) => { const token = byId.get(entry.tokenId); return token?.kind === "monster" && token.defeated === true; };
  let index = from;
  let round = combat.round;
  for (let tries = 0; tries < order.length; tries++) {
    index += step;
    if (index >= order.length) { index = 0; round += 1; }
    else if (index < 0) { index = order.length - 1; round -= 1; }
    if (!skip(order[index])) break;
  }
  return startTurn({ round: Math.max(1, Math.min(COMBAT_MAX_ROUND, round)), order, active: order[index].tokenId });
}

/** Take creatures out of the fight; when the one whose turn it is leaves, the turn goes to whoever came next. */
function dropCombatants(combat: MapCombat, tokens: MapToken[], keep: (tokenId: string) => boolean): MapCombat {
  const order = combat.order.filter((entry) => keep(entry.tokenId));
  if (order.length === combat.order.length) return combat;
  if (!combat.active || keep(combat.active)) return { ...combat, order };
  const index = combat.order.findIndex((entry) => entry.tokenId === combat.active);
  const before = combat.order.slice(0, Math.max(0, index)).filter((entry) => keep(entry.tokenId)).length;
  return passTurn({ round: combat.round, order }, tokens, 1, before - 1);
}

/** Drop from the fight the creatures no longer on the map. */
function pruneCombat(state: MapState): MapState {
  if (!state.combat) return state;
  const ids = new Set(state.tokens.map((token) => token.id));
  const combat = dropCombatants(state.combat, state.tokens, (id) => ids.has(id));
  return combat === state.combat ? state : { ...state, combat };
}

/** Is the token close enough to the door to open it? Measured between the token's squares and the door, in squares. */
export function nearDoor(token: Pick<MapToken, "x" | "y" | "size">, door: Pick<MapWall, "x1" | "y1" | "x2" | "y2">): boolean {
  const gapX = Math.max(0, door.x1 - (token.x + token.size), token.x - door.x2);
  const gapY = Math.max(0, door.y1 - (token.y + token.size), token.y - door.y2);
  return Math.hypot(gapX, gapY) <= DOOR_REACH;
}

/** Squares covered by tokens, to place new ones without stacking them. */
function occupied(state: MapState): Set<string> {
  const cells = new Set<string>();
  for (const token of state.tokens) for (const cell of coveredSquares(token)) cells.add(cell);
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

/**
 * "blocked": a player tried to walk through a wall or a closed door. "turn": a player moved a hero in the fight
 * outside its turn. "movement": that move needs more than the hero has left this turn.
 */
export type MapOpError = "forbidden" | "invalid" | "blocked" | "turn" | "movement";
export type MapApplyResult = { ok: true; state: MapState } | { ok: false; error: MapOpError };

/** May this actor move or remove the token? DMs: any. Players: only heroes of their own characters. */
export function canControlToken(actor: MapActor, token: MapToken, heroes: MapHero[]): boolean {
  if (actor.isDm) return true;
  if (token.kind !== "hero") return false;
  return heroes.some((hero) => hero.id === token.characterId && hero.ownerId === actor.userId);
}

/** Who makes a batch of changes, and what applying it needs from outside the map. */
interface ApplyContext {
  actor: MapActor;
  heroes: MapHero[];
  newId: () => string;
}
/** Applies one change to the state so far; never touches the state it is given. */
type Applier<K extends MapOpType> = (state: MapState, op: MapOpOf<K>, context: ApplyContext) => MapApplyResult;
/** A creature in the fight: the fight itself and its place in the order. */
interface Fighter { combat: MapCombat; entry: Combatant }

const done = (state: MapState): MapApplyResult => ({ ok: true, state });
const refuse = (error: MapOpError): MapApplyResult => ({ ok: false, error });

const findToken = (state: MapState, tokenId: string | undefined) => state.tokens.find((token) => token.id === tokenId);
/** The state with `change` made to the token(s) with this id. */
const changeToken = (state: MapState, tokenId: string, change: (token: MapToken) => MapToken): MapState =>
  ({ ...state, tokens: state.tokens.map((token) => token.id === tokenId ? change(token) : token) });

/** The state with these walls; with none at all the field goes. */
function withWalls(state: MapState, walls: MapWall[]): MapState {
  const next: MapState = { ...state, walls };
  if (!walls.length) delete next.walls;
  return next;
}

/** Token flags are stored only while true. */
function withTokenFlag(token: MapToken, flag: "hidden" | "defeated", on: boolean | undefined): MapToken {
  if (on === undefined) return token;
  const next = { ...token };
  if (on) next[flag] = true; else delete next[flag];
  return next;
}

/** The token's fight and place in it, when it's in one. */
function fighterOf(state: MapState, tokenId: string): Fighter | null {
  const entry = combatantOf(state, tokenId);
  return state.combat && entry ? { combat: state.combat, entry } : null;
}

/** The fight with one creature's entry changed. */
const changeEntry = (combat: MapCombat, tokenId: string, change: (entry: Combatant) => Combatant): MapCombat =>
  ({ ...combat, order: combat.order.map((entry) => entry.tokenId === tokenId ? change(entry) : entry) });

/** Would walking `cost` more squares take the combatant past its movement for the turn? */
function overBudget(entry: Combatant, cost: number): boolean {
  const budget = movementBudget(entry);
  return budget !== null && (entry.moved ?? 0) + cost > budget;
}

/** Squares a walk costs: the way round the walls or, when there is none, straight there for the DM (null for players). */
function walkCost(state: MapState, token: MapToken, moved: MapToken, isDm: boolean): number | null {
  const path = pathLength(state, token, moved.x, moved.y);
  if (path !== null || !isDm) return path;
  return Math.max(Math.abs(moved.x - token.x), Math.abs(moved.y - token.y));
}

/**
 * Walk a token to (x, y). Walls hold players back and, in a fight, so do whose turn it is and the movement
 * left; the DM can still put anything anywhere. Movement in a fight is counted for everyone.
 */
function walk(state: MapState, token: MapToken, x: number, y: number, isDm: boolean): MapApplyResult {
  const moved = clampToken({ ...token, x, y }, state.cols, state.rows);
  if (moved.x === token.x && moved.y === token.y) return done(state);
  const fighter = fighterOf(state, token.id);
  if (fighter) return walkInFight(state, fighter, token, moved, isDm);
  return isDm || canReach(state, token, moved.x, moved.y) ? done(changeToken(state, token.id, () => moved)) : refuse("blocked");
}

function walkInFight(state: MapState, { combat, entry }: Fighter, token: MapToken, moved: MapToken, isDm: boolean): MapApplyResult {
  if (!isDm && combat.active !== token.id) return refuse("turn");
  const cost = walkCost(state, token, moved, isDm);
  if (cost === null) return refuse("blocked");
  if (!isDm && overBudget(entry, cost)) return refuse("movement");
  const spent = changeEntry(combat, token.id, (item) => ({ ...item, moved: Math.min(COMBAT_MAX_MOVED, (item.moved ?? 0) + cost) }));
  return done(changeToken({ ...state, combat: spent }, token.id, () => moved));
}

function applyMove(state: MapState, op: MapOpOf<"move">, { actor, heroes }: ApplyContext): MapApplyResult {
  const token = findToken(state, op.tokenId);
  if (!token) return refuse("invalid");
  if (!canControlToken(actor, token, heroes)) return refuse("forbidden");
  return walk(state, token, op.x, op.y, actor.isDm);
}

/** Where a hero goes: the square asked for, else where it already stands, else the first free one from the left. */
function heroSpot(state: MapState, op: MapOpOf<"place-hero">, existing: MapToken | undefined): { x: number; y: number } {
  if (op.x !== undefined && op.y !== undefined) return { x: op.x, y: op.y };
  return existing ?? findFreeSpot(state, 1, "left");
}

function addHero(state: MapState, hero: MapHero, spot: { x: number; y: number }, newId: () => string): MapApplyResult {
  if (state.tokens.length >= MAP_MAX_TOKENS) return refuse("invalid");
  const token = clampToken({ id: newId(), kind: "hero", label: label(hero.name) ?? "?", characterId: hero.id, size: 1, ...spot }, state.cols, state.rows);
  return done({ ...state, tokens: [...state.tokens, token] });
}

/** Each character has one hero token: placing it again walks it there. */
function applyPlaceHero(state: MapState, op: MapOpOf<"place-hero">, { actor, heroes, newId }: ApplyContext): MapApplyResult {
  const hero = heroes.find((item) => item.id === op.characterId);
  if (!hero) return refuse("invalid");
  if (!actor.isDm && hero.ownerId !== actor.userId) return refuse("forbidden");
  const existing = state.tokens.find((item) => item.kind === "hero" && item.characterId === hero.id);
  const spot = heroSpot(state, op, existing);
  return existing ? walk(state, existing, spot.x, spot.y, actor.isDm) : addHero(state, hero, spot, newId);
}

/** Several monsters at once are numbered on from the ones already on the map ("Goblin 3", "Goblin 4"…). */
function applyAddMonster(state: MapState, op: MapOpOf<"add-monster">, { newId }: ApplyContext): MapApplyResult {
  if (state.tokens.length + op.count > MAP_MAX_TOKENS) return refuse("invalid");
  const first = nextNumber(state, op.label);
  let next = state;
  for (let index = 0; index < op.count; index++) {
    const name = op.count > 1 ? `${op.label.slice(0, TOKEN_LABEL_MAX - 4)} ${first + index}` : op.label;
    const spot = findFreeSpot(next, op.size, "right");
    next = { ...next, tokens: [...next.tokens, clampToken({
      id: newId(), kind: "monster", label: name, size: op.size, ...spot,
      ...(op.hidden ? { hidden: true } : {}), ...(op.monsterSlug ? { monsterSlug: op.monsterSlug } : {}),
    }, next.cols, next.rows)] };
  }
  return done(next);
}

/** Heroes take their name and stat block from their character, and are never hidden. */
const touchesMonsterFields = (op: MapOpOf<"update">) => op.label !== undefined || op.hidden !== undefined || op.monsterSlug !== undefined;

function updatedToken(token: MapToken, op: MapOpOf<"update">): MapToken {
  const next: MapToken = {
    ...token, ...(op.label !== undefined ? { label: op.label } : {}), ...(op.size !== undefined ? { size: op.size } : {}),
    ...(op.vision !== undefined ? { vision: op.vision } : {}), ...(op.monsterSlug !== undefined ? { monsterSlug: op.monsterSlug } : {}),
  };
  return withTokenFlag(withTokenFlag(next, "hidden", op.hidden), "defeated", op.defeated);
}

function applyUpdate(state: MapState, op: MapOpOf<"update">): MapApplyResult {
  const token = findToken(state, op.tokenId);
  if (!token) return refuse("invalid");
  if (token.kind === "hero" && touchesMonsterFields(op)) return refuse("invalid");
  return done(changeToken(state, token.id, (item) => clampToken(updatedToken(item, op), state.cols, state.rows)));
}

/** Facing north is the default and isn't stored. */
function withFacing(token: MapToken, facing: Facing): MapToken {
  const next: MapToken = { ...token, facing };
  if (facing === 0) delete next.facing;
  return next;
}

function applyFace(state: MapState, op: MapOpOf<"face">, { actor, heroes }: ApplyContext): MapApplyResult {
  const token = findToken(state, op.tokenId);
  if (!token) return refuse("invalid");
  if (!canControlToken(actor, token, heroes)) return refuse("forbidden");
  return done(changeToken(state, token.id, (item) => withFacing(item, op.facing)));
}

/** Switching the fog off, or asking to, forgets what the party explored. */
function applySettings(state: MapState, op: MapOpOf<"settings">): MapApplyResult {
  const next: MapState = { ...state };
  if (op.fog !== undefined) { if (op.fog) next.fog = true; else delete next.fog; }
  if (op.gridHidden !== undefined) { if (op.gridHidden) next.gridHidden = true; else delete next.gridHidden; }
  if (op.resetExplored || !next.fog) delete next.explored;
  return done(next);
}

function applyAddWalls(state: MapState, op: MapOpOf<"add-walls">): MapApplyResult {
  const walls = [...state.walls ?? []];
  for (const added of op.walls) {
    const wall = clipWall(added, state.cols, state.rows);
    if (!wall) return refuse("invalid");
    const same = walls.findIndex((item) => sameSpan(item, wall));
    if (same >= 0) walls[same] = wall; // drawing over a wall turns it into a door or back
    else walls.push(wall);
  }
  return walls.length > MAP_MAX_WALLS ? refuse("invalid") : done({ ...state, walls });
}

function applyRemoveWall(state: MapState, op: MapOpOf<"remove-wall">): MapApplyResult {
  return done(withWalls(state, (state.walls ?? []).filter((wall) => !sameSpan(wall, op))));
}

/**
 * The DM uses any door; players only one next to a hero of their own. A missing door is out of a player's reach
 * too, so probing coordinates can't reveal doors hidden in the fog.
 */
function mayUseDoor(state: MapState, door: MapWall | undefined, { actor, heroes }: ApplyContext): boolean {
  if (actor.isDm) return true;
  return door !== undefined && state.tokens.some((token) => token.kind === "hero" && canControlToken(actor, token, heroes) && nearDoor(token, door));
}

function applyDoor(state: MapState, op: MapOpOf<"door">, context: ApplyContext): MapApplyResult {
  const walls = state.walls ?? [];
  const door = walls.find((wall) => wall.door && sameSpan(wall, op));
  if (!mayUseDoor(state, door, context)) return refuse("forbidden");
  if (!door) return refuse("invalid");
  const turned: MapWall = { ...door, door: op.open ? "open" : "closed" };
  return done({ ...state, walls: walls.map((wall) => wall === door ? turned : wall) });
}

function applyClearWalls(state: MapState): MapApplyResult {
  return done(withWalls(state, []));
}

function applyRemove(state: MapState, op: MapOpOf<"remove">, { actor, heroes }: ApplyContext): MapApplyResult {
  const token = findToken(state, op.tokenId);
  if (!token) return done(state); // already gone: removing twice is harmless
  if (!canControlToken(actor, token, heroes)) return refuse("forbidden");
  return done({ ...state, tokens: state.tokens.filter((item) => item.id !== token.id) });
}

function applyClearMonsters(state: MapState): MapApplyResult {
  return done({ ...state, tokens: state.tokens.filter((token) => token.kind !== "monster") });
}

/** Tokens and walls are cut to the new grid. */
function applyResize(state: MapState, op: MapOpOf<"resize">): MapApplyResult {
  const walls = (state.walls ?? []).map((wall) => clipWall(wall, op.cols, op.rows)).filter((wall): wall is MapWall => wall !== null);
  const next = withWalls({ ...state, cols: op.cols, rows: op.rows, tokens: state.tokens.map((token) => clampToken(token, op.cols, op.rows)) }, walls);
  delete next.explored; // the bitmap is laid out for the old size
  return done(next);
}

function applyCombatStart(state: MapState, op: MapOpOf<"combat-start">): MapApplyResult {
  const ids = new Set(state.tokens.map((token) => token.id));
  if (!op.entries.every((entry) => ids.has(entry.tokenId))) return refuse("invalid");
  return done({ ...state, combat: passTurn({ round: 1, order: sortOrder(op.entries.map((entry) => ({ ...entry }))) }, state.tokens, 1, -1) });
}

/** The entry with the change made; speed null forgets it, movement 0 resets it. */
function editedCombatant(entry: Combatant, op: MapOpOf<"combatant">): Combatant {
  const next: Combatant = { ...entry };
  if (op.initiative !== undefined) next.initiative = op.initiative;
  if (op.speed === null) delete next.speed; else if (op.speed !== undefined) next.speed = op.speed;
  if (op.moved === 0) delete next.moved; else if (op.moved !== undefined) next.moved = op.moved;
  return next;
}

/** The order with the entry in it: in its old place when its initiative didn't change, else sorted in. */
function placeInOrder(order: Combatant[], entry: Combatant, keepPlace: boolean): Combatant[] {
  if (keepPlace) return order.map((item) => item.tokenId === entry.tokenId ? entry : item);
  return sortOrder([...order.filter((item) => item.tokenId !== entry.tokenId), entry]);
}

/** A creature joins the fight (it needs an initiative for that) or its entry changes. */
function applyCombatant(state: MapState, op: MapOpOf<"combatant">): MapApplyResult {
  const combat = state.combat;
  if (!combat || !findToken(state, op.tokenId)) return refuse("invalid");
  const existing = combatantOf(state, op.tokenId);
  const base = existing ?? (op.initiative === undefined ? null : { tokenId: op.tokenId, initiative: op.initiative });
  if (!base) return refuse("invalid");
  const order = placeInOrder(combat.order, editedCombatant(base, op), existing !== undefined && op.initiative === undefined);
  const next = { ...combat, order };
  return done({ ...state, combat: next.active ? next : passTurn(next, state.tokens, 1, -1) });
}

function applyCombatLeave(state: MapState, op: MapOpOf<"combat-leave">): MapApplyResult {
  return done(state.combat ? { ...state, combat: dropCombatants(state.combat, state.tokens, (id) => id !== op.tokenId) } : state);
}

/** The DM hands the turn straight to a creature in the fight. */
function jumpTurn(state: MapState, combat: MapCombat, tokenId: string, actor: MapActor): MapApplyResult {
  if (!actor.isDm) return refuse("forbidden");
  if (!combatantOf(state, tokenId)) return refuse("invalid");
  return done({ ...state, combat: startTurn({ ...combat, active: tokenId }) });
}

/** Players end their own hero's turn; only the DM goes back. */
function stepTurn(state: MapState, combat: MapCombat, step: 1 | -1, { actor, heroes }: ApplyContext): MapApplyResult {
  const active = findToken(state, combat.active);
  if (!actor.isDm && (step === -1 || !active || !canControlToken(actor, active, heroes))) return refuse("forbidden");
  return done({ ...state, combat: passTurn(combat, state.tokens, step) });
}

function applyTurn(state: MapState, op: MapOpOf<"turn">, context: ApplyContext): MapApplyResult {
  const combat = state.combat;
  if (!combat?.order.length) return refuse("invalid");
  return "tokenId" in op ? jumpTurn(state, combat, op.tokenId, context.actor) : stepTurn(state, combat, op.step, context);
}

function withDash(entry: Combatant, dash: boolean): Combatant {
  const next = { ...entry };
  if (dash) next.dash = true; else delete next.dash;
  return next;
}

/** A player dashes with their own hero on its turn. */
function applyDash(state: MapState, op: MapOpOf<"dash">, { actor, heroes }: ApplyContext): MapApplyResult {
  const token = findToken(state, op.tokenId);
  const fighter = fighterOf(state, op.tokenId);
  if (!token || !fighter) return refuse("invalid");
  if (!actor.isDm && (!canControlToken(actor, token, heroes) || fighter.combat.active !== token.id)) return refuse("forbidden");
  return done({ ...state, combat: changeEntry(fighter.combat, token.id, (entry) => withDash(entry, op.dash)) });
}

function applyCombatEnd(state: MapState): MapApplyResult {
  const next: MapState = { ...state };
  delete next.combat;
  return done(next);
}

/** Changes only the DM may make: a player is refused before anything else is looked at. */
const dmOnly = <K extends MapOpType>(apply: Applier<K>): Applier<K> => (state, op, context) => context.actor.isDm ? apply(state, op, context) : refuse("forbidden");

/**
 * One applier per kind of change; the mapped type makes the compiler ask for one with every new variant.
 * The DM-only ones are wrapped in dmOnly; the rest check for themselves whose token, hero, door or turn it is.
 */
const opAppliers: { [K in MapOpType]: Applier<K> } = {
  move: applyMove,
  "place-hero": applyPlaceHero,
  "add-monster": dmOnly(applyAddMonster),
  update: dmOnly(applyUpdate),
  face: applyFace,
  settings: dmOnly(applySettings),
  "add-walls": dmOnly(applyAddWalls),
  "remove-wall": dmOnly(applyRemoveWall),
  door: applyDoor,
  "clear-walls": dmOnly(applyClearWalls),
  remove: applyRemove,
  "clear-monsters": dmOnly(applyClearMonsters),
  resize: dmOnly(applyResize),
  "combat-start": dmOnly(applyCombatStart),
  combatant: dmOnly(applyCombatant),
  "combat-leave": dmOnly(applyCombatLeave),
  turn: applyTurn,
  dash: applyDash,
  "combat-end": dmOnly(applyCombatEnd),
};

function applyOp<K extends MapOpType>(state: MapState, op: MapOpOf<K>, context: ApplyContext): MapApplyResult {
  const apply: Applier<K> = opAppliers[op.type];
  return apply(state, op, context);
}

/**
 * Apply a batch of changes atomically: if any one is not allowed the whole batch is rejected.
 * `newId` makes token ids (random on the server, predictable in tests).
 */
export function applyMapOps(start: MapState, ops: MapOp[], actor: MapActor, heroes: MapHero[], newId: () => string): MapApplyResult {
  const context: ApplyContext = { actor, heroes, newId };
  let state: MapState = { ...start, tokens: [...start.tokens] };
  for (const op of ops) {
    const result = applyOp(state, op, context);
    if (!result.ok) return result;
    state = result.state;
  }
  return done(remember(pruneCombat(state)));
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

// ---- Saved maps: the decisions behind the saves routes of apps/api/src/map/map.service.ts ----

/** Saved maps a campaign may keep, and the longest name. */
export const MAP_MAX_SAVES = 20;
export const MAP_SAVE_NAME_MAX = 60;

/** Does a campaign already keep as many saved maps as it may? `storedCount` is count(*) as PostgreSQL returns it. */
export const mapSavesFull = (storedCount: string | undefined) => Number(storedCount ?? 0) >= MAP_MAX_SAVES;

/** The state a save keeps: the map as it is, minus the background key (the picture itself is copied next to it). */
export function mapStateToSave(state: MapState): MapState {
  const stored: MapState = { ...state };
  delete stored.background;
  return stored;
}

/** DM-only map routes: someone outside the campaign (no viewer) gets not-found, so it doesn't show; a player gets forbidden. */
export function requireDm<Viewer extends { isDm: boolean }>(viewer: Viewer | null): { ok: true; value: Viewer } | { ok: false; error: "not-found" | "forbidden" } {
  if (!viewer) return { ok: false, error: "not-found" };
  if (!viewer.isDm) return { ok: false, error: "forbidden" };
  return { ok: true, value: viewer };
}

/** A saved map as stored: its state and the background picture kept with it. `Image` is the picture's bytes. */
export interface MapSaveRow<Image> { state: unknown; image: Image | null; mimeType: MapImageType | null }

/**
 * What loading a save (or, with null, clearing the table) puts on the table: the state read safely, hero tokens
 * of characters that left the campaign dropped, and no background key, since the old one points at the previous
 * picture. `picture` is the save's own background, to store again under a new key; null when it has none.
 */
export function mapFromSave<Image>(save: MapSaveRow<Image> | null, heroes: MapHero[]): { state: MapState; picture: { image: Image; mimeType: MapImageType } | null } {
  const state = syncHeroes({ ...(save ? normalizeMapState(save.state) : emptyMapState()) }, heroes);
  delete state.background;
  const picture = save?.image && save.mimeType ? { image: save.image, mimeType: save.mimeType } : null;
  return { state, picture };
}
