"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type CSSProperties, type KeyboardEvent, type MouseEvent, type PointerEvent } from "react";
import Link from "next/link";
import { api, ApiError, type SavedEncounter } from "@/lib/api-client";
import {
  applyMapOps, canControlToken, columnName, squareName, MAP_MAX_MONSTERS_PER_ADD, MAP_MAX_SIZE, MAP_MIN_SIZE, TOKEN_LABEL_MAX,
  type MapHero, type MapOp, type MapState, type MapToken, type TokenSize,
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
    loadError: "The map couldn't be loaded.", retry: "Try again", saveError: "That move couldn't be saved; the map shows the latest state.",
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
    hiddenTag: "hidden", defeatedTag: "defeated", noMonsters: "No monsters on the map.",
    grid: "Grid", columns: "Columns", rows: "Rows", resize: "Resize", clearMonsters: "Remove all monsters",
    clearConfirm: "Remove every monster from the map?",
    share: "Each player opens this same page on their phone to move their hero:", copy: "Copy link", copied: "Copied",
    legend: "On the table",
  },
  es: {
    back: "Campañas", kicker: "MAPA DE BATALLA", live: "En directo", connecting: "Conectando…", offline: "Reconectando…",
    tableMode: "Modo mesa", exitTable: "Salir del modo mesa", dmView: "Vista del DM", playersView: "Vista de jugadores",
    viewToggle: "Lo que ven los jugadores", loading: "Desplegando el mapa…",
    signIn: "Inicia sesión para ver este mapa.", signInAction: "Ir a iniciar sesión", notFound: "Este mapa no está disponible: no estás en esa campaña o ya no existe.",
    loadError: "No se pudo cargar el mapa.", retry: "Reintentar", saveError: "No se pudo guardar el movimiento; el mapa muestra el estado más reciente.",
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
    hiddenTag: "oculto", defeatedTag: "derrotado", noMonsters: "No hay monstruos en el mapa.",
    grid: "Cuadrícula", columns: "Columnas", rows: "Filas", resize: "Cambiar tamaño", clearMonsters: "Quitar todos los monstruos",
    clearConfirm: "¿Quitar todos los monstruos del mapa?",
    share: "Cada jugador abre esta misma página en su móvil para mover a su héroe:", copy: "Copiar enlace", copied: "Copiado",
    legend: "En la mesa",
  },
};

/** One grid square in SVG user units, and the gutter for the A, B, C… / 1, 2, 3… labels. */
const CELL = 48;
const GUTTER = 26;
const heroColors = ["#2f6690", "#2e7d4f", "#7b4fa8", "#a8620f", "#16777a", "#a83f6f", "#4a5fc1", "#69741f"];
const monsterColor = "#922610";
const defeatedColor = "#6b6158";

function initials(token: MapToken): string {
  const number = /(\d+)$/.exec(token.label)?.[1];
  const words = token.label.replace(/\s*\d+$/, "").split(/\s+/).filter(Boolean);
  if (number) return `${(words[0] ?? "?").slice(0, 1)}${number}`.toLocaleUpperCase();
  return (words.length > 1 ? words[0].slice(0, 1) + words[1].slice(0, 1) : (words[0] ?? "?").slice(0, 2)).toLocaleUpperCase();
}

type Status = "connecting" | "live" | "offline";
type LoadError = "" | "signin" | "notfound" | "load";
type Drag = { id: string; pointerId: number; offsetX: number; offsetY: number; x: number; y: number; startX: number; startY: number; moved: boolean };

export default function BattleMap({ campaignId }: { campaignId: string }) {
  const [locale, setLocale] = useState<Locale>("en");
  const t = text[locale];
  const [map, setMap] = useState<BattleMapView | null>(null);
  const [loadError, setLoadError] = useState<LoadError>("");
  const [saveError, setSaveError] = useState(false);
  const [status, setStatus] = useState<Status>("connecting");
  const [playersView, setPlayersView] = useState(false);
  const [tableMode, setTableMode] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
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

  const send = useCallback(async (ops: MapOp[]) => {
    if (!map) return;
    setSaveError(false);
    // Optimistic: show the change at once with the same rules the server applies.
    let temp = 0;
    const local = applyMapOps(map.state, ops, actor, map.heroes, () => `tmp-${Date.now()}-${temp++}`);
    if (local.ok) setMap({ ...map, state: local.state });
    pending.current.count += 1;
    pending.current.ignoreUpTo = Math.max(pending.current.ignoreUpTo, map.version);
    const query = audienceRef.current === "players" ? "?audience=players" : "";
    try {
      const { map: saved } = await api<{ map: BattleMapView }>(`/api/campaigns/${encodeURIComponent(campaignId)}/map${query}`, { method: "POST", body: { ops } });
      pending.current.count -= 1;
      receive(saved);
    } catch {
      pending.current.count -= 1;
      setSaveError(true);
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
  function onPointerMove(event: PointerEvent<SVGSVGElement>) {
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
    if (!selected || !canMove(selected)) { setSelectedId(null); return; }
    const point = svgPoint(event.clientX, event.clientY);
    const offset = Math.floor((selected.size - 1) / 2);
    moveTo(selected, Math.floor((point.x - GUTTER) / CELL) - offset, Math.floor((point.y - GUTTER) / CELL) - offset);
  }
  function onTokenKey(event: KeyboardEvent<SVGGElement>, token: MapToken) {
    const steps: Record<string, [number, number]> = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };
    if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelectedId(token.id); return; }
    if (event.key === "Escape") { setSelectedId(null); return; }
    const step = steps[event.key];
    if (!step || !canMove(token)) return;
    event.preventDefault();
    setSelectedId(token.id);
    moveTo(token, token.x + step[0], token.y + step[1]);
  }

  const tokenName = (token: MapToken) => `${token.label}, ${squareName(token.x, token.y)}${token.hidden ? ` (${t.hiddenTag})` : ""}${token.defeated ? ` (${t.defeatedTag})` : ""}`;

  // Big tokens first so small ones standing next to them stay clickable; the dragged one on top.
  const ordered = [...state.tokens].sort((a, b) => b.size - a.size || (a.id === drag?.id ? 1 : b.id === drag?.id ? -1 : 0));

  const boardStyle = { "--ratio": width / height, "--min-width": `${state.cols * 30 + 20}px` } as CSSProperties;
  const board = <svg ref={svgRef} className={styles.board} style={boardStyle} viewBox={`0 0 ${width} ${height}`} role="group" aria-label={t.boardLabel(map.campaignName)}
    onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={() => setDrag(null)}>
    <rect className={styles.floor} x={GUTTER} y={GUTTER} width={state.cols * CELL} height={state.rows * CELL} onClick={onFloorClick} />
    <path className={styles.gridLines} d={[
      ...Array.from({ length: state.cols + 1 }, (_, i) => `M${GUTTER + i * CELL} ${GUTTER}V${height}`),
      ...Array.from({ length: state.rows + 1 }, (_, i) => `M${GUTTER} ${GUTTER + i * CELL}H${width}`),
    ].join("")} />
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
      const classes = [styles.token, dragging ? styles.dragging : "", token.hidden ? styles.hidden : "", token.id === selectedId ? styles.selected : "", canMove(token) ? styles.movable : ""].filter(Boolean).join(" ");
      return <g key={token.id} className={classes} style={{ transform: `translate(${left}px, ${top}px)` }}
        tabIndex={0} role="button" aria-label={tokenName(token)} aria-pressed={token.id === selectedId}
        onPointerDown={(event) => onTokenPointerDown(event, token)} onKeyDown={(event) => onTokenKey(event, token)}>
        <title>{tokenName(token)}</title>
        {token.id === selectedId && <circle className={styles.selectRing} cx={span / 2} cy={span / 2} r={radius + 3} />}
        <circle cx={span / 2} cy={span / 2} r={radius} fill={fill} className={mine ? styles.mineDisc : styles.disc} />
        <text className={styles.tokenText} x={span / 2} y={span / 2 + 1} style={{ fontSize: Math.max(15, Math.min(30, radius * 0.75)) }}>{initials(token)}</text>
        {token.defeated && <path className={styles.cross} d={`M${span * 0.28} ${span * 0.28}L${span * 0.72} ${span * 0.72}M${span * 0.72} ${span * 0.28}L${span * 0.28} ${span * 0.72}`} />}
      </g>;
    })}
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
        {saveError && <p className={styles.error} role="alert">{t.saveError}</p>}
        {selected && <div className={styles.selectedBar} aria-live="polite">
          <span><b>{selected.label}</b> · {squareName(selected.x, selected.y)}</span>
          {canMove(selected) ? <span className={styles.nudge}>
            <button type="button" aria-label={t.moveLeft} onClick={() => moveTo(selected, selected.x - 1, selected.y)}>←</button>
            <button type="button" aria-label={t.moveUp} onClick={() => moveTo(selected, selected.x, selected.y - 1)}>↑</button>
            <button type="button" aria-label={t.moveDown} onClick={() => moveTo(selected, selected.x, selected.y + 1)}>↓</button>
            <button type="button" aria-label={t.moveRight} onClick={() => moveTo(selected, selected.x + 1, selected.y)}>→</button>
          </span> : <small>{t.cannotMove}</small>}
          <button type="button" className={styles.smallButton} onClick={() => setSelectedId(null)}>{t.deselect}</button>
        </div>}
        <p className={styles.hint}>{t.howTo}</p>
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

        {map.isDm && <DmTools map={map} locale={locale} send={send} onSelect={setSelectedId} />}

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

function DmTools({ map, locale, send, onSelect }: { map: BattleMapView; locale: Locale; send: (ops: MapOp[]) => Promise<void>; onSelect: (id: string) => void }) {
  const t = text[locale];
  const [name, setName] = useState("");
  const [count, setCount] = useState(1);
  const [size, setSize] = useState<TokenSize>(1);
  const [hidden, setHidden] = useState(true);
  const [cols, setCols] = useState(map.state.cols);
  const [rows, setRows] = useState(map.state.rows);
  const [encounters, setEncounters] = useState<SavedEncounter[] | null>(null);
  const [encounterId, setEncounterId] = useState("");
  const monsters = map.state.tokens.filter((token) => token.kind === "monster");

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
          <small>{squareName(token.x, token.y)}{token.hidden ? ` · ${t.hiddenTag}` : ""}{token.defeated ? ` · ${t.defeatedTag}` : ""}</small></button>
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
    </section>
  </>;
}
