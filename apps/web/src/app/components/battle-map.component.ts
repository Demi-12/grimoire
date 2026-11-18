import { NgTemplateOutlet } from "@angular/common";
import { ChangeDetectionStrategy, Component, computed, effect, ElementRef, inject, input, signal, untracked, viewChild } from "@angular/core";
import { RouterLink } from "@angular/router";
import {
  applyMapOps, blockingEdges, canControlToken, columnName, combatantOf, currentSight, exploredCells, facingScreenAngle, movementBudget, movementSteps, nearDoor, pathLength, squareName,
  tokenSight, tokenSizeFor, tokenVision,
  DEFAULT_HERO_VISION, VISION_ANGLES,
  type Facing, type MapOp, type MapToken, type MapWall, type VisionAngle,
} from "@grimoire/shared/battle-map";
import { rememberMap } from "@grimoire/shared/last-map";
import { api, ApiError, type Character } from "../core/api-client";
import { useDocumentTitle } from "../core/document-title";
import { I18nService } from "../core/i18n.service";
import { track } from "../core/telemetry-client";
import { baseName, findCreature, loadCreature } from "./battle-map-bestiary";
import { BattleMapCombatComponent, combatInfo, formatDistance, MovementComponent, type CombatInfo } from "./battle-map-combat.component";
import { BattleMapSheetComponent } from "./battle-map-sheet.component";
import { bm } from "./battle-map-styles";
import { backgroundUrl, CopyLinkComponent, defeatedColor, DmToolsComponent, monsterColor, text, type BattleMapView, type WallTool } from "./battle-map-tools.component";
import { SpinnerComponent } from "./skeleton.component";

/**
 * The live battle map of one campaign (`/map/<id>`, outside the toolkit shell): the SVG board with its tokens,
 * walls and doors, fog of war and vision cones, kept up to date over Server-Sent Events. Changes are shown at
 * once with the same rules the server applies, and replaced by the server's state when it answers (or refuses).
 * Next to the board: the selected token's bar, the fight, the token's sheet, the heroes and, for the DM, the
 * tools of battle-map-tools.component.ts. The table display fills the screen with the players' view.
 * It loads everything it needs itself, including the "sign in" and "not available" screens.
 */

/** One grid square in SVG user units, and the gutter for the A, B, C… / 1, 2, 3… labels. */
const CELL = 48;
const GUTTER = 26;
const heroColors = ["#2f6690", "#2e7d4f", "#7b4fa8", "#a8620f", "#16777a", "#a83f6f", "#4a5fc1", "#69741f"];
const visionRanges = [0, 2, 4, 6, 8, 12, 18, 24];
/** Remembers whether picking a token opens its sheet. */
const AUTO_SHEET_ITEM = "grimoire.map.autoSheet";

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
type Notice = "" | "moveError" | "blocked" | "tooFar" | "turn" | "movement";
type Vertex = { x: number; y: number };
/** A square next to the wall, to name it out loud ("the door by E5"). */
const wallSquare = (wall: MapWall, cols: number, rows: number) => squareName(Math.min(wall.x1, cols - 1), Math.min(wall.y1, rows - 1));
/** SVG path covering the given squares. */
const cellsPath = (cells: Iterable<string>) => Array.from(cells, (cell) => {
  const [x, y] = cell.split(",").map(Number);
  return `M${GUTTER + x * CELL} ${GUTTER + y * CELL}h${CELL}v${CELL}h${-CELL}Z`;
}).join("");
const wallLine = (wall: MapWall) => ({ x1: GUTTER + wall.x1 * CELL, y1: GUTTER + wall.y1 * CELL, x2: GUTTER + wall.x2 * CELL, y2: GUTTER + wall.y2 * CELL });
const wallKey = (wall: MapWall) => `${wall.x1},${wall.y1},${wall.x2},${wall.y2}`;
const clampCell = (value: number, size: number, max: number) => Math.max(0, Math.min(max - size, value));
type Drag = { id: string; pointerId: number; offsetX: number; offsetY: number; x: number; y: number; startX: number; startY: number; moved: boolean };

@Component({
  selector: "app-battle-map",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgTemplateOutlet, RouterLink, SpinnerComponent, BattleMapCombatComponent, MovementComponent, BattleMapSheetComponent, DmToolsComponent, CopyLinkComponent],
  host: { class: "contents" },
  templateUrl: "./battle-map.component.html",
})
export class BattleMapComponent {
  private readonly i18n = inject(I18nService);
  protected readonly t = computed(() => text[this.i18n.locale()]);
  protected readonly bm = bm;
  protected readonly visionRanges = visionRanges;
  protected readonly visionAngles = VISION_ANGLES;
  protected readonly squareName = squareName;
  protected readonly tokenVision = tokenVision;

  readonly campaignId = input.required<string>();

  protected readonly map = signal<BattleMapView | null>(null);
  protected readonly loadError = signal<LoadError>("");
  protected readonly notice = signal<Notice>("");
  protected readonly wallTool = signal<WallTool | null>(null);
  protected readonly wallStart = signal<Vertex | null>(null);
  protected readonly hoverVertex = signal<Vertex | null>(null);
  protected readonly status = signal<Status>("connecting");
  protected readonly playersView = signal(false);
  protected readonly tableMode = signal(false);
  protected readonly selectedId = signal<string | null>(null);
  protected readonly drag = signal<Drag | null>(null);
  private readonly reloadKey = signal(0);
  protected readonly showCones = signal(true);
  protected readonly sheetId = signal<string | null>(null);
  protected readonly autoSheet = signal(readAutoSheet());
  protected readonly characters = signal<Map<string, Character> | null>(null);
  private readonly svg = viewChild<ElementRef<SVGSVGElement>>("svg");
  private readonly tableRoot = viewChild<ElementRef<HTMLDivElement>>("tableRoot");
  /** While our own changes are in flight, ignore server states that predate them (no snapping back). */
  private readonly pending = { count: 0, ignoreUpTo: -1 };

  private readonly mapLoaded = computed(() => this.map() !== null);
  protected readonly audience = computed(() => this.tableMode() || this.playersView() ? "players" : "auto");
  private readonly campaignName = computed(() => this.map()?.campaignName ?? null);
  // The campaign's characters, for the heroes' sheets and initiative (fetched again when the party changes).
  private readonly heroKey = computed(() => this.map()?.heroes.map((hero) => hero.id).join(",") ?? null);
  private readonly activeId = computed(() => this.map()?.state.combat?.active ?? null);
  private readonly activeMine = computed(() => {
    const map = this.map();
    const activeId = this.activeId();
    return Boolean(map && activeId && (map.isDm || map.state.tokens.some((token) => token.id === activeId && token.kind === "hero" && map.heroes.some((hero) => hero.mine && hero.id === token.characterId))));
  });
  private readonly me = computed(() => this.map()?.heroes.find((hero) => hero.mine)?.ownerId ?? "");
  private readonly actor = computed(() => ({ userId: this.me(), isDm: this.map()?.isDm ?? false }));

  constructor() {
    // Remembered so the map picker and the overview's shortcut put this table first next time.
    effect(() => {
      const loaded = this.mapLoaded();
      const campaignId = this.campaignId();
      if (loaded) untracked(() => rememberMap(campaignId));
    });
    effect(() => {
      this.campaignId();
      untracked(() => track("page.view", { section: "map" }));
    });
    useDocumentTitle(() => { const name = this.campaignName(); return name === null ? null : this.t().docTitle(name); });

    effect((onCleanup) => {
      if (this.heroKey() === null) return;
      let live = true;
      untracked(() => {
        api<{ characters: Character[] }>("/api/characters")
          .then(({ characters: list }) => { if (live) this.characters.set(new Map(list.map((character) => [character.id, character]))); })
          .catch(() => { if (live) this.characters.set(new Map()); });
      });
      onCleanup(() => { live = false; });
    });

    // Picking a token opens its sheet; so does the start of a turn the viewer runs (the DM's monsters, a player's hero).
    effect(() => {
      const selectedId = this.selectedId();
      const autoSheet = this.autoSheet();
      if (selectedId && autoSheet) untracked(() => this.sheetId.set(selectedId));
    });
    effect(() => {
      const activeId = this.activeId();
      const activeMine = this.activeMine();
      const autoSheet = this.autoSheet();
      if (activeId && activeMine && autoSheet) untracked(() => this.sheetId.set(activeId));
    });

    // Live updates over Server-Sent Events; the browser reconnects by itself after network drops.
    effect((onCleanup) => {
      const campaignId = this.campaignId();
      const audience = this.audience();
      this.reloadKey();
      const query = audience === "players" ? "?audience=players" : "";
      let source: EventSource | null = null;
      let retry: ReturnType<typeof setTimeout> | undefined;
      let stopped = false;
      untracked(() => this.status.set("connecting"));
      const open = () => {
        if (stopped) return;
        source = new EventSource(`/api/campaigns/${encodeURIComponent(campaignId)}/map/stream${query}`);
        source.addEventListener("map", (event) => {
          this.status.set("live");
          this.loadError.set("");
          try { this.receive(JSON.parse((event as MessageEvent<string>).data) as BattleMapView); } catch { /* ignore a garbled event */ }
        });
        source.addEventListener("gone", () => { source?.close(); this.loadError.set("notfound"); });
        source.onerror = () => {
          this.status.set("offline");
          if (source?.readyState !== EventSource.CLOSED) return; // the browser is retrying on its own
          source.close();
          // Closed for good (an HTTP error, not a drop): find out why with a plain request.
          api<{ map: BattleMapView }>(`/api/campaigns/${encodeURIComponent(campaignId)}/map${query}`)
            .then(({ map: fresh }) => { this.receive(fresh, true); retry = setTimeout(open, 3_000); })
            .catch((cause: unknown) => {
              if (cause instanceof ApiError && cause.status === 401) this.loadError.set("signin");
              else if (cause instanceof ApiError && (cause.status === 403 || cause.status === 404)) this.loadError.set("notfound");
              // The error screen is only for a map that never loaded; once on screen it stays, marked offline.
              else { if (!this.map()) this.loadError.set("load"); retry = setTimeout(open, 5_000); }
            });
        };
      };
      untracked(open);
      onCleanup(() => { stopped = true; source?.close(); clearTimeout(retry); });
    });

    // Table display: full screen, screen kept awake, players' view.
    effect((onCleanup) => {
      if (!this.tableMode()) return;
      let lock: { release(): Promise<void> } | null = null;
      const nav = navigator as Navigator & { wakeLock?: { request(type: "screen"): Promise<{ release(): Promise<void> }> } };
      nav.wakeLock?.request("screen").then((sentinel) => { lock = sentinel; }).catch(() => undefined);
      const onFullscreen = () => { if (!document.fullscreenElement) this.tableMode.set(false); };
      document.addEventListener("fullscreenchange", onFullscreen);
      onCleanup(() => {
        document.removeEventListener("fullscreenchange", onFullscreen);
        lock?.release().catch(() => undefined);
      });
    });

    // Escape stops drawing walls.
    effect((onCleanup) => {
      const wallTool = this.wallTool();
      const wallStart = this.wallStart();
      if (!wallTool) return;
      const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") { if (wallStart) this.wallStart.set(null); else this.wallTool.set(null); } };
      window.addEventListener("keydown", onKey);
      onCleanup(() => window.removeEventListener("keydown", onKey));
    });
  }

  protected changeAutoSheet(on: boolean): void {
    this.autoSheet.set(on);
    try { window.localStorage.setItem(AUTO_SHEET_ITEM, on ? "on" : "off"); } catch { /* storage disabled */ }
  }

  // Speed, initiative bonus and size come from the character sheet or the stat block. A monster typed in by hand
  // is looked up by its name; `slug` then says which stat block was found, so the fight can link it for good.
  // A new function whenever the characters arrive, so the fight's setup looks the heroes up again.
  protected readonly infoFor = computed(() => {
    const characters = this.characters();
    return async (token: MapToken): Promise<CombatInfo> => {
      if (token.kind === "hero") return combatInfo(token, token.characterId ? characters?.get(token.characterId) : undefined, undefined);
      const slug = token.monsterSlug ?? await findCreature(token.label);
      const monster = slug ? await loadCreature(slug) : undefined;
      return { ...combatInfo(token, undefined, monster), ...(monster ? { size: tokenSizeFor(monster.size) } : {}), ...(slug && monster && !token.monsterSlug ? { slug } : {}) };
    };
  });

  private readonly receive = (next: BattleMapView, force = false): void => {
    if (!force && this.pending.count > 0 && next.version <= this.pending.ignoreUpTo) return;
    this.map.update((current) => !current || force || next.version >= current.version || next.showsHidden !== current.showsHidden ? next : current);
  };

  protected readonly send = async (ops: MapOp[]): Promise<void> => {
    const map = this.map();
    if (!map) return;
    this.notice.set("");
    // Optimistic: show the change at once with the same rules the server applies.
    let temp = 0;
    const local = applyMapOps(map.state, ops, this.actor(), map.heroes, () => `tmp-${Date.now()}-${temp++}`);
    // The walls this device knows are a subset of the server's, so a move blocked here is blocked there too.
    if (!local.ok && (local.error === "blocked" || local.error === "turn" || local.error === "movement")) { this.notice.set(local.error); return; }
    if (local.ok) this.map.set({ ...map, state: local.state });
    this.pending.count += 1;
    this.pending.ignoreUpTo = Math.max(this.pending.ignoreUpTo, map.version);
    const query = this.audience() === "players" ? "?audience=players" : "";
    const campaignId = this.campaignId();
    try {
      const { map: saved } = await api<{ map: BattleMapView }>(`/api/campaigns/${encodeURIComponent(campaignId)}/map${query}`, { method: "POST", body: { ops } });
      this.pending.count -= 1;
      this.receive(saved);
    } catch (cause) {
      this.pending.count -= 1;
      const code = cause instanceof ApiError && cause.status === 409 ? cause.code : undefined;
      this.notice.set(code === "turn" || code === "movement" ? code : cause instanceof ApiError && cause.status === 409 ? "blocked" : "moveError");
      api<{ map: BattleMapView }>(`/api/campaigns/${encodeURIComponent(campaignId)}/map${query}`).then(({ map: fresh }) => this.receive(fresh, true)).catch(() => undefined);
    }
  };

  /**
   * Give a monster a stat block, and with it every unlinked copy of the same name ("Goblin 2", "Goblin 3"…):
   * their size follows the stat block and, in a fight, so does their speed. The map is read after the stat
   * block arrives, so the change builds on the latest state.
   */
  private async linkMonsters(tokenId: string, slug: string): Promise<void> {
    const monster = await loadCreature(slug);
    const state = this.map()?.state;
    const token = state?.tokens.find((item) => item.id === tokenId);
    if (!state || !token) return;
    const name = baseName(token.label).toLocaleLowerCase();
    const size = monster ? tokenSizeFor(monster.size) : undefined;
    const speed = monster ? combatInfo(token, undefined, monster).speed : undefined;
    const ops = state.tokens.filter((item) => item.id === tokenId || (item.kind === "monster" && !item.monsterSlug && baseName(item.label).toLocaleLowerCase() === name))
      .flatMap((item): MapOp[] => [
        { type: "update", tokenId: item.id, monsterSlug: slug, ...(size !== undefined && size !== item.size ? { size } : {}) },
        ...(speed !== undefined && combatantOf(state, item.id) ? [{ type: "combatant" as const, tokenId: item.id, speed }] : []),
      ]);
    await this.send(ops);
  }

  // Callbacks handed to the child components.
  protected readonly select = (id: string): void => this.selectedId.set(id);
  protected readonly closeSheet = (): void => this.sheetId.set(null);
  /** The sheet on screen is the token's whose sheetId is set. */
  protected readonly link = (slug: string): void => { const id = this.sheetId(); if (id) void this.linkMonsters(id, slug); };
  protected readonly saved = (saved: BattleMapView): void => this.receive(saved, true);
  protected readonly changeWallTool = (tool: WallTool | null): void => {
    this.wallTool.set(tool);
    this.wallStart.set(null);
    this.hoverVertex.set(null);
    if (tool) this.selectedId.set(null);
  };
  protected readonly canMove = (token: MapToken): boolean => { const map = this.map(); return map ? canControlToken(this.actor(), token, map.heroes) : false; };
  protected readonly colorOf = (token: MapToken): string => token.defeated ? defeatedColor : token.kind === "hero" ? this.heroColor().get(token.characterId ?? "") ?? heroColors[0] : monsterColor;
  // Heroes' sheets are open to the whole table; monsters' stat blocks only to the DM.
  protected readonly canSeeSheet = (token: MapToken): boolean => token.kind === "hero" || (this.map()?.isDm ?? false);

  protected readonly heroColor = computed(() => new Map((this.map()?.heroes ?? []).map((hero, index) => [hero.id, heroColors[index % heroColors.length]])));
  protected readonly selected = computed(() => this.map()?.state.tokens.find((token) => token.id === this.selectedId()) ?? null);
  protected readonly selectedEntry = computed(() => { const map = this.map(); const selected = this.selected(); return map && selected ? combatantOf(map.state, selected.id) : undefined; });
  protected readonly activeToken = computed(() => { const state = this.map()?.state; const active = state?.combat?.active; return active ? state.tokens.find((token) => token.id === active) : undefined; });
  protected readonly sheetToken = computed(() => { const sheetId = this.sheetId(); return sheetId ? this.map()?.state.tokens.find((token) => token.id === sheetId) : undefined; });
  protected readonly gutter = GUTTER;
  protected readonly gridWidth = computed(() => (this.map()?.state.cols ?? 0) * CELL);
  protected readonly gridHeight = computed(() => (this.map()?.state.rows ?? 0) * CELL);
  private readonly width = computed(() => GUTTER + this.gridWidth());
  private readonly height = computed(() => GUTTER + this.gridHeight());
  protected readonly viewBox = computed(() => `0 0 ${this.width()} ${this.height()}`);
  protected readonly ratio = computed(() => String(this.width() / this.height()));
  protected readonly minWidth = computed(() => `${(this.map()?.state.cols ?? 0) * 30 + 20}px`);
  protected readonly gridPath = computed(() => {
    const state = this.map()?.state;
    if (!state) return "";
    const width = this.width();
    const height = this.height();
    return [
      ...Array.from({ length: state.cols + 1 }, (_, i) => `M${GUTTER + i * CELL} ${GUTTER}V${height}`),
      ...Array.from({ length: state.rows + 1 }, (_, i) => `M${GUTTER} ${GUTTER + i * CELL}H${width}`),
    ].join("");
  });
  protected readonly columnLabels = computed(() => Array.from({ length: this.map()?.state.cols ?? 0 }, (_, i) => ({ x: GUTTER + i * CELL + CELL / 2, y: GUTTER / 2 + 1, label: columnName(i) })));
  protected readonly rowLabels = computed(() => Array.from({ length: this.map()?.state.rows ?? 0 }, (_, i) => ({ x: GUTTER / 2, y: GUTTER + i * CELL + CELL / 2 + 1, label: i + 1 })));

  // Fog of war: what the party sees, computed the same way the server filters monsters for players.
  private readonly sight = computed(() => { const state = this.map()?.state; return state?.fog ? currentSight(state) : null; });
  /** The fog (squares never seen) and the memory (squares explored earlier) as SVG paths. */
  protected readonly fogPaths = computed(() => {
    const state = this.map()?.state;
    const sight = this.sight();
    if (!state || !sight) return { fog: "", memory: "" };
    // Squares explored earlier stay dimmed (the background shows, monsters don't); the rest is dark.
    const explored = exploredCells(state);
    const allCells = Array.from({ length: state.cols * state.rows }, (_, i) => `${i % state.cols},${Math.floor(i / state.cols)}`);
    return {
      fog: cellsPath(allCells.filter((cell) => !sight.has(cell) && !explored.has(cell))),
      memory: cellsPath(allCells.filter((cell) => !sight.has(cell) && explored.has(cell))),
    };
  });
  private readonly blocked = computed(() => blockingEdges(this.map()?.state.walls));
  /** The token being dragged once it has really moved (its cone is hidden meanwhile). */
  private readonly draggingId = computed(() => { const drag = this.drag(); return drag?.moved ? drag.id : null; });
  protected readonly cones = computed(() => {
    const map = this.map();
    if (!map || !this.showCones()) return [];
    const { state } = map;
    const draggingId = this.draggingId();
    const blocked = this.blocked();
    const sight = this.sight();
    const heroColor = this.heroColor();
    return state.tokens.flatMap((token): { id: string; d: string; color: string; clip: { id: string; url: string; d: string } | null }[] => {
      const vision = tokenVision(token);
      if (!vision || token.defeated || draggingId === token.id) return [];
      const color = token.kind === "hero" ? heroColor.get(token.characterId ?? "") ?? heroColors[0] : monsterColor;
      const d = conePath(token, vision.range, vision.angle);
      if (!blocked.size) return [{ id: token.id, d, color, clip: null }];
      // With walls, the cone is cut to the squares the token really sees (in the players' view, to what the
      // server says the party sees: this device doesn't know every wall).
      const seen = state.sight !== undefined && sight ? sight : tokenSight(token, state.cols, state.rows, blocked);
      const clipId = `sight-${map.campaignId}-${token.id}`;
      return [{ id: token.id, d, color, clip: { id: clipId, url: `url(#${clipId})`, d: cellsPath(seen) } }];
    });
  });
  protected readonly gridClipId = computed(() => `grid-${this.map()?.campaignId ?? ""}`);
  protected readonly gridClipUrl = computed(() => `url(#${this.gridClipId()})`);
  protected readonly backgroundSrc = computed(() => { const map = this.map(); const key = map?.state.background?.key; return map && key ? backgroundUrl(map.campaignId, key) : null; });

  // Where the creature whose turn it is can still get to, round walls (each square 5 ft, diagonals too).
  protected readonly reachPath = computed(() => {
    const state = this.map()?.state;
    const activeToken = this.activeToken();
    const activeEntry = state && activeToken ? combatantOf(state, activeToken.id) : undefined;
    const reachBudget = activeEntry ? movementBudget(activeEntry) : null;
    if (!state || !activeToken || !activeEntry || reachBudget === null || activeToken.defeated || reachBudget <= (activeEntry.moved ?? 0)) return "";
    const cells = new Set<string>();
    for (const spot of movementSteps(state, activeToken, reachBudget - (activeEntry.moved ?? 0)).keys()) {
      const [x, y] = spot.split(",").map(Number);
      for (let dx = 0; dx < activeToken.size; dx++) for (let dy = 0; dy < activeToken.size; dy++) cells.add(`${x + dx},${y + dy}`);
    }
    return cellsPath(cells);
  });

  protected readonly walls = computed(() => this.map()?.state.walls ?? []);
  protected readonly wallViews = computed(() => {
    const state = this.map()?.state;
    if (!state) return [];
    const wallTool = this.wallTool();
    const t = this.t();
    return this.walls().map((wall) => {
      const interactive = wallTool === "erase" || (!wallTool && Boolean(wall.door));
      return {
        wall, key: wallKey(wall), line: wallLine(wall), interactive,
        label: wall.door ? this.doorName(wall) : `${t.toolWall} ${wallSquare(wall, state.cols, state.rows)}`,
        lineClass: bm.wallLine(wall.door === "open" ? "doorOpen" : wall.door ? "doorClosed" : "wall", wallTool === "erase"),
      };
    });
  });
  /** Doors drawn again above the fog so they stand out; clicks go through the fog to the ones below. */
  protected readonly fogDoors = computed(() => {
    if (!this.sight() || this.wallTool()) return [];
    return this.walls().filter((wall) => wall.door).map((wall) => ({
      key: `fog-${wallKey(wall)}`, line: wallLine(wall), lineClass: bm.wallLine(wall.door === "open" ? "doorOpen" : "doorClosed", false),
    }));
  });
  protected readonly wallPreview = computed(() => {
    const wallTool = this.wallTool();
    const start = this.wallStart();
    if (!wallTool || wallTool === "erase" || !start) return null;
    const hover = this.hoverVertex();
    return {
      cx: GUTTER + start.x * CELL, cy: GUTTER + start.y * CELL,
      line: hover ? { x1: GUTTER + start.x * CELL, y1: GUTTER + start.y * CELL, x2: GUTTER + hover.x * CELL, y2: GUTTER + hover.y * CELL } : null,
    };
  });

  /** The tokens as drawn: big ones first so small ones standing next to them stay clickable; the dragged one on top. */
  protected readonly tokenViews = computed(() => {
    const map = this.map();
    if (!map) return [];
    const drag = this.drag();
    const selectedId = this.selectedId();
    const wallTool = this.wallTool();
    const active = map.state.combat?.active;
    const ordered = [...map.state.tokens].sort((a, b) => b.size - a.size || (a.id === drag?.id ? 1 : b.id === drag?.id ? -1 : 0));
    return ordered.map((token) => {
      const dragging = drag?.id === token.id && drag.moved;
      const left = dragging ? drag.x : GUTTER + token.x * CELL;
      const top = dragging ? drag.y : GUTTER + token.y * CELL;
      const span = token.size * CELL;
      const half = span / 2;
      const radius = span / 2 - 4;
      const mine = token.kind === "hero" && map.heroes.some((hero) => hero.id === token.characterId && hero.mine);
      const name = this.tokenName(token);
      return {
        token, name, half, radius,
        transform: `translate(${left}px, ${top}px)`,
        classes: bm.token({ pass: Boolean(wallTool), dragging, hidden: Boolean(token.hidden), movable: this.canMove(token) }),
        acting: token.id === active,
        selected: token.id === selectedId,
        fill: this.colorOf(token),
        disc: bm.disc(mine, Boolean(token.hidden)),
        initials: initials(token),
        fontSize: Math.max(15, Math.min(30, radius * 0.75)),
        cross: token.defeated ? `M${span * 0.28} ${span * 0.28}L${span * 0.72} ${span * 0.72}M${span * 0.72} ${span * 0.28}L${span * 0.28} ${span * 0.72}` : null,
        facing: tokenVision(token) && !token.defeated ? {
          transform: `rotate(${(token.facing ?? 0) * 45} ${half} ${half})`,
          d: `M${half - 7} ${half - radius + 4}L${half} ${half - radius - 7}L${half + 7} ${half - radius + 4}Z`,
        } : null,
      };
    });
  });

  // While dragging a creature in the fight: how far the drop square is, and whether it has that much movement left.
  protected readonly dragCost = computed(() => {
    const map = this.map();
    const drag = this.drag();
    if (!map || !drag?.moved) return null;
    const { state } = map;
    const dragged = state.tokens.find((token) => token.id === drag.id);
    const draggedEntry = dragged ? combatantOf(state, dragged.id) : undefined;
    if (!dragged || !draggedEntry) return null;
    const x = clampCell(Math.round((drag.x - GUTTER) / CELL), dragged.size, state.cols);
    const y = clampCell(Math.round((drag.y - GUTTER) / CELL), dragged.size, state.rows);
    const path = pathLength(state, dragged, x, y);
    const cost = path ?? (map.isDm ? Math.max(Math.abs(x - dragged.x), Math.abs(y - dragged.y)) : null);
    const budget = movementBudget(draggedEntry);
    return {
      x: drag.x + dragged.size * CELL / 2, y: drag.y - 10,
      label: cost === null ? this.t().unreachable : formatDistance(cost, this.i18n.locale()),
      over: cost === null || (budget !== null && (draggedEntry.moved ?? 0) + cost > budget),
    };
  });

  // In a fight, the table display lists everyone in initiative order with the one acting marked.
  protected readonly legend = computed(() => {
    const state = this.map()?.state;
    if (!state) return [];
    const combat = state.combat;
    const rank = new Map(combat?.order.map((entry, index) => [entry.tokenId, index]) ?? []);
    const tokens = combat ? [...state.tokens].sort((a, b) => (rank.get(a.id) ?? Infinity) - (rank.get(b.id) ?? Infinity)) : state.tokens;
    return tokens.map((token) => {
      const index = rank.get(token.id);
      return {
        token,
        classes: bm.legendItem(Boolean(token.defeated), token.id === combat?.active),
        color: this.colorOf(token),
        initials: initials(token),
        note: `${squareName(token.x, token.y)}${combat && index !== undefined ? ` · ${combat.order[index].initiative}` : ""}`,
      };
    });
  });

  protected readonly statusLabel = computed(() => { const status = this.status(); const t = this.t(); return status === "live" ? t.live : status === "connecting" ? t.connecting : t.offline; });

  /** The heroes listed in the panel: all of them for the DM, a player's own otherwise; with their token if placed. */
  protected readonly heroRows = computed(() => {
    const map = this.map();
    if (!map) return [];
    return (map.isDm ? map.heroes : map.heroes.filter((hero) => hero.mine)).map((hero) => ({ hero, token: this.heroToken(hero.id), color: this.heroColor().get(hero.id) }));
  });
  protected readonly unplacedHeroes = computed(() => this.map()?.heroes.filter((hero) => !this.heroToken(hero.id)) ?? []);
  /** The doors next to the selected token that it may open or close. */
  protected readonly selectedDoors = computed(() => {
    const map = this.map();
    const selected = this.selected();
    if (!map || !selected || !this.canMove(selected)) return [];
    return this.walls().filter((wall) => wall.door && nearDoor(selected, wall)).map((door) => ({
      door, key: wallKey(door),
      label: (door.door === "open" ? this.t().closeDoor : this.t().openDoor)(wallSquare(door, map.state.cols, map.state.rows)),
    }));
  });
  protected readonly shareUrl = computed(() => `${window.location.origin}/map/${encodeURIComponent(this.campaignId())}`);

  private heroToken(heroId: string): MapToken | undefined {
    return this.map()?.state.tokens.find((token) => token.kind === "hero" && token.characterId === heroId);
  }

  protected characterOf(token: MapToken): Character | undefined {
    return token.characterId ? this.characters()?.get(token.characterId) : undefined;
  }

  private tokenName(token: MapToken): string {
    const t = this.t();
    return `${token.label}, ${squareName(token.x, token.y)}${token.hidden ? ` (${t.hiddenTag})` : ""}${token.defeated ? ` (${t.defeatedTag})` : ""}${token.id === this.map()?.state.combat?.active ? ` (${t.turnTag})` : ""}`;
  }

  private doorName(wall: MapWall): string {
    const t = this.t();
    const state = this.map()?.state;
    return `${t.door} ${state ? wallSquare(wall, state.cols, state.rows) : ""} (${wall.door === "open" ? t.doorOpen : t.doorClosed})`;
  }

  protected retry(): void {
    this.loadError.set("");
    this.reloadKey.update((key) => key + 1);
  }

  protected enterTable(): void {
    this.selectedId.set(null);
    this.tableMode.set(true);
    // The same element stays on screen in both layouts, so it can stay full screen.
    this.tableRoot()?.nativeElement.requestFullscreen?.().catch(() => undefined);
  }

  protected exitTable(): void {
    this.tableMode.set(false);
    if (document.fullscreenElement) document.exitFullscreen().catch(() => undefined);
  }

  private svgPoint(clientX: number, clientY: number): { x: number; y: number } {
    const svg = this.svg()?.nativeElement;
    const matrix = svg?.getScreenCTM();
    if (!svg || !matrix) return { x: 0, y: 0 };
    const point = new DOMPoint(clientX, clientY).matrixTransform(matrix.inverse());
    return { x: point.x, y: point.y };
  }

  protected moveTo(token: MapToken, x: number, y: number): void {
    const state = this.map()?.state;
    if (!state) return;
    const nx = clampCell(x, token.size, state.cols);
    const ny = clampCell(y, token.size, state.rows);
    if (nx !== token.x || ny !== token.y) void this.send([{ type: "move", tokenId: token.id, x: nx, y: ny }]);
  }

  protected onTokenPointerDown(event: PointerEvent, token: MapToken): void {
    event.stopPropagation();
    this.selectedId.set(token.id);
    if (!this.canMove(token)) return;
    const point = this.svgPoint(event.clientX, event.clientY);
    this.svg()?.nativeElement.setPointerCapture(event.pointerId);
    const left = GUTTER + token.x * CELL;
    const top = GUTTER + token.y * CELL;
    this.drag.set({ id: token.id, pointerId: event.pointerId, offsetX: point.x - left, offsetY: point.y - top, x: left, y: top, startX: point.x, startY: point.y, moved: false });
  }

  private toVertex(point: { x: number; y: number }): Vertex {
    const state = this.map()?.state;
    const cols = state?.cols ?? 0;
    const rows = state?.rows ?? 0;
    return {
      x: Math.max(0, Math.min(cols, Math.round((point.x - GUTTER) / CELL))),
      y: Math.max(0, Math.min(rows, Math.round((point.y - GUTTER) / CELL))),
    };
  }

  /** Snap the second corner onto the first one's row or column, whichever is closer. */
  private wallEnd(start: Vertex, vertex: Vertex): Vertex {
    return Math.abs(vertex.x - start.x) >= Math.abs(vertex.y - start.y) ? { x: vertex.x, y: start.y } : { x: start.x, y: vertex.y };
  }

  private onWallClick(event: MouseEvent): void {
    const wallTool = this.wallTool();
    if (!wallTool || wallTool === "erase") return;
    const vertex = this.toVertex(this.svgPoint(event.clientX, event.clientY));
    const wallStart = this.wallStart();
    if (!wallStart) { this.wallStart.set(vertex); return; }
    const end = this.wallEnd(wallStart, vertex);
    if (end.x === wallStart.x && end.y === wallStart.y) { this.wallStart.set(null); return; }
    void this.send([{ type: "add-walls", walls: [{
      x1: Math.min(wallStart.x, end.x), y1: Math.min(wallStart.y, end.y), x2: Math.max(wallStart.x, end.x), y2: Math.max(wallStart.y, end.y),
      ...(wallTool === "door" ? { door: "closed" as const } : {}),
    }] }]);
    this.wallStart.set(wallTool === "door" ? null : end);
  }

  /** Players: the doors next to one of their heroes. The DM: every door. */
  private canUseDoor(door: MapWall): boolean {
    const map = this.map();
    return Boolean(map && (map.isDm || map.state.tokens.some((token) => token.kind === "hero" && this.canMove(token) && nearDoor(token, door))));
  }

  protected onWallPick(wall: MapWall): void {
    const wallTool = this.wallTool();
    if (wallTool === "erase") { void this.send([{ type: "remove-wall", x1: wall.x1, y1: wall.y1, x2: wall.x2, y2: wall.y2 }]); return; }
    if (wallTool || !wall.door) return;
    if (!this.canUseDoor(wall)) { this.notice.set("tooFar"); return; }
    void this.send([{ type: "door", x1: wall.x1, y1: wall.y1, x2: wall.x2, y2: wall.y2, open: wall.door === "closed" }]);
  }

  protected onWallKey(event: KeyboardEvent, wall: MapWall): void {
    if (event.key === "Enter" || event.key === " ") { event.preventDefault(); this.onWallPick(wall); }
  }

  protected onPointerMove(event: PointerEvent): void {
    const wallStart = this.wallStart();
    if (this.wallTool() && wallStart) {
      const vertex = this.wallEnd(wallStart, this.toVertex(this.svgPoint(event.clientX, event.clientY)));
      const hoverVertex = this.hoverVertex();
      if (vertex.x !== hoverVertex?.x || vertex.y !== hoverVertex?.y) this.hoverVertex.set(vertex);
    }
    const drag = this.drag();
    if (!drag || event.pointerId !== drag.pointerId) return;
    const point = this.svgPoint(event.clientX, event.clientY);
    const moved = drag.moved || Math.hypot(point.x - drag.startX, point.y - drag.startY) > CELL / 4;
    this.drag.set({ ...drag, moved, x: point.x - drag.offsetX, y: point.y - drag.offsetY });
  }

  protected onPointerUp(event: PointerEvent): void {
    const drag = this.drag();
    if (!drag || event.pointerId !== drag.pointerId) return;
    const token = this.map()?.state.tokens.find((item) => item.id === drag.id);
    this.drag.set(null);
    if (token && drag.moved) this.moveTo(token, Math.round((drag.x - GUTTER) / CELL), Math.round((drag.y - GUTTER) / CELL));
  }

  protected onFloorClick(event: MouseEvent): void {
    if (this.wallTool()) { this.onWallClick(event); return; }
    const selected = this.selected();
    if (!selected || !this.canMove(selected)) { this.selectedId.set(null); return; }
    const point = this.svgPoint(event.clientX, event.clientY);
    const offset = Math.floor((selected.size - 1) / 2);
    this.moveTo(selected, Math.floor((point.x - GUTTER) / CELL) - offset, Math.floor((point.y - GUTTER) / CELL) - offset);
  }

  protected turn(token: MapToken, by: 1 | -1): void {
    void this.send([{ type: "face", tokenId: token.id, facing: (((token.facing ?? 0) + by + 8) % 8) as Facing }]);
  }

  protected onTokenKey(event: KeyboardEvent, token: MapToken): void {
    const steps: Record<string, [number, number]> = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };
    if (event.key === "Enter" || event.key === " ") { event.preventDefault(); this.selectedId.set(token.id); return; }
    if (event.key === "Escape") { this.selectedId.set(null); return; }
    const key = event.key.toLowerCase();
    if ((key === "q" || key === "e") && this.canMove(token)) { event.preventDefault(); this.selectedId.set(token.id); this.turn(token, key === "q" ? -1 : 1); return; }
    const step = steps[event.key];
    if (!step || !this.canMove(token)) return;
    event.preventDefault();
    this.selectedId.set(token.id);
    this.moveTo(token, token.x + step[0], token.y + step[1]);
  }

  protected toggleSheet(token: MapToken): void {
    this.sheetId.set(this.sheetId() === token.id ? null : token.id);
  }

  protected removeToken(token: MapToken): void {
    void this.send([{ type: "remove", tokenId: token.id }]);
  }

  protected placeHero(heroId: string): void {
    void this.send([{ type: "place-hero", characterId: heroId }]);
  }

  protected placeAll(): void {
    void this.send(this.unplacedHeroes().map((hero) => ({ type: "place-hero" as const, characterId: hero.id })));
  }

  /** The vision the DM's picker shows: the token's own, or the default for its kind. */
  protected currentVision(token: MapToken): { range: number; angle: VisionAngle } {
    return token.vision ?? (token.kind === "hero" ? DEFAULT_HERO_VISION : { range: 0, angle: 90 as VisionAngle });
  }

  protected setVision(token: MapToken, range: number, angle: VisionAngle): void {
    void this.send([{ type: "update", tokenId: token.id, vision: { range, angle } }]);
  }

  protected setVisionRange(token: MapToken, value: string): void {
    this.setVision(token, Number(value), this.currentVision(token).angle);
  }

  protected setVisionAngle(token: MapToken, value: string): void {
    this.setVision(token, this.currentVision(token).range, Number(value) as VisionAngle);
  }
}

function readAutoSheet(): boolean {
  try { return window.localStorage.getItem(AUTO_SHEET_ITEM) !== "off"; } catch { return true; /* storage disabled */ }
}
