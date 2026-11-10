"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type CSSProperties, type KeyboardEvent, type MouseEvent, type PointerEvent } from "react";
import Link from "next/link";
import { api, ApiError, type SavedEncounter } from "@/lib/api-client";
import type { MapSaveSummary } from "@/lib/battle-map-data";
import {
  applyMapOps, blockingEdges, canControlToken, columnName, currentSight, exploredCells, facingScreenAngle, nearDoor, rowsForImage, squareName,
  tokenInSight, tokenSight, tokenVision,
  DEFAULT_HERO_VISION, MAP_MAX_MONSTERS_PER_ADD, MAP_MAX_SIZE, MAP_MIN_SIZE, TOKEN_LABEL_MAX, VISION_ANGLES,
  type Facing, type MapHero, type MapOp, type MapWall, type MapState, type MapToken, type TokenSize, type VisionAngle,
} from "@/lib/battle-map";
import { Spinner } from "./skeleton";
import styles from "./battle-map.module.css";

type Locale = "en" | "es";

/** Mirrors BattleMapView in src/lib/battle-map-data.ts. */
interface BattleMapView {
  campaignId: string; campaignName: string; version: number; isDm: boolean; showsHidden: boolean;
  heroes: (MapHero & { mine: boolean })[]; state: MapState; updatedAt: string;
}

const text = {
  en: {
    back: "Campaigns", kicker: "BATTLE MAP", live: "Live", connecting: "Connecting…", offline: "Reconnecting…",
    tableMode: "Table display", exitTable: "Exit table display", dmView: "DM view", playersView: "Players' view",
    viewToggle: "What players see", loading: "Unrolling the map…",
    signIn: "Sign in to see this map.", signInAction: "Go to sign in", notFound: "This map isn't available: you're not in that campaign, or it no longer exists.",
    loadError: "The map couldn't be loaded.", retry: "Try again", moveError: "That move couldn't be saved; the map shows the latest state.",
    boardLabel: (name: string) => `Battle map of ${name}`,
    yourHeroes: "Your heroes", heroes: "Heroes", place: "Place on map", onMap: (square: string) => `On ${square}`, select: "Select",
    placeAll: "Place the whole party", noHeroes: "No characters in this campaign yet. Add them from the campaign page.",
    noOwnHeroes: "You have no character in this campaign. Bring one from the campaign page to place it here.",
    howTo: "Tap your token and then the square where you are, or drag it. With the keyboard: Tab to the token, then the arrow keys.",
    selected: "Selected", moveUp: "Move up", moveDown: "Move down", moveLeft: "Move left", moveRight: "Move right", deselect: "Done",
    cannotMove: "Only the DM or its player can move this token.",
    monsters: "Monsters", monsterName: "Name", count: "How many", size: "Size", hiddenNew: "Hidden from players until revealed", add: "Add",
    sizes: { 1: "Medium or smaller", 2: "Large", 3: "Huge", 4: "Gargantuan" } as Record<TokenSize, string>,
    fromJournal: "From the encounter journal", pickEncounter: "Choose a saved encounter", addEncounter: "Add its monsters",
    noEncounters: "No saved encounters in this campaign.",
    onBoard: "On the map", hide: "Hide", reveal: "Reveal", defeat: "Defeated", revive: "Back up", remove: "Remove",
    hiddenTag: "hidden", defeatedTag: "defeated", unseenTag: "out of sight", noMonsters: "No monsters on the map.",
    grid: "Grid", columns: "Columns", rows: "Rows", resize: "Resize", clearMonsters: "Remove all monsters",
    clearConfirm: "Remove every monster from the map?",
    share: "Each player opens this same page on their phone to move their hero:", copy: "Copy link", copied: "Copied",
    legend: "On the table",
    turnLeft: "Turn left", turnRight: "Turn right", facing: "Facing",
    directions: ["north", "north-east", "east", "south-east", "south", "south-west", "west", "north-west"],
    vision: "Vision", visionNone: "None", visionRange: (squares: number) => `${squares * 5} ft`, visionAngle: "Cone",
    angles: { 60: "60°", 90: "90°", 120: "120°", 180: "180°", 360: "All around" } as Record<VisionAngle, string>,
    showCones: "Vision cones",
    keysHint: "Q and E turn the selected token.",
    fog: "Fog of war", fogHint: "Players only see what the heroes' vision cones cover, and monsters standing there.",
    gridLines: "Show grid lines",
    background: "Background", uploadBackground: "Upload picture", replaceBackground: "Replace picture", removeBackground: "Remove picture",
    backgroundHint: "PNG, JPEG, WebP or GIF up to 5 MB. It is stretched over the whole grid.",
    fitRows: (rows: number) => `Match the picture: ${rows} rows`, uploading: "Uploading…",
    uploadError: "The picture couldn't be uploaded. Use a PNG, JPEG, WebP or GIF of 5 MB or less.",
    blocked: "A wall or a closed door is in the way.", tooFar: "Get your hero next to the door to open or close it.",
    openDoor: (square: string) => `Open the door by ${square}`, closeDoor: (square: string) => `Close the door by ${square}`,
    door: "Door", doorOpen: "open", doorClosed: "closed",
    walls: "Walls and doors", wallTool: "Draw", toolWall: "Wall", toolDoor: "Door", toolErase: "Erase", toolOff: "Done",
    wallHint: "Tap a corner of the grid and then another on the same line. Walls keep going from where the last one ended; tap the same corner again to stop. Draw a door over a wall to turn it into one. Walls block sight and players' moves; doors only while closed. The DM can still move anything anywhere.",
    eraseHint: "Tap a wall or a door to remove it.",
    clearWalls: "Remove all walls", clearWallsConfirm: "Remove every wall and door from the map?",
    wallCount: (n: number) => `${n} on the map`,
    forgetExplored: "Forget what was explored",
    saves: "Saved maps", savesHint: "The map on the table is kept on its own after every change. Save a copy to switch to another map and come back to this one another day: it keeps tokens, walls, doors, the fog with what was explored and the background.",
    saveName: "Name", saveAction: "Save this map", saving: "Saving…", load: "Load", deleteSave: "Delete",
    loadConfirm: (name: string) => `Replace the map on the table with "${name}"? Save the current one first if you want to keep it.`,
    deleteConfirm: (name: string) => `Delete the saved map "${name}"?`,
    newMap: "Start an empty map", newMapConfirm: "Clear the table and start an empty map? Save the current one first if you want to keep it.",
    noSaves: "No saved maps yet.", saveError: "That couldn't be done. A campaign keeps up to 20 saved maps.",
    saveSummary: (save: MapSaveSummary, date: string) => `${save.cols}×${save.rows} · ${save.tokens} tokens · ${save.walls} walls${save.hasBackground ? " · picture" : ""} · ${date}`,
  },
  es: {
    back: "Campañas", kicker: "MAPA DE BATALLA", live: "En directo", connecting: "Conectando…", offline: "Reconectando…",
    tableMode: "Modo mesa", exitTable: "Salir del modo mesa", dmView: "Vista del DM", playersView: "Vista de jugadores",
    viewToggle: "Lo que ven los jugadores", loading: "Desplegando el mapa…",
    signIn: "Inicia sesión para ver este mapa.", signInAction: "Ir a iniciar sesión", notFound: "Este mapa no está disponible: no estás en esa campaña o ya no existe.",
    loadError: "No se pudo cargar el mapa.", retry: "Reintentar", moveError: "No se pudo guardar el movimiento; el mapa muestra el estado más reciente.",
    boardLabel: (name: string) => `Mapa de batalla de ${name}`,
    yourHeroes: "Tus héroes", heroes: "Héroes", place: "Poner en el mapa", onMap: (square: string) => `En ${square}`, select: "Seleccionar",
    placeAll: "Colocar a todo el grupo", noHeroes: "Aún no hay personajes en esta campaña. Añádelos desde la página de la campaña.",
    noOwnHeroes: "No tienes ningún personaje en esta campaña. Trae uno desde la página de la campaña para colocarlo aquí.",
    howTo: "Toca tu ficha y luego la casilla donde estás, o arrástrala. Con teclado: Tab hasta la ficha y las flechas.",
    selected: "Seleccionada", moveUp: "Mover arriba", moveDown: "Mover abajo", moveLeft: "Mover a la izquierda", moveRight: "Mover a la derecha", deselect: "Listo",
    cannotMove: "Solo el DM o su jugador pueden mover esta ficha.",
    monsters: "Monstruos", monsterName: "Nombre", count: "Cuántos", size: "Tamaño", hiddenNew: "Ocultos a los jugadores hasta revelarlos", add: "Añadir",
    sizes: { 1: "Mediano o menor", 2: "Grande", 3: "Enorme", 4: "Gargantuesco" } as Record<TokenSize, string>,
    fromJournal: "Desde el diario de encuentros", pickEncounter: "Elige un encuentro guardado", addEncounter: "Añadir sus monstruos",
    noEncounters: "No hay encuentros guardados en esta campaña.",
    onBoard: "En el mapa", hide: "Ocultar", reveal: "Revelar", defeat: "Derrotado", revive: "Recuperar", remove: "Quitar",
    hiddenTag: "oculto", defeatedTag: "derrotado", unseenTag: "fuera de la vista", noMonsters: "No hay monstruos en el mapa.",
    grid: "Cuadrícula", columns: "Columnas", rows: "Filas", resize: "Cambiar tamaño", clearMonsters: "Quitar todos los monstruos",
    clearConfirm: "¿Quitar todos los monstruos del mapa?",
    share: "Cada jugador abre esta misma página en su móvil para mover a su héroe:", copy: "Copiar enlace", copied: "Copiado",
    legend: "En la mesa",
    turnLeft: "Girar a la izquierda", turnRight: "Girar a la derecha", facing: "Mira al",
    directions: ["norte", "noreste", "este", "sureste", "sur", "suroeste", "oeste", "noroeste"],
    vision: "Visión", visionNone: "Ninguna", visionRange: (squares: number) => `${squares * 1.5} m`, visionAngle: "Cono",
    angles: { 60: "60°", 90: "90°", 120: "120°", 180: "180°", 360: "Alrededor" } as Record<VisionAngle, string>,
    showCones: "Conos de visión",
    keysHint: "Q y E giran la ficha seleccionada.",
    fog: "Niebla de guerra", fogHint: "Los jugadores solo ven lo que cubren los conos de visión de los héroes y los monstruos que haya ahí.",
    gridLines: "Mostrar las líneas de la cuadrícula",
    background: "Fondo", uploadBackground: "Subir imagen", replaceBackground: "Cambiar imagen", removeBackground: "Quitar imagen",
    backgroundHint: "PNG, JPEG, WebP o GIF de hasta 5 MB. Se estira sobre toda la cuadrícula.",
    fitRows: (rows: number) => `Ajustar a la imagen: ${rows} filas`, uploading: "Subiendo…",
    uploadError: "No se pudo subir la imagen. Usa un PNG, JPEG, WebP o GIF de 5 MB como mucho.",
    blocked: "Hay un muro o una puerta cerrada en medio.", tooFar: "Acerca a tu héroe a la puerta para abrirla o cerrarla.",
    openDoor: (square: string) => `Abrir la puerta junto a ${square}`, closeDoor: (square: string) => `Cerrar la puerta junto a ${square}`,
    door: "Puerta", doorOpen: "abierta", doorClosed: "cerrada",
    walls: "Muros y puertas", wallTool: "Dibujar", toolWall: "Muro", toolDoor: "Puerta", toolErase: "Borrar", toolOff: "Terminar",
    wallHint: "Toca una esquina de la cuadrícula y luego otra en la misma línea. Los muros siguen desde donde acabó el anterior; toca la misma esquina otra vez para parar. Dibuja una puerta encima de un muro para convertirlo. Los muros tapan la vista y frenan a los jugadores; las puertas, solo cerradas. El DM puede seguir moviendo cualquier ficha a cualquier sitio.",
    eraseHint: "Toca un muro o una puerta para quitarlo.",
    clearWalls: "Quitar todos los muros", clearWallsConfirm: "¿Quitar todos los muros y puertas del mapa?",
    wallCount: (n: number) => `${n} en el mapa`,
    forgetExplored: "Olvidar lo explorado",
    saves: "Mapas guardados", savesHint: "El mapa de la mesa se guarda solo tras cada cambio. Guarda una copia para cambiar a otro mapa y volver a este otro día: conserva fichas, muros, puertas, la niebla con lo explorado y el fondo.",
    saveName: "Nombre", saveAction: "Guardar este mapa", saving: "Guardando…", load: "Cargar", deleteSave: "Borrar",
    loadConfirm: (name: string) => `¿Sustituir el mapa de la mesa por «${name}»? Guarda antes el actual si quieres conservarlo.`,
    deleteConfirm: (name: string) => `¿Borrar el mapa guardado «${name}»?`,
    newMap: "Empezar un mapa vacío", newMapConfirm: "¿Vaciar la mesa y empezar un mapa vacío? Guarda antes el actual si quieres conservarlo.",
    noSaves: "Aún no hay mapas guardados.", saveError: "No se pudo hacer. Una campaña guarda hasta 20 mapas.",
    saveSummary: (save: MapSaveSummary, date: string) => `${save.cols}×${save.rows} · ${save.tokens} fichas · ${save.walls} muros${save.hasBackground ? " · imagen" : ""} · ${date}`,
  },
};

/** One grid square in SVG user units, and the gutter for the A, B, C… / 1, 2, 3… labels. */
const CELL = 48;
const GUTTER = 26;
const heroColors = ["#2f6690", "#2e7d4f", "#7b4fa8", "#a8620f", "#16777a", "#a83f6f", "#4a5fc1", "#69741f"];
const monsterColor = "#922610";
const defeatedColor = "#6b6158";
const visionRanges = [0, 2, 4, 6, 8, 12, 18, 24];

/** URL of the map's background picture; the key makes every upload a new URL. */
const backgroundUrl = (campaignId: string, key: string) => `/api/campaigns/${encodeURIComponent(campaignId)}/map/background?k=${encodeURIComponent(key)}`;

/** SVG path of a token's vision cone (a wedge, or a circle when it sees all around), in board units. */
function conePath(token: MapToken, range: number, angle: VisionAngle): string {
  const cx = GUTTER + (token.x + token.size / 2) * CELL;
  const cy = GUTTER + (token.y + token.size / 2) * CELL;
  const r = (range + token.size / 2) * CELL;
  if (angle >= 360) return `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0Z`;
  const mid = facingScreenAngle(token.facing) * Math.PI / 180;
  const half = angle / 2 * Math.PI / 180;
  const point = (a: number) => `${(cx + r * Math.cos(a)).toFixed(1)} ${(cy + r * Math.sin(a)).toFixed(1)}`;
  return `M${cx} ${cy}L${point(mid - half)}A${r} ${r} 0 ${angle > 180 ? 1 : 0} 1 ${point(mid + half)}Z`;
}

function initials(token: MapToken): string {
  const number = /(\d+)$/.exec(token.label)?.[1];
  const words = token.label.replace(/\s*\d+$/, "").split(/\s+/).filter(Boolean);
  if (number) return `${(words[0] ?? "?").slice(0, 1)}${number}`.toLocaleUpperCase();
  return (words.length > 1 ? words[0].slice(0, 1) + words[1].slice(0, 1) : (words[0] ?? "?").slice(0, 2)).toLocaleUpperCase();
}

type Status = "connecting" | "live" | "offline";
type LoadError = "" | "signin" | "notfound" | "load";
type WallTool = "wall" | "door" | "erase";
type Vertex = { x: number; y: number };
/** A square next to the wall, to name it out loud ("the door by E5"). */
const wallSquare = (wall: MapWall, cols: number, rows: number) => squareName(Math.min(wall.x1, cols - 1), Math.min(wall.y1, rows - 1));
/** SVG path covering the given squares. */
const cellsPath = (cells: Iterable<string>) => Array.from(cells, (cell) => {
  const [x, y] = cell.split(",").map(Number);
  return `M${GUTTER + x * CELL} ${GUTTER + y * CELL}h${CELL}v${CELL}h${-CELL}Z`;
}).join("");
type Drag = { id: string; pointerId: number; offsetX: number; offsetY: number; x: number; y: number; startX: number; startY: number; moved: boolean };

export default function BattleMap({ campaignId }: { campaignId: string }) {
  const [locale, setLocale] = useState<Locale>("en");
  const t = text[locale];
  const [map, setMap] = useState<BattleMapView | null>(null);
  const [loadError, setLoadError] = useState<LoadError>("");
  const [notice, setNotice] = useState<"" | "moveError" | "blocked" | "tooFar">("");
  const [wallTool, setWallTool] = useState<WallTool | null>(null);
  const [wallStart, setWallStart] = useState<Vertex | null>(null);
  const [hoverVertex, setHoverVertex] = useState<Vertex | null>(null);
  const [status, setStatus] = useState<Status>("connecting");
  const [playersView, setPlayersView] = useState(false);
  const [tableMode, setTableMode] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [showCones, setShowCones] = useState(true);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const tableRef = useRef<HTMLDivElement | null>(null);
  /** While our own changes are in flight, ignore server states that predate them (no snapping back). */
  const pending = useRef({ count: 0, ignoreUpTo: -1 });
  const audience = tableMode || playersView ? "players" : "auto";
  const audienceRef = useRef(audience);
  useEffect(() => { audienceRef.current = audience; }, [audience]);

  useEffect(() => {
    const lang = document.documentElement.lang;
    setLocale(lang === "es" ? "es" : "en");
  }, []);

  const receive = useCallback((next: BattleMapView, force = false) => {
    if (!force && pending.current.count > 0 && next.version <= pending.current.ignoreUpTo) return;
    setMap((current) => !current || force || next.version >= current.version || next.showsHidden !== current.showsHidden ? next : current);
  }, []);

  // Live updates over Server-Sent Events; the browser reconnects by itself after network drops.
  useEffect(() => {
    const query = audience === "players" ? "?audience=players" : "";
    let source: EventSource | null = null;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;
    setStatus("connecting");
    const open = () => {
      if (stopped) return;
      source = new EventSource(`/api/campaigns/${encodeURIComponent(campaignId)}/map/stream${query}`);
      source.addEventListener("map", (event) => {
        setStatus("live");
        setLoadError("");
        try { receive(JSON.parse((event as MessageEvent<string>).data) as BattleMapView); } catch { /* ignore a garbled event */ }
      });
      source.addEventListener("gone", () => { source?.close(); setLoadError("notfound"); });
      source.onerror = () => {
        setStatus("offline");
        if (source?.readyState !== EventSource.CLOSED) return; // the browser is retrying on its own
        source.close();
        // Closed for good (an HTTP error, not a drop): find out why with a plain request.
        api<{ map: BattleMapView }>(`/api/campaigns/${encodeURIComponent(campaignId)}/map${query}`)
          .then(({ map: fresh }) => { receive(fresh, true); retry = setTimeout(open, 3_000); })
          .catch((cause) => {
            if (cause instanceof ApiError && cause.status === 401) setLoadError("signin");
            else if (cause instanceof ApiError && (cause.status === 403 || cause.status === 404)) setLoadError("notfound");
            else { if (!map) setLoadError("load"); retry = setTimeout(open, 5_000); }
          });
      };
    };
    open();
    return () => { stopped = true; source?.close(); clearTimeout(retry); };
    // `map` is only read for the first-load error message.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId, audience, receive, reloadKey]);

  // Table display: full screen, screen kept awake, players' view.
  useEffect(() => {
    if (!tableMode) return;
    let lock: { release(): Promise<void> } | null = null;
    const nav = navigator as Navigator & { wakeLock?: { request(type: "screen"): Promise<{ release(): Promise<void> }> } };
    nav.wakeLock?.request("screen").then((sentinel) => { lock = sentinel; }).catch(() => undefined);
    const onFullscreen = () => { if (!document.fullscreenElement) setTableMode(false); };
    document.addEventListener("fullscreenchange", onFullscreen);
    return () => {
      document.removeEventListener("fullscreenchange", onFullscreen);
      lock?.release().catch(() => undefined);
    };
  }, [tableMode]);

  function enterTable() {
    setSelectedId(null);
    setTableMode(true);
    tableRef.current?.requestFullscreen?.().catch(() => undefined);
  }
  function exitTable() {
    setTableMode(false);
    if (document.fullscreenElement) document.exitFullscreen().catch(() => undefined);
  }

  const me = useMemo(() => map?.heroes.find((hero) => hero.mine)?.ownerId ?? "", [map]);
  const actor = useMemo(() => ({ userId: me, isDm: map?.isDm ?? false }), [me, map?.isDm]);

  // Escape stops drawing walls.
  useEffect(() => {
    if (!wallTool) return;
    const onKey = (event: globalThis.KeyboardEvent) => { if (event.key === "Escape") { if (wallStart) setWallStart(null); else setWallTool(null); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [wallTool, wallStart]);

  const send = useCallback(async (ops: MapOp[]) => {
    if (!map) return;
    setNotice("");
    // Optimistic: show the change at once with the same rules the server applies.
    let temp = 0;
    const local = applyMapOps(map.state, ops, actor, map.heroes, () => `tmp-${Date.now()}-${temp++}`);
    // The walls this device knows are a subset of the server's, so a move blocked here is blocked there too.
    if (!local.ok && local.error === "blocked") { setNotice("blocked"); return; }
    if (local.ok) setMap({ ...map, state: local.state });
    pending.current.count += 1;
    pending.current.ignoreUpTo = Math.max(pending.current.ignoreUpTo, map.version);
    const query = audienceRef.current === "players" ? "?audience=players" : "";
    try {
      const { map: saved } = await api<{ map: BattleMapView }>(`/api/campaigns/${encodeURIComponent(campaignId)}/map${query}`, { method: "POST", body: { ops } });
      pending.current.count -= 1;
      receive(saved);
    } catch (cause) {
      pending.current.count -= 1;
      setNotice(cause instanceof ApiError && cause.status === 409 ? "blocked" : "moveError");
      api<{ map: BattleMapView }>(`/api/campaigns/${encodeURIComponent(campaignId)}/map${query}`).then(({ map: fresh }) => receive(fresh, true)).catch(() => undefined);
    }
  }, [map, actor, campaignId, receive]);

  if (loadError) {
    return <main className={styles.page} id="main">
      <section className={styles.notice} role="alert">
        <p>{loadError === "signin" ? t.signIn : loadError === "notfound" ? t.notFound : t.loadError}</p>
        {loadError === "signin" ? <Link className="button button-primary" href="/">{t.signInAction}</Link>
          : loadError === "load" ? <button type="button" className="button button-primary" onClick={() => { setLoadError(""); setReloadKey((key) => key + 1); }}>{t.retry}</button>
          : <Link className="button button-quiet" href="/campaigns">{t.back}</Link>}
      </section>
    </main>;
  }
  if (!map) {
    return <main className={styles.page} id="main" aria-busy="true"><p className={styles.loading}><Spinner /> {t.loading}</p></main>;
  }

  const { state } = map;
  const heroColor = new Map(map.heroes.map((hero, index) => [hero.id, heroColors[index % heroColors.length]]));
  const selected = state.tokens.find((token) => token.id === selectedId) ?? null;
  const canMove = (token: MapToken) => canControlToken(actor, token, map.heroes);
  const width = GUTTER + state.cols * CELL;
  const height = GUTTER + state.rows * CELL;

  function svgPoint(clientX: number, clientY: number) {
    const svg = svgRef.current;
    const matrix = svg?.getScreenCTM();
    if (!svg || !matrix) return { x: 0, y: 0 };
    const point = new DOMPoint(clientX, clientY).matrixTransform(matrix.inverse());
    return { x: point.x, y: point.y };
  }
  const clampCell = (value: number, size: number, max: number) => Math.max(0, Math.min(max - size, value));
  const moveTo = (token: MapToken, x: number, y: number) => {
    const nx = clampCell(x, token.size, state.cols);
    const ny = clampCell(y, token.size, state.rows);
    if (nx !== token.x || ny !== token.y) void send([{ type: "move", tokenId: token.id, x: nx, y: ny }]);
  };

  function onTokenPointerDown(event: PointerEvent<SVGGElement>, token: MapToken) {
    event.stopPropagation();
    setSelectedId(token.id);
    if (!canMove(token)) return;
    const point = svgPoint(event.clientX, event.clientY);
    svgRef.current?.setPointerCapture(event.pointerId);
    const left = GUTTER + token.x * CELL;
    const top = GUTTER + token.y * CELL;
    setDrag({ id: token.id, pointerId: event.pointerId, offsetX: point.x - left, offsetY: point.y - top, x: left, y: top, startX: point.x, startY: point.y, moved: false });
  }
  const toVertex = (point: { x: number; y: number }): Vertex => ({
    x: Math.max(0, Math.min(state.cols, Math.round((point.x - GUTTER) / CELL))),
    y: Math.max(0, Math.min(state.rows, Math.round((point.y - GUTTER) / CELL))),
  });
  /** Snap the second corner onto the first one's row or column, whichever is closer. */
  const wallEnd = (start: Vertex, vertex: Vertex): Vertex => Math.abs(vertex.x - start.x) >= Math.abs(vertex.y - start.y) ? { x: vertex.x, y: start.y } : { x: start.x, y: vertex.y };
  function onWallClick(event: MouseEvent<SVGRectElement>) {
    if (!wallTool || wallTool === "erase") return;
    const vertex = toVertex(svgPoint(event.clientX, event.clientY));
    if (!wallStart) { setWallStart(vertex); return; }
    const end = wallEnd(wallStart, vertex);
    if (end.x === wallStart.x && end.y === wallStart.y) { setWallStart(null); return; }
    void send([{ type: "add-walls", walls: [{
      x1: Math.min(wallStart.x, end.x), y1: Math.min(wallStart.y, end.y), x2: Math.max(wallStart.x, end.x), y2: Math.max(wallStart.y, end.y),
      ...(wallTool === "door" ? { door: "closed" as const } : {}),
    }] }]);
    setWallStart(wallTool === "door" ? null : end);
  }
  /** Players: the doors next to one of their heroes. The DM: every door. */
  const canUseDoor = (door: MapWall) => map.isDm || state.tokens.some((token) => token.kind === "hero" && canMove(token) && nearDoor(token, door));
  function onWallPick(wall: MapWall) {
    if (wallTool === "erase") { void send([{ type: "remove-wall", x1: wall.x1, y1: wall.y1, x2: wall.x2, y2: wall.y2 }]); return; }
    if (wallTool || !wall.door) return;
    if (!canUseDoor(wall)) { setNotice("tooFar"); return; }
    void send([{ type: "door", x1: wall.x1, y1: wall.y1, x2: wall.x2, y2: wall.y2, open: wall.door === "closed" }]);
  }
  function onPointerMove(event: PointerEvent<SVGSVGElement>) {
    if (wallTool && wallStart) {
      const vertex = wallEnd(wallStart, toVertex(svgPoint(event.clientX, event.clientY)));
      if (vertex.x !== hoverVertex?.x || vertex.y !== hoverVertex?.y) setHoverVertex(vertex);
    }
    if (!drag || event.pointerId !== drag.pointerId) return;
    const point = svgPoint(event.clientX, event.clientY);
    const moved = drag.moved || Math.hypot(point.x - drag.startX, point.y - drag.startY) > CELL / 4;
    setDrag({ ...drag, moved, x: point.x - drag.offsetX, y: point.y - drag.offsetY });
  }
  function onPointerUp(event: PointerEvent<SVGSVGElement>) {
    if (!drag || event.pointerId !== drag.pointerId) return;
    const token = state.tokens.find((item) => item.id === drag.id);
    setDrag(null);
    if (token && drag.moved) moveTo(token, Math.round((drag.x - GUTTER) / CELL), Math.round((drag.y - GUTTER) / CELL));
  }
  function onFloorClick(event: MouseEvent<SVGRectElement>) {
    if (wallTool) { onWallClick(event); return; }
    if (!selected || !canMove(selected)) { setSelectedId(null); return; }
    const point = svgPoint(event.clientX, event.clientY);
    const offset = Math.floor((selected.size - 1) / 2);
    moveTo(selected, Math.floor((point.x - GUTTER) / CELL) - offset, Math.floor((point.y - GUTTER) / CELL) - offset);
  }
  const turn = (token: MapToken, by: 1 | -1) => void send([{ type: "face", tokenId: token.id, facing: (((token.facing ?? 0) + by + 8) % 8) as Facing }]);
  function onTokenKey(event: KeyboardEvent<SVGGElement>, token: MapToken) {
    const steps: Record<string, [number, number]> = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };
    if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelectedId(token.id); return; }
    if (event.key === "Escape") { setSelectedId(null); return; }
    const key = event.key.toLowerCase();
    if ((key === "q" || key === "e") && canMove(token)) { event.preventDefault(); setSelectedId(token.id); turn(token, key === "q" ? -1 : 1); return; }
    const step = steps[event.key];
    if (!step || !canMove(token)) return;
    event.preventDefault();
    setSelectedId(token.id);
    moveTo(token, token.x + step[0], token.y + step[1]);
  }

  const tokenName = (token: MapToken) => `${token.label}, ${squareName(token.x, token.y)}${token.hidden ? ` (${t.hiddenTag})` : ""}${token.defeated ? ` (${t.defeatedTag})` : ""}`;

  // Big tokens first so small ones standing next to them stay clickable; the dragged one on top.
  const ordered = [...state.tokens].sort((a, b) => b.size - a.size || (a.id === drag?.id ? 1 : b.id === drag?.id ? -1 : 0));

  // Fog of war: what the party sees, computed the same way the server filters monsters for players.
  const sight = state.fog ? currentSight(state) : null;
  // Squares explored earlier stay dimmed (the background shows, monsters don't); the rest is dark.
  const explored = sight ? exploredCells(state) : null;
  const allCells = Array.from({ length: state.cols * state.rows }, (_, i) => `${i % state.cols},${Math.floor(i / state.cols)}`);
  const fogPath = sight && explored ? cellsPath(allCells.filter((cell) => !sight.has(cell) && !explored.has(cell))) : "";
  const memoryPath = sight && explored ? cellsPath(allCells.filter((cell) => !sight.has(cell) && explored.has(cell))) : "";
  const blocked = blockingEdges(state.walls);
  const cones = showCones ? state.tokens.flatMap((token) => {
    const vision = tokenVision(token);
    if (!vision || token.defeated || (drag?.id === token.id && drag.moved)) return [];
    const color = token.kind === "hero" ? heroColor.get(token.characterId ?? "") ?? heroColors[0] : monsterColor;
    const cone = <path className={styles.cone} d={conePath(token, vision.range, vision.angle)} fill={color} stroke={color} />;
    if (!blocked.size) return [<g key={token.id}>{cone}</g>];
    // With walls, the cone is cut to the squares the token really sees (in the players' view, to what the
    // server says the party sees: this device doesn't know every wall).
    const clipId = `sight-${map.campaignId}-${token.id}`;
    const seen = state.sight !== undefined && sight ? sight : tokenSight(token, state.cols, state.rows, blocked);
    return [<g key={token.id}>
      <clipPath id={clipId}><path d={cellsPath(seen)} /></clipPath>
      <g clipPath={`url(#${clipId})`}>{cone}</g>
    </g>];
  }) : [];
  const walls = state.walls ?? [];
  const wallLine = (wall: MapWall) => ({ x1: GUTTER + wall.x1 * CELL, y1: GUTTER + wall.y1 * CELL, x2: GUTTER + wall.x2 * CELL, y2: GUTTER + wall.y2 * CELL });
  const doorName = (wall: MapWall) => `${t.door} ${wallSquare(wall, state.cols, state.rows)} (${wall.door === "open" ? t.doorOpen : t.doorClosed})`;

  const boardStyle = { "--ratio": width / height, "--min-width": `${state.cols * 30 + 20}px` } as CSSProperties;
  const board = <svg ref={svgRef} className={styles.board} style={boardStyle} viewBox={`0 0 ${width} ${height}`} role="group" aria-label={t.boardLabel(map.campaignName)}
    onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={() => setDrag(null)}>
    <defs><clipPath id={`grid-${map.campaignId}`}><rect x={GUTTER} y={GUTTER} width={state.cols * CELL} height={state.rows * CELL} /></clipPath></defs>
    <rect className={styles.floor} x={GUTTER} y={GUTTER} width={state.cols * CELL} height={state.rows * CELL} onClick={onFloorClick} />
    {state.background && <image className={styles.backdrop} href={backgroundUrl(map.campaignId, state.background.key)} x={GUTTER} y={GUTTER}
      width={state.cols * CELL} height={state.rows * CELL} preserveAspectRatio="none" aria-hidden="true" />}
    {!state.gridHidden && <path className={styles.gridLines} d={[
      ...Array.from({ length: state.cols + 1 }, (_, i) => `M${GUTTER + i * CELL} ${GUTTER}V${height}`),
      ...Array.from({ length: state.rows + 1 }, (_, i) => `M${GUTTER} ${GUTTER + i * CELL}H${width}`),
    ].join("")} />}
    {cones.length > 0 && <g clipPath={`url(#grid-${map.campaignId})`} aria-hidden="true">{cones}</g>}
    {walls.length > 0 && <g className={wallTool === "erase" ? styles.wallsErasing : styles.walls}>
      {walls.map((wall) => {
        const line = wallLine(wall);
        const key = `${wall.x1},${wall.y1},${wall.x2},${wall.y2}`;
        const interactive = wallTool === "erase" || (!wallTool && Boolean(wall.door));
        return <g key={key} className={interactive ? styles.wallPick : undefined}
          {...(interactive ? {
            role: "button", tabIndex: 0, "aria-label": wall.door ? doorName(wall) : `${t.toolWall} ${wallSquare(wall, state.cols, state.rows)}`,
            onClick: () => onWallPick(wall),
            onKeyDown: (event: KeyboardEvent<SVGGElement>) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onWallPick(wall); } },
          } : { "aria-hidden": true })}>
          <line {...line} className={styles.wallHit} />
          <line {...line} className={wall.door === "open" ? styles.doorOpen : wall.door ? styles.doorClosed : styles.wall} />
        </g>;
      })}
    </g>}
    <g className={styles.coords} aria-hidden="true">
      {Array.from({ length: state.cols }, (_, i) => <text key={`c${i}`} x={GUTTER + i * CELL + CELL / 2} y={GUTTER / 2 + 1}>{columnName(i)}</text>)}
      {Array.from({ length: state.rows }, (_, i) => <text key={`r${i}`} x={GUTTER / 2} y={GUTTER + i * CELL + CELL / 2 + 1}>{i + 1}</text>)}
    </g>
    {ordered.map((token) => {
      const dragging = drag?.id === token.id && drag.moved;
      const left = dragging ? drag.x : GUTTER + token.x * CELL;
      const top = dragging ? drag.y : GUTTER + token.y * CELL;
      const span = token.size * CELL;
      const radius = span / 2 - 4;
      const fill = token.defeated ? defeatedColor : token.kind === "hero" ? heroColor.get(token.characterId ?? "") ?? heroColors[0] : monsterColor;
      const mine = token.kind === "hero" && map.heroes.some((hero) => hero.id === token.characterId && hero.mine);
      const classes = [styles.token, wallTool ? styles.passThrough : "", dragging ? styles.dragging : "", token.hidden ? styles.hidden : "", token.id === selectedId ? styles.selected : "", canMove(token) ? styles.movable : ""].filter(Boolean).join(" ");
      return <g key={token.id} className={classes} style={{ transform: `translate(${left}px, ${top}px)` }}
        tabIndex={0} role="button" aria-label={tokenName(token)} aria-pressed={token.id === selectedId}
        onPointerDown={(event) => onTokenPointerDown(event, token)} onKeyDown={(event) => onTokenKey(event, token)}>
        <title>{tokenName(token)}</title>
        {token.id === selectedId && <circle className={styles.selectRing} cx={span / 2} cy={span / 2} r={radius + 3} />}
        <circle cx={span / 2} cy={span / 2} r={radius} fill={fill} className={mine ? styles.mineDisc : styles.disc} />
        <text className={styles.tokenText} x={span / 2} y={span / 2 + 1} style={{ fontSize: Math.max(15, Math.min(30, radius * 0.75)) }}>{initials(token)}</text>
        {token.defeated && <path className={styles.cross} d={`M${span * 0.28} ${span * 0.28}L${span * 0.72} ${span * 0.72}M${span * 0.72} ${span * 0.28}L${span * 0.28} ${span * 0.72}`} />}
        {tokenVision(token) && !token.defeated && <path className={styles.facing}
          transform={`rotate(${(token.facing ?? 0) * 45} ${span / 2} ${span / 2})`}
          d={`M${span / 2 - 7} ${span / 2 - radius + 4}L${span / 2} ${span / 2 - radius - 7}L${span / 2 + 7} ${span / 2 - radius + 4}Z`} />}
      </g>;
    })}
    {/* Above the tokens: players never get monsters out there, and the DM sees which ones are unseen. */}
    {memoryPath && <path className={map.showsHidden ? styles.memoryDm : styles.memory} d={memoryPath} aria-hidden="true" />}
    {fogPath && <path className={map.showsHidden ? styles.fogDm : styles.fog} d={fogPath} aria-hidden="true" />}
    {/* Doors drawn again above the fog so they stand out; clicks go through the fog to the ones below. */}
    {sight && walls.some((wall) => wall.door) && !wallTool && <g className={styles.walls} aria-hidden="true">
      {walls.filter((wall) => wall.door).map((wall) => <line key={`fog-${wall.x1},${wall.y1},${wall.x2},${wall.y2}`} {...wallLine(wall)}
        className={wall.door === "open" ? styles.doorOpen : styles.doorClosed} />)}
    </g>}
    {wallTool && wallTool !== "erase" && wallStart && <g className={styles.wallPreview} aria-hidden="true">
      {hoverVertex && <line x1={GUTTER + wallStart.x * CELL} y1={GUTTER + wallStart.y * CELL} x2={GUTTER + hoverVertex.x * CELL} y2={GUTTER + hoverVertex.y * CELL} />}
      <circle cx={GUTTER + wallStart.x * CELL} cy={GUTTER + wallStart.y * CELL} r={7} />
    </g>}
  </svg>;

  const legend = <ul className={styles.legend} aria-label={t.legend}>
    {state.tokens.map((token) => <li key={token.id} className={token.defeated ? styles.legendDefeated : ""}>
      <span className={styles.legendDot} style={{ background: token.defeated ? defeatedColor : token.kind === "hero" ? heroColor.get(token.characterId ?? "") ?? heroColors[0] : monsterColor }} aria-hidden="true">{initials(token)}</span>
      {token.label} <small>{squareName(token.x, token.y)}</small>
    </li>)}
  </ul>;

  const statusLabel = status === "live" ? t.live : status === "connecting" ? t.connecting : t.offline;
  const statusBadge = <span className={`${styles.status} ${styles[status]}`} role="status"><span aria-hidden="true" />{statusLabel}</span>;

  if (tableMode) {
    return <div ref={tableRef} className={styles.table}>
      <main className={styles.tableMain} id="main">
        <h1 className="sr-only">{map.campaignName}</h1>
        <div className={styles.tableBar}>
          <b>{map.campaignName}</b>{statusBadge}
          <button type="button" className="button button-quiet" onClick={exitTable}>{t.exitTable}</button>
        </div>
        <div className={styles.tableBoard}>{board}</div>
        {legend}
      </main>
    </div>;
  }

  const mine = map.heroes.filter((hero) => hero.mine);
  const heroToken = (heroId: string) => state.tokens.find((token) => token.kind === "hero" && token.characterId === heroId);
  const shareUrl = typeof window === "undefined" ? "" : `${window.location.origin}/map/${encodeURIComponent(campaignId)}`;

  return <div ref={tableRef} className={styles.page}>
    <header className={styles.top}>
      <Link className={styles.back} href="/campaigns">← {t.back}</Link>
      <div className={styles.titleBlock}><p className={styles.kicker}>{t.kicker}</p><h1>{map.campaignName}</h1></div>
      <div className={styles.topActions}>
        {statusBadge}
        {map.isDm && <label className={styles.switch}><input type="checkbox" checked={playersView} onChange={(event) => setPlayersView(event.target.checked)} />{t.viewToggle}</label>}
        <button type="button" className="button button-primary" onClick={enterTable}>{t.tableMode}</button>
      </div>
    </header>
    <main className={styles.layout} id="main">
      <div className={styles.boardWrap}>
        <div className={styles.scroller}>{board}</div>
        {notice && <p className={styles.error} role="alert">{t[notice]}</p>}
        {selected && <div className={styles.selectedBar} aria-live="polite">
          <span><b>{selected.label}</b> · {squareName(selected.x, selected.y)}</span>
          {canMove(selected) ? <span className={styles.nudge}>
            <button type="button" aria-label={t.moveLeft} onClick={() => moveTo(selected, selected.x - 1, selected.y)}>←</button>
            <button type="button" aria-label={t.moveUp} onClick={() => moveTo(selected, selected.x, selected.y - 1)}>↑</button>
            <button type="button" aria-label={t.moveDown} onClick={() => moveTo(selected, selected.x, selected.y + 1)}>↓</button>
            <button type="button" aria-label={t.moveRight} onClick={() => moveTo(selected, selected.x + 1, selected.y)}>→</button>
          </span> : <small>{t.cannotMove}</small>}
          {canMove(selected) && tokenVision(selected) && <span className={styles.nudge}>
            <button type="button" aria-label={t.turnLeft} title={t.turnLeft} onClick={() => turn(selected, -1)}>⟲</button>
            <button type="button" aria-label={t.turnRight} title={t.turnRight} onClick={() => turn(selected, 1)}>⟳</button>
          </span>}
          {tokenVision(selected) && <small className={styles.facingLabel}>{t.facing} {t.directions[selected.facing ?? 0]}</small>}
          {map.isDm && <VisionPicker token={selected} locale={locale} send={send} />}
          {canMove(selected) && walls.filter((wall) => wall.door && nearDoor(selected, wall)).map((door) => <button key={`${door.x1},${door.y1},${door.x2},${door.y2}`}
            type="button" className={styles.smallButton} onClick={() => onWallPick(door)}>
            {(door.door === "open" ? t.closeDoor : t.openDoor)(wallSquare(door, state.cols, state.rows))}</button>)}
          <button type="button" className={styles.smallButton} onClick={() => setSelectedId(null)}>{t.deselect}</button>
        </div>}
        <div className={styles.boardOptions}>
          <label className={styles.check}><input type="checkbox" checked={showCones} onChange={(event) => setShowCones(event.target.checked)} />{t.showCones}</label>
        </div>
        <p className={styles.hint}>{t.howTo} {t.keysHint}</p>
      </div>

      <aside className={styles.panel} aria-label={map.isDm ? t.heroes : t.yourHeroes}>
        <section>
          <h2>{map.isDm ? t.heroes : t.yourHeroes}</h2>
          {(map.isDm ? map.heroes : mine).length ? <ul className={styles.list}>
            {(map.isDm ? map.heroes : mine).map((hero) => {
              const token = heroToken(hero.id);
              return <li key={hero.id}>
                <span className={styles.legendDot} style={{ background: heroColor.get(hero.id) }} aria-hidden="true" />
                <span className={styles.itemName}>{hero.name}{token && <small>{t.onMap(squareName(token.x, token.y))}</small>}</span>
                {token ? <>
                  <button type="button" className={styles.smallButton} onClick={() => setSelectedId(token.id)}>{t.select}</button>
                  <button type="button" className={styles.smallButton} aria-label={`${t.remove}: ${hero.name}`} onClick={() => void send([{ type: "remove", tokenId: token.id }])}>×</button>
                </> : <button type="button" className={styles.smallButton} onClick={() => void send([{ type: "place-hero", characterId: hero.id }])}>{t.place}</button>}
              </li>;
            })}
          </ul> : <p className={styles.empty}>{map.isDm ? t.noHeroes : t.noOwnHeroes}</p>}
          {map.isDm && map.heroes.some((hero) => !heroToken(hero.id)) && <button type="button" className="button button-quiet"
            onClick={() => void send(map.heroes.filter((hero) => !heroToken(hero.id)).map((hero) => ({ type: "place-hero" as const, characterId: hero.id })))}>{t.placeAll}</button>}
        </section>

        {map.isDm && <DmTools map={map} locale={locale} send={send} onSelect={setSelectedId} onSaved={(saved) => receive(saved, true)} playersAudience={audience === "players"}
          wallTool={wallTool} onWallTool={(tool) => { setWallTool(tool); setWallStart(null); setHoverVertex(null); if (tool) setSelectedId(null); }} />}

        <section>
          <p className={styles.share}>{t.share}</p>
          <CopyLink url={shareUrl} locale={locale} />
        </section>
      </aside>
    </main>
  </div>;
}

function CopyLink({ url, locale }: { url: string; locale: Locale }) {
  const t = text[locale];
  const [copied, setCopied] = useState(false);
  return <div className={styles.copy}>
    <input readOnly value={url} aria-label={t.copy} onFocus={(event) => event.target.select()} />
    <button type="button" className={styles.smallButton} onClick={() => {
      navigator.clipboard?.writeText(url).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2_000); }).catch(() => undefined);
    }}>{copied ? t.copied : t.copy}</button>
  </div>;
}

function VisionPicker({ token, locale, send }: { token: MapToken; locale: Locale; send: (ops: MapOp[]) => Promise<void> }) {
  const t = text[locale];
  const current = token.vision ?? (token.kind === "hero" ? DEFAULT_HERO_VISION : { range: 0, angle: 90 as VisionAngle });
  const set = (range: number, angle: VisionAngle) => void send([{ type: "update", tokenId: token.id, vision: { range, angle } }]);
  return <span className={styles.vision}>
    <label>{t.vision}<select className={styles.sizeSelect} value={current.range} onChange={(event) => set(Number(event.target.value), current.angle)}>
      {visionRanges.map((range) => <option key={range} value={range}>{range ? t.visionRange(range) : t.visionNone}</option>)}
    </select></label>
    <label>{t.visionAngle}<select className={styles.sizeSelect} value={current.angle} disabled={!current.range} onChange={(event) => set(current.range, Number(event.target.value) as VisionAngle)}>
      {VISION_ANGLES.map((angle) => <option key={angle} value={angle}>{t.angles[angle]}</option>)}
    </select></label>
  </span>;
}

function DmTools({ map, locale, send, onSelect, onSaved, playersAudience, wallTool, onWallTool }: {
  map: BattleMapView; locale: Locale; send: (ops: MapOp[]) => Promise<void>; onSelect: (id: string) => void;
  onSaved: (map: BattleMapView) => void; playersAudience: boolean; wallTool: WallTool | null; onWallTool: (tool: WallTool | null) => void;
}) {
  const t = text[locale];
  const [name, setName] = useState("");
  const [count, setCount] = useState(1);
  const [size, setSize] = useState<TokenSize>(1);
  const [hidden, setHidden] = useState(true);
  const [cols, setCols] = useState(map.state.cols);
  const [rows, setRows] = useState(map.state.rows);
  const [encounters, setEncounters] = useState<SavedEncounter[] | null>(null);
  const [encounterId, setEncounterId] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(false);
  const [imageSize, setImageSize] = useState<{ key: string; width: number; height: number } | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const monsters = map.state.tokens.filter((token) => token.kind === "monster");
  const backgroundKey = map.state.background?.key;
  const sight = map.state.fog ? currentSight(map.state) : null;

  // The picture's proportions, to offer a number of rows that keeps its squares square.
  useEffect(() => {
    if (!backgroundKey) return;
    const image = new Image();
    image.onload = () => setImageSize({ key: backgroundKey, width: image.naturalWidth, height: image.naturalHeight });
    image.src = backgroundUrl(map.campaignId, backgroundKey);
    return () => { image.onload = null; };
  }, [map.campaignId, backgroundKey]);
  const fittedRows = imageSize && imageSize.key === backgroundKey ? rowsForImage(map.state.cols, imageSize.width, imageSize.height) : null;

  async function changeBackground(file: File | null) {
    setUploadError(false);
    setUploading(true);
    try {
      const query = playersAudience ? "?audience=players" : "";
      const response = await fetch(`/api/campaigns/${encodeURIComponent(map.campaignId)}/map/background${query}`, {
        method: file ? "PUT" : "DELETE", credentials: "same-origin", cache: "no-store",
        ...(file ? { body: file, headers: { "Content-Type": file.type || "application/octet-stream" } } : {}),
      });
      if (!response.ok) throw new ApiError(response.status, response.statusText);
      onSaved(((await response.json()) as { map: BattleMapView }).map);
    } catch {
      setUploadError(true);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  useEffect(() => { setCols(map.state.cols); setRows(map.state.rows); }, [map.state.cols, map.state.rows]);
  useEffect(() => {
    api<{ encounters: SavedEncounter[] }>(`/api/campaigns/${encodeURIComponent(map.campaignId)}/encounters`)
      .then((data) => setEncounters(data.encounters)).catch(() => setEncounters([]));
  }, [map.campaignId]);

  function addMonster(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const label = name.trim().slice(0, TOKEN_LABEL_MAX);
    if (!label) return;
    void send([{ type: "add-monster", label, count, size, hidden }]);
    setName("");
    setCount(1);
  }
  function addEncounter() {
    const encounter = encounters?.find((item) => item.id === encounterId);
    if (!encounter) return;
    void send(encounter.lines.slice(0, 20).map((line) => ({
      type: "add-monster" as const, label: line.name.slice(0, TOKEN_LABEL_MAX), count: Math.min(line.count, MAP_MAX_MONSTERS_PER_ADD),
      size: 1 as TokenSize, hidden, ...(line.monsterSlug && /^[a-z0-9-]{1,100}$/.test(line.monsterSlug) ? { monsterSlug: line.monsterSlug } : {}),
    })));
  }

  return <>
    <section>
      <h2>{t.monsters}</h2>
      <form className={styles.form} onSubmit={addMonster}>
        <label className={styles.grow}>{t.monsterName}<input required maxLength={TOKEN_LABEL_MAX} value={name} onChange={(event) => setName(event.target.value)} /></label>
        <label>{t.count}<input type="number" min={1} max={MAP_MAX_MONSTERS_PER_ADD} value={count} onChange={(event) => setCount(Math.max(1, Math.min(MAP_MAX_MONSTERS_PER_ADD, Number(event.target.value) || 1)))} /></label>
        <label>{t.size}<select value={size} onChange={(event) => setSize(Number(event.target.value) as TokenSize)}>
          {([1, 2, 3, 4] as TokenSize[]).map((value) => <option key={value} value={value}>{t.sizes[value]}</option>)}
        </select></label>
        <button type="submit" className="button button-primary">{t.add}</button>
      </form>
      <label className={styles.check}><input type="checkbox" checked={hidden} onChange={(event) => setHidden(event.target.checked)} />{t.hiddenNew}</label>
      <div className={styles.form}>
        <label className={styles.grow}>{t.fromJournal}
          <select value={encounterId} onChange={(event) => setEncounterId(event.target.value)} disabled={!encounters?.length}>
            <option value="">{encounters && !encounters.length ? t.noEncounters : t.pickEncounter}</option>
            {encounters?.map((encounter) => <option key={encounter.id} value={encounter.id}>{encounter.title}</option>)}
          </select>
        </label>
        <button type="button" className="button button-quiet" disabled={!encounterId} onClick={addEncounter}>{t.addEncounter}</button>
      </div>
    </section>

    <section>
      <h2>{t.onBoard}</h2>
      {monsters.length ? <ul className={styles.list}>{monsters.map((token) => <li key={token.id} className={token.hidden ? styles.itemHidden : ""}>
        <span className={styles.legendDot} style={{ background: token.defeated ? defeatedColor : monsterColor }} aria-hidden="true" />
        <button type="button" className={styles.itemName} onClick={() => onSelect(token.id)}>{token.label}
          <small>{squareName(token.x, token.y)}{token.hidden ? ` · ${t.hiddenTag}` : ""}{token.defeated ? ` · ${t.defeatedTag}` : ""}{sight && !token.hidden && !tokenInSight(token, sight) ? ` · ${t.unseenTag}` : ""}</small></button>
        <button type="button" className={styles.smallButton} onClick={() => void send([{ type: "update", tokenId: token.id, hidden: !token.hidden }])}>{token.hidden ? t.reveal : t.hide}</button>
        <button type="button" className={styles.smallButton} onClick={() => void send([{ type: "update", tokenId: token.id, defeated: !token.defeated }])}>{token.defeated ? t.revive : t.defeat}</button>
        <select className={styles.sizeSelect} aria-label={`${t.size}: ${token.label}`} value={token.size} onChange={(event) => void send([{ type: "update", tokenId: token.id, size: Number(event.target.value) as TokenSize }])}>
          {([1, 2, 3, 4] as TokenSize[]).map((value) => <option key={value} value={value}>{t.sizes[value]}</option>)}
        </select>
        <button type="button" className={styles.smallButton} aria-label={`${t.remove}: ${token.label}`} onClick={() => void send([{ type: "remove", tokenId: token.id }])}>×</button>
      </li>)}</ul> : <p className={styles.empty}>{t.noMonsters}</p>}
      {monsters.length > 0 && <button type="button" className="button button-quiet" onClick={() => { if (window.confirm(t.clearConfirm)) void send([{ type: "clear-monsters" }]); }}>{t.clearMonsters}</button>}
    </section>

    <section>
      <h2>{t.grid}</h2>
      <form className={styles.form} onSubmit={(event) => { event.preventDefault(); void send([{ type: "resize", cols, rows }]); }}>
        <label>{t.columns}<input type="number" min={MAP_MIN_SIZE} max={MAP_MAX_SIZE} value={cols} onChange={(event) => setCols(Math.max(MAP_MIN_SIZE, Math.min(MAP_MAX_SIZE, Number(event.target.value) || MAP_MIN_SIZE)))} /></label>
        <label>{t.rows}<input type="number" min={MAP_MIN_SIZE} max={MAP_MAX_SIZE} value={rows} onChange={(event) => setRows(Math.max(MAP_MIN_SIZE, Math.min(MAP_MAX_SIZE, Number(event.target.value) || MAP_MIN_SIZE)))} /></label>
        <button type="submit" className="button button-quiet" disabled={cols === map.state.cols && rows === map.state.rows}>{t.resize}</button>
      </form>
      <label className={styles.check}><input type="checkbox" checked={!map.state.gridHidden} onChange={(event) => void send([{ type: "settings", gridHidden: !event.target.checked }])} />{t.gridLines}</label>
      <label className={styles.check}><input type="checkbox" checked={map.state.fog === true} onChange={(event) => void send([{ type: "settings", fog: event.target.checked }])} />{t.fog}</label>
      <p className={styles.empty}>{t.fogHint}</p>
      {map.state.fog && map.state.explored && <button type="button" className="button button-quiet" onClick={() => void send([{ type: "settings", resetExplored: true }])}>{t.forgetExplored}</button>}
    </section>

    <section>
      <h2>{t.walls}</h2>
      <div className={styles.tools} role="group" aria-label={t.wallTool}>
        {(["wall", "door", "erase"] as WallTool[]).map((tool) => <button key={tool} type="button" className={styles.smallButton} aria-pressed={wallTool === tool}
          onClick={() => onWallTool(wallTool === tool ? null : tool)}>{tool === "wall" ? t.toolWall : tool === "door" ? t.toolDoor : t.toolErase}</button>)}
        {wallTool && <button type="button" className={styles.smallButton} onClick={() => onWallTool(null)}>{t.toolOff}</button>}
        {(map.state.walls?.length ?? 0) > 0 && <small>{t.wallCount(map.state.walls!.length)}</small>}
      </div>
      {wallTool && <p className={styles.empty}>{wallTool === "erase" ? t.eraseHint : t.wallHint}</p>}
      {(map.state.walls?.length ?? 0) > 0 && <button type="button" className="button button-quiet" onClick={() => { if (window.confirm(t.clearWallsConfirm)) void send([{ type: "clear-walls" }]); }}>{t.clearWalls}</button>}
    </section>

    <section>
      <h2>{t.background}</h2>
      {backgroundKey && <img className={styles.backgroundPreview} src={backgroundUrl(map.campaignId, backgroundKey)} alt="" />}
      <input ref={fileRef} className="sr-only" type="file" accept="image/png,image/jpeg,image/webp,image/gif" tabIndex={-1} aria-hidden="true"
        onChange={(event) => { const file = event.target.files?.[0]; if (file) void changeBackground(file); }} />
      <div className={styles.form}>
        <button type="button" className="button button-quiet" disabled={uploading} onClick={() => fileRef.current?.click()}>
          {uploading ? t.uploading : backgroundKey ? t.replaceBackground : t.uploadBackground}</button>
        {backgroundKey && <button type="button" className="button button-quiet" disabled={uploading} onClick={() => void changeBackground(null)}>{t.removeBackground}</button>}
      </div>
      {fittedRows !== null && fittedRows !== map.state.rows && <button type="button" className="button button-quiet" onClick={() => void send([{ type: "resize", cols: map.state.cols, rows: fittedRows }])}>{t.fitRows(fittedRows)}</button>}
      {uploadError && <p className={styles.error} role="alert">{t.uploadError}</p>}
      <p className={styles.empty}>{t.backgroundHint}</p>
    </section>

    <SavedMaps map={map} locale={locale} onLoaded={onSaved} playersAudience={playersAudience} />
  </>;
}

function SavedMaps({ map, locale, onLoaded, playersAudience }: { map: BattleMapView; locale: Locale; onLoaded: (map: BattleMapView) => void; playersAudience: boolean }) {
  const t = text[locale];
  const [saves, setSaves] = useState<MapSaveSummary[] | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const base = `/api/campaigns/${encodeURIComponent(map.campaignId)}/map`;
  const query = playersAudience ? "?audience=players" : "";

  useEffect(() => {
    api<{ saves: MapSaveSummary[] }>(`/api/campaigns/${encodeURIComponent(map.campaignId)}/map/saves`).then((data) => setSaves(data.saves)).catch(() => setSaves([]));
  }, [map.campaignId]);

  async function run<T>(action: () => Promise<T>, done: (value: T) => void) {
    setBusy(true);
    setFailed(false);
    try { done(await action()); } catch { setFailed(true); } finally { setBusy(false); }
  }
  const date = (iso: string) => new Date(iso).toLocaleString(locale === "es" ? "es-ES" : "en-GB", { dateStyle: "medium", timeStyle: "short" });

  return <section>
    <h2>{t.saves}</h2>
    <form className={styles.form} onSubmit={(event) => {
      event.preventDefault();
      const trimmed = name.trim();
      if (trimmed) void run(() => api<{ saves: MapSaveSummary[] }>(`${base}/saves`, { method: "POST", body: { name: trimmed } }), (data) => { setSaves(data.saves); setName(""); });
    }}>
      <label className={styles.grow}>{t.saveName}<input required maxLength={60} value={name} onChange={(event) => setName(event.target.value)} /></label>
      <button type="submit" className="button button-primary" disabled={busy}>{busy ? t.saving : t.saveAction}</button>
    </form>
    {saves && (saves.length ? <ul className={styles.list}>{saves.map((save) => <li key={save.id}>
      <span className={styles.itemName}>{save.name}<small>{t.saveSummary(save, date(save.createdAt))}</small></span>
      <button type="button" className={styles.smallButton} disabled={busy} onClick={() => {
        if (window.confirm(t.loadConfirm(save.name))) void run(() => api<{ map: BattleMapView }>(`${base}/saves/${save.id}${query}`, { method: "POST" }), (data) => onLoaded(data.map));
      }}>{t.load}</button>
      <button type="button" className={styles.smallButton} disabled={busy} aria-label={`${t.deleteSave}: ${save.name}`} onClick={() => {
        if (window.confirm(t.deleteConfirm(save.name))) void run(() => api<{ saves: MapSaveSummary[] }>(`${base}/saves/${save.id}`, { method: "DELETE" }), (data) => setSaves(data.saves));
      }}>×</button>
    </li>)}</ul> : <p className={styles.empty}>{t.noSaves}</p>)}
    <button type="button" className="button button-quiet" disabled={busy} onClick={() => {
      if (window.confirm(t.newMapConfirm)) void run(() => api<{ map: BattleMapView }>(`${base}/reset${query}`, { method: "POST" }), (data) => onLoaded(data.map));
    }}>{t.newMap}</button>
    {failed && <p className={styles.error} role="alert">{t.saveError}</p>}
    <p className={styles.empty}>{t.savesHint}</p>
  </section>;
}
