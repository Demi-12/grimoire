import { ChangeDetectionStrategy, Component, computed, effect, ElementRef, inject, input, linkedSignal, signal, untracked, viewChild } from "@angular/core";
import {
  currentSight, isMonsterSlug, rowsForImage, squareName, tokenInSight, tokenSizeFor,
  MAP_MAX_MONSTERS_PER_ADD, MAP_MAX_SIZE, MAP_MIN_SIZE, TOKEN_LABEL_MAX,
  type MapHero, type MapOp, type MapState, type MapToken, type TokenSize, type VisionAngle,
} from "@grimoire/shared/battle-map";
import { api, ApiError, type MapSaveSummary, type SavedEncounter } from "../core/api-client";
import { FeedbackService } from "../core/feedback.service";
import { I18nService } from "../core/i18n.service";
import { creatureSearch, findCreature, loadCreature, type CreatureChoice } from "./battle-map-bestiary";
import { bm } from "./battle-map-styles";

/**
 * The battle map's texts and the pieces of its side panel that keep their own state: the DM's tools
 * (monsters, grid, walls and doors, background picture), the saved maps, and the share link. The board itself
 * and everything else on the page is BattleMapComponent (battle-map.component.ts).
 */

/** The map as the API sends it (mirrors BattleMapView in the server's battle map data layer). */
export interface BattleMapView {
  campaignId: string; campaignName: string; version: number; isDm: boolean; showsHidden: boolean;
  heroes: (MapHero & { mine: boolean })[]; state: MapState; updatedAt: string;
}

export type WallTool = "wall" | "door" | "erase";

export const monsterColor = "#922610";
export const defeatedColor = "#6b6158";

/** URL of the map's background picture; the key makes every upload a new URL. */
export const backgroundUrl = (campaignId: string, key: string) => `/api/campaigns/${encodeURIComponent(campaignId)}/map/background?k=${encodeURIComponent(key)}`;

export const text = {
  en: {
    back: "Campaigns", kicker: "BATTLE MAP", docTitle: (name: string) => `${name} · Battle map · Grimoire`, live: "Live", connecting: "Connecting…", offline: "Reconnecting…",
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
    suggestions: "Creatures with that name", linked: (name: string, source?: string) => `Stat block: ${name}${source ? ` (${source})` : ""}. Speed, initiative and size come from it.`,
    autoLinkHint: "Pick a creature, or type its exact name, and its speed, initiative and size are filled in for you.",
    unlinkedTag: "no stat block", linkAll: "Find their stat blocks", linking: "Searching…",
    linkedCount: (n: number) => n === 1 ? "1 monster linked to its stat block." : `${n} monsters linked to their stat blocks.`,
    noneLinked: "No creature with those names in the bestiary. Link them from their sheet.",
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
    loadConfirm: (name: string) => `Replace the map on the table with "${name}"?`, keepCurrent: "Save the current one first if you want to keep it.",
    deleteConfirm: (name: string) => `Delete the saved map "${name}"?`, cannotUndo: "This can't be undone.",
    newMap: "Start an empty map", newMapConfirm: "Clear the table and start an empty map?",
    savedMap: (name: string) => `Map "${name}" saved.`, loadedMap: (name: string) => `"${name}" is on the table.`,
    deletedMap: (name: string) => `Saved map "${name}" deleted.`, newMapDone: "The table is clear.",
    noSaves: "No saved maps yet.", saveError: "That couldn't be done. A campaign keeps up to 20 saved maps.",
    saveSummary: (save: MapSaveSummary, date: string) => `${save.cols}×${save.rows} · ${save.tokens} tokens · ${save.walls} walls${save.hasBackground ? " · picture" : ""} · ${date}`,
    turn: "It isn't this hero's turn yet: wait for the DM to pass it on.", movement: "Not enough movement left this turn. Dash if you need more, or ask the DM.",
    sheet: "Sheet", autoSheet: "Open the sheet when picking a token",
    roundTurn: (round: number, name: string) => `Round ${round} · ${name}'s turn`, roundOnly: (round: number) => `Round ${round}`,
    turnTag: "their turn", unreachable: "can't get there",
  },
  es: {
    back: "Campañas", kicker: "MAPA DE BATALLA", docTitle: (name: string) => `${name} · Mapa de batalla · Grimoire`, live: "En directo", connecting: "Conectando…", offline: "Reconectando…",
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
    suggestions: "Criaturas con ese nombre", linked: (name: string, source?: string) => `Ficha: ${name}${source ? ` (${source})` : ""}. De ella salen la velocidad, la iniciativa y el tamaño.`,
    autoLinkHint: "Elige una criatura, o escribe su nombre exacto, y se rellenan solas su velocidad, iniciativa y tamaño.",
    unlinkedTag: "sin ficha", linkAll: "Buscar sus fichas", linking: "Buscando…",
    linkedCount: (n: number) => n === 1 ? "1 monstruo enlazado a su ficha." : `${n} monstruos enlazados a sus fichas.`,
    noneLinked: "No hay criaturas con esos nombres en el bestiario. Enlázalas desde su ficha.",
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
    loadConfirm: (name: string) => `¿Sustituir el mapa de la mesa por «${name}»?`, keepCurrent: "Guarda antes el actual si quieres conservarlo.",
    deleteConfirm: (name: string) => `¿Borrar el mapa guardado «${name}»?`, cannotUndo: "No se puede deshacer.",
    newMap: "Empezar un mapa vacío", newMapConfirm: "¿Vaciar la mesa y empezar un mapa vacío?",
    savedMap: (name: string) => `Mapa «${name}» guardado.`, loadedMap: (name: string) => `«${name}» está en la mesa.`,
    deletedMap: (name: string) => `Mapa guardado «${name}» borrado.`, newMapDone: "La mesa está vacía.",
    noSaves: "Aún no hay mapas guardados.", saveError: "No se pudo hacer. Una campaña guarda hasta 20 mapas.",
    saveSummary: (save: MapSaveSummary, date: string) => `${save.cols}×${save.rows} · ${save.tokens} fichas · ${save.walls} muros${save.hasBackground ? " · imagen" : ""} · ${date}`,
    turn: "Aún no es el turno de este héroe: espera a que el DM lo pase.", movement: "No te queda movimiento suficiente este turno. Usa Correr si necesitas más o pídeselo al DM.",
    sheet: "Ficha", autoSheet: "Abrir la ficha al elegir una ficha del mapa",
    roundTurn: (round: number, name: string) => `Ronda ${round} · turno de ${name}`, roundOnly: (round: number) => `Ronda ${round}`,
    turnTag: "su turno", unreachable: "no puede llegar",
  },
};

const tokenSizes: TokenSize[] = [1, 2, 3, 4];
const wallTools: WallTool[] = ["wall", "door", "erase"];

/**
 * A number input that never shows a value out of range: what was typed is clamped (empty or not a number
 * gives `fallback`) and the field is rewritten when the clamped number differs from it.
 */
function clampedInput(input: HTMLInputElement, min: number, max: number, fallback: number): number {
  const value = Math.max(min, Math.min(max, Number(input.value) || fallback));
  if (input.value !== String(value)) input.value = String(value);
  return value;
}

/** The share link with a copy button. */
@Component({
  selector: "app-battle-map-copy-link",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: "contents" },
  template: `
    <div [class]="bm.copy">
      <input #field readonly [class]="bm.copyInput" [value]="url()" [attr.aria-label]="t().copy" (focus)="field.select()" />
      <button type="button" [class]="bm.smallButton" (click)="copy()">{{ copied() ? t().copied : t().copy }}</button>
    </div>
  `,
})
export class CopyLinkComponent {
  private readonly i18n = inject(I18nService);
  protected readonly t = computed(() => text[this.i18n.locale()]);
  protected readonly bm = bm;

  readonly url = input.required<string>();

  protected readonly copied = signal(false);

  protected copy(): void {
    navigator.clipboard?.writeText(this.url()).then(() => { this.copied.set(true); setTimeout(() => this.copied.set(false), 2_000); }).catch(() => undefined);
  }
}

/** Saved copies of the map: save the one on the table, load one back, delete, or clear the table. */
@Component({
  selector: "app-battle-map-saved-maps",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: "contents" },
  template: `
    <section>
      <h2>{{ t().saves }}</h2>
      <form [class]="bm.form" (submit)="save($event)">
        <label [class]="bm.grow">{{ t().saveName }}<input #nameField required [class]="bm.field" maxlength="60" [value]="name()" (input)="name.set(nameField.value)" /></label>
        <button type="submit" class="button button-primary" [disabled]="busy()">{{ busy() ? t().saving : t().saveAction }}</button>
      </form>
      @if (saves(); as saves) {
        @if (saves.length) {
          <ul [class]="bm.list">
            @for (save of saves; track save.id) {
              <li [class]="bm.listItem()">
                <span [class]="bm.itemName">{{ save.name }}<small>{{ t().saveSummary(save, date(save.createdAt)) }}</small></span>
                <button type="button" [class]="bm.smallButton" [disabled]="busy()" (click)="load(save)">{{ t().load }}</button>
                <button type="button" [class]="bm.smallButton" [disabled]="busy()" [attr.aria-label]="t().deleteSave + ': ' + save.name" (click)="remove(save)">×</button>
              </li>
            }
          </ul>
        } @else {
          <p [class]="bm.empty">{{ t().noSaves }}</p>
        }
      }
      <button type="button" class="button button-quiet" [disabled]="busy()" (click)="reset()">{{ t().newMap }}</button>
      <p [class]="bm.empty">{{ t().savesHint }}</p>
    </section>
  `,
})
export class SavedMapsComponent {
  private readonly i18n = inject(I18nService);
  private readonly feedback = inject(FeedbackService);
  protected readonly t = computed(() => text[this.i18n.locale()]);
  protected readonly bm = bm;

  readonly map = input.required<BattleMapView>();
  readonly onLoaded = input.required<(map: BattleMapView) => void>();
  readonly playersAudience = input.required<boolean>();

  protected readonly saves = signal<MapSaveSummary[] | null>(null);
  protected readonly name = signal("");
  protected readonly busy = signal(false);
  private readonly campaignId = computed(() => this.map().campaignId);
  private readonly base = computed(() => `/api/campaigns/${encodeURIComponent(this.campaignId())}/map`);
  private readonly query = computed(() => this.playersAudience() ? "?audience=players" : "");

  constructor() {
    effect(() => {
      const savesUrl = `${this.base()}/saves`;
      untracked(() => {
        api<{ saves: MapSaveSummary[] }>(savesUrl).then((data) => this.saves.set(data.saves)).catch(() => this.saves.set([]));
      });
    });
  }

  private async run<T>(action: () => Promise<T>, done: (value: T) => void, success: string): Promise<void> {
    this.busy.set(true);
    try { done(await action()); this.feedback.toast.success(success); } catch { this.feedback.toast.error(this.t().saveError); } finally { this.busy.set(false); }
  }

  protected date(iso: string): string {
    return new Date(iso).toLocaleString(this.i18n.locale() === "es" ? "es-ES" : "en-GB", { dateStyle: "medium", timeStyle: "short" });
  }

  protected save(event: Event): void {
    event.preventDefault();
    const trimmed = this.name().trim();
    if (trimmed) void this.run(() => api<{ saves: MapSaveSummary[] }>(`${this.base()}/saves`, { method: "POST", body: { name: trimmed } }), (data) => { this.saves.set(data.saves); this.name.set(""); }, this.t().savedMap(trimmed));
  }

  protected async load(save: MapSaveSummary): Promise<void> {
    const t = this.t();
    if (await this.feedback.confirm({ title: t.loadConfirm(save.name), message: t.keepCurrent, confirmLabel: t.load })) {
      void this.run(() => api<{ map: BattleMapView }>(`${this.base()}/saves/${save.id}${this.query()}`, { method: "POST" }), (data) => this.onLoaded()(data.map), t.loadedMap(save.name));
    }
  }

  protected async remove(save: MapSaveSummary): Promise<void> {
    const t = this.t();
    if (await this.feedback.confirm({ title: t.deleteConfirm(save.name), message: t.cannotUndo, confirmLabel: t.deleteSave, tone: "danger" })) {
      void this.run(() => api<{ saves: MapSaveSummary[] }>(`${this.base()}/saves/${save.id}`, { method: "DELETE" }), (data) => this.saves.set(data.saves), t.deletedMap(save.name));
    }
  }

  protected async reset(): Promise<void> {
    const t = this.t();
    if (await this.feedback.confirm({ title: t.newMapConfirm, message: t.keepCurrent, confirmLabel: t.newMap, tone: "danger" })) {
      void this.run(() => api<{ map: BattleMapView }>(`${this.base()}/reset${this.query()}`, { method: "POST" }), (data) => this.onLoaded()(data.map), t.newMapDone);
    }
  }
}

/** The DM's side panel: add monsters (by hand or from the encounter journal), manage them, the grid, walls and doors, the background and saved maps. */
@Component({
  selector: "app-battle-map-dm-tools",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SavedMapsComponent],
  host: { class: "contents" },
  templateUrl: "./battle-map-tools.component.html",
})
export class DmToolsComponent {
  private readonly i18n = inject(I18nService);
  private readonly feedback = inject(FeedbackService);
  protected readonly t = computed(() => text[this.i18n.locale()]);
  protected readonly bm = bm;
  protected readonly tokenSizes = tokenSizes;
  protected readonly wallTools = wallTools;
  protected readonly tokenLabelMax = TOKEN_LABEL_MAX;
  protected readonly maxPerAdd = MAP_MAX_MONSTERS_PER_ADD;
  protected readonly minSize = MAP_MIN_SIZE;
  protected readonly maxSize = MAP_MAX_SIZE;
  protected readonly monsterColor = monsterColor;
  protected readonly defeatedColor = defeatedColor;

  readonly map = input.required<BattleMapView>();
  readonly send = input.required<(ops: MapOp[]) => Promise<void>>();
  readonly onSelect = input.required<(id: string) => void>();
  readonly onSaved = input.required<(map: BattleMapView) => void>();
  readonly playersAudience = input.required<boolean>();
  readonly wallTool = input.required<WallTool | null>();
  readonly onWallTool = input.required<(tool: WallTool | null) => void>();

  protected readonly name = signal("");
  protected readonly count = signal(1);
  protected readonly size = signal<TokenSize>(1);
  private readonly sizeTouched = signal(false);
  private readonly picked = signal<CreatureChoice | null>(null);
  protected readonly adding = signal(false);
  protected readonly linking = signal(false);
  protected readonly hidden = signal(true);
  /** The grid's size on the map; the fields below follow it whenever either side changes. */
  private readonly gridSize = computed(() => ({ cols: this.map().state.cols, rows: this.map().state.rows }), { equal: (a, b) => a.cols === b.cols && a.rows === b.rows });
  protected readonly cols = linkedSignal(() => this.gridSize().cols);
  protected readonly rows = linkedSignal(() => this.gridSize().rows);
  protected readonly encounters = signal<SavedEncounter[] | null>(null);
  protected readonly encounterId = signal("");
  protected readonly uploading = signal(false);
  protected readonly uploadError = signal(false);
  private readonly imageSize = signal<{ key: string; width: number; height: number } | null>(null);
  private readonly fileInput = viewChild<ElementRef<HTMLInputElement>>("file");

  private readonly campaignId = computed(() => this.map().campaignId);
  protected readonly monsters = computed(() => this.map().state.tokens.filter((token) => token.kind === "monster"));
  protected readonly backgroundKey = computed(() => this.map().state.background?.key);
  protected readonly backgroundSrc = computed(() => { const key = this.backgroundKey(); return key ? backgroundUrl(this.campaignId(), key) : null; });
  private readonly sight = computed(() => this.map().state.fog ? currentSight(this.map().state) : null);
  protected readonly fittedRows = computed(() => {
    const imageSize = this.imageSize();
    return imageSize && imageSize.key === this.backgroundKey() ? rowsForImage(this.map().state.cols, imageSize.width, imageSize.height) : null;
  });
  protected readonly chosen = computed(() => { const picked = this.picked(); return picked && picked.name === this.name() ? picked : null; });
  protected readonly suggestions = creatureSearch(() => this.chosen() ? "" : this.name()).results;
  protected readonly unlinked = computed(() => this.monsters().filter((token) => !token.monsterSlug));
  protected readonly wallCount = computed(() => this.map().state.walls?.length ?? 0);
  /** The rows of the "On the map" list, with the note under each name worked out once. */
  protected readonly monsterRows = computed(() => {
    const t = this.t();
    const sight = this.sight();
    return this.monsters().map((token) => ({
      token,
      hidden: Boolean(token.hidden),
      color: token.defeated ? defeatedColor : monsterColor,
      note: `${squareName(token.x, token.y)}${token.hidden ? ` · ${t.hiddenTag}` : ""}${token.defeated ? ` · ${t.defeatedTag}` : ""}${token.monsterSlug ? "" : ` · ${t.unlinkedTag}`}${sight && !token.hidden && !tokenInSight(token, sight) ? ` · ${t.unseenTag}` : ""}`,
    }));
  });

  constructor() {
    // The picture's proportions, to offer a number of rows that keeps its squares square.
    effect((onCleanup) => {
      const campaignId = this.campaignId();
      const backgroundKey = this.backgroundKey();
      if (!backgroundKey) return;
      const image = new Image();
      image.onload = () => this.imageSize.set({ key: backgroundKey, width: image.naturalWidth, height: image.naturalHeight });
      image.src = backgroundUrl(campaignId, backgroundKey);
      onCleanup(() => { image.onload = null; });
    });
    effect(() => {
      const campaignId = this.campaignId();
      untracked(() => {
        api<{ encounters: SavedEncounter[] }>(`/api/campaigns/${encodeURIComponent(campaignId)}/encounters`)
          .then((data) => this.encounters.set(data.encounters)).catch(() => this.encounters.set([]));
      });
    });
  }

  protected async changeBackground(file: File | null): Promise<void> {
    this.uploadError.set(false);
    this.uploading.set(true);
    try {
      const query = this.playersAudience() ? "?audience=players" : "";
      const response = await fetch(`/api/campaigns/${encodeURIComponent(this.campaignId())}/map/background${query}`, {
        method: file ? "PUT" : "DELETE", credentials: "same-origin", cache: "no-store",
        ...(file ? { body: file, headers: { "Content-Type": file.type || "application/octet-stream" } } : {}),
      });
      if (!response.ok) throw new ApiError(response.status, response.statusText);
      this.onSaved()(((await response.json()) as { map: BattleMapView }).map);
    } catch {
      this.uploadError.set(true);
    } finally {
      this.uploading.set(false);
      const input = this.fileInput()?.nativeElement;
      if (input) input.value = "";
    }
  }

  protected fileChosen(input: HTMLInputElement): void {
    const file = input.files?.[0];
    if (file) void this.changeBackground(file);
  }

  protected setCount(input: HTMLInputElement): void {
    this.count.set(clampedInput(input, 1, MAP_MAX_MONSTERS_PER_ADD, 1));
  }

  protected setGrid(which: "cols" | "rows", input: HTMLInputElement): void {
    this[which].set(clampedInput(input, MAP_MIN_SIZE, MAP_MAX_SIZE, MAP_MIN_SIZE));
  }

  protected chooseSize(value: string): void {
    this.size.set(Number(value) as TokenSize);
    this.sizeTouched.set(true);
  }

  protected pick(choice: CreatureChoice): void {
    this.name.set(choice.name);
    this.picked.set(choice);
    if (!this.sizeTouched()) void loadCreature(choice.slug).then((monster) => { if (monster) this.size.set(tokenSizeFor(monster.size)); });
  }

  /** The stat block for a name (picked from the list or matched exactly) and the size it gives the tokens. */
  private async creatureFor(label: string, slug?: string): Promise<{ monsterSlug?: string; size?: TokenSize }> {
    const found = slug && isMonsterSlug(slug) ? slug : await findCreature(label);
    if (!found) return {};
    const monster = await loadCreature(found);
    return { monsterSlug: found, ...(monster ? { size: tokenSizeFor(monster.size) } : {}) };
  }

  protected async addMonster(event: Event): Promise<void> {
    event.preventDefault();
    const label = this.name().trim().slice(0, TOKEN_LABEL_MAX);
    if (!label || this.adding()) return;
    this.adding.set(true);
    try {
      const creature = await this.creatureFor(label, this.chosen()?.slug);
      await this.send()([{
        type: "add-monster", label, count: this.count(), size: this.sizeTouched() ? this.size() : creature.size ?? this.size(), hidden: this.hidden(),
        ...(creature.monsterSlug ? { monsterSlug: creature.monsterSlug } : {}),
      }]);
      this.name.set("");
      this.count.set(1);
      this.picked.set(null);
      this.size.set(1);
      this.sizeTouched.set(false);
    } finally {
      this.adding.set(false);
    }
  }

  protected async addEncounter(): Promise<void> {
    const encounter = this.encounters()?.find((item) => item.id === this.encounterId());
    if (!encounter || this.adding()) return;
    this.adding.set(true);
    try {
      const lines = encounter.lines.slice(0, 20);
      const creatures = await Promise.all(lines.map((line) => this.creatureFor(line.name, line.monsterSlug)));
      const hidden = this.hidden();
      await this.send()(lines.map((line, index) => ({
        type: "add-monster" as const, label: line.name.slice(0, TOKEN_LABEL_MAX), count: Math.min(line.count, MAP_MAX_MONSTERS_PER_ADD),
        size: creatures[index].size ?? 1, hidden, ...(creatures[index].monsterSlug ? { monsterSlug: creatures[index].monsterSlug } : {}),
      })));
    } finally {
      this.adding.set(false);
    }
  }

  /** Monsters typed in by hand (or placed before linking worked) get the stat block whose name they carry. */
  protected async linkAll(): Promise<void> {
    this.linking.set(true);
    try {
      const t = this.t();
      const found = await Promise.all(this.unlinked().map(async (token) => ({ token, creature: await this.creatureFor(token.label) })));
      const linked = found.filter(({ creature }) => creature.monsterSlug);
      if (!linked.length) { this.feedback.toast.error(t.noneLinked); return; }
      await this.send()(linked.flatMap(({ token, creature }): MapOp[] => {
        const info = creature.size !== undefined && creature.size !== token.size ? { size: creature.size } : {};
        return [{ type: "update", tokenId: token.id, monsterSlug: creature.monsterSlug, ...info }];
      }));
      this.feedback.toast.success(t.linkedCount(linked.length));
    } finally {
      this.linking.set(false);
    }
  }

  protected toggleHidden(token: MapToken): void {
    void this.send()([{ type: "update", tokenId: token.id, hidden: !token.hidden }]);
  }

  protected toggleDefeated(token: MapToken): void {
    void this.send()([{ type: "update", tokenId: token.id, defeated: !token.defeated }]);
  }

  protected removeToken(token: MapToken): void {
    void this.send()([{ type: "remove", tokenId: token.id }]);
  }

  protected setGridHidden(shown: boolean): void {
    void this.send()([{ type: "settings", gridHidden: !shown }]);
  }

  protected setFog(on: boolean): void {
    void this.send()([{ type: "settings", fog: on }]);
  }

  protected forgetExplored(): void {
    void this.send()([{ type: "settings", resetExplored: true }]);
  }

  protected fitRows(rows: number): void {
    void this.send()([{ type: "resize", cols: this.map().state.cols, rows }]);
  }

  protected setMonsterSize(tokenId: string, value: string): void {
    void this.send()([{ type: "update", tokenId, size: Number(value) as TokenSize }]);
  }

  protected resize(event: Event): void {
    event.preventDefault();
    void this.send()([{ type: "resize", cols: this.cols(), rows: this.rows() }]);
  }

  protected clearMonsters(): void {
    void this.clearAfterConfirm(this.t().clearConfirm, this.t().clearMonsters, { type: "clear-monsters" });
  }

  protected clearWalls(): void {
    void this.clearAfterConfirm(this.t().clearWallsConfirm, this.t().clearWalls, { type: "clear-walls" });
  }

  private async clearAfterConfirm(title: string, confirmLabel: string, op: MapOp): Promise<void> {
    if (await this.feedback.confirm({ title, confirmLabel, tone: "danger" })) await this.send()([op]);
  }

  protected toolLabel(tool: WallTool): string {
    const t = this.t();
    return tool === "wall" ? t.toolWall : tool === "door" ? t.toolDoor : t.toolErase;
  }

  protected pickFile(): void {
    this.fileInput()?.nativeElement.click();
  }
}
