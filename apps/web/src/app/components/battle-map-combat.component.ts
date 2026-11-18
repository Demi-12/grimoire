import {
  ChangeDetectionStrategy, Component, computed, effect, ElementRef, inject, input, linkedSignal, signal, untracked, type OnInit,
} from "@angular/core";
import {
  combatantOf, movementBudget, squareName,
  COMBAT_MAX_SPEED, INITIATIVE_MAX, INITIATIVE_MIN,
  type CombatEntry, type Combatant, type MapOp, type MapState, type MapToken, type TokenSize,
} from "@grimoire/shared/battle-map";
import { sheetFor } from "@grimoire/shared/character-view";
import type { MonsterStatBlock } from "@grimoire/shared/monster-api";
import { abilityModifier } from "@grimoire/shared/rules";
import type { Character } from "../core/api-client";
import { FeedbackService } from "../core/feedback.service";
import { I18nService } from "../core/i18n.service";
import { bm } from "./battle-map-styles";

/**
 * Fights on the battle map: the initiative tracker in the side panel (setting up a fight, the order, whose turn
 * it is, people joining and leaving), the movement read-out shared with the selected-token bar, and the helpers
 * the map uses to know a creature's initiative bonus and speed. The rules themselves live in shared/battle-map.
 */

export type Locale = "en" | "es";

/** Squares as the players' books say it: 5 ft each, or 1.5 m in the Spanish edition. */
export const formatDistance = (squares: number, locale: Locale) => locale === "es"
  ? `${(squares * 1.5).toLocaleString("es-ES", { maximumFractionDigits: 1 })} m` : `${squares * 5} ft`;
/** A typed speed (feet, or metres in Spanish) in whole squares; null when empty or not a number. */
const parseDistance = (value: string, locale: Locale): number | null => {
  const number = Number(value.replace(",", "."));
  if (!value.trim() || !Number.isFinite(number) || number < 0) return null;
  return Math.min(COMBAT_MAX_SPEED, Math.round(number / (locale === "es" ? 1.5 : 5)));
};
const distanceValue = (squares: number | undefined, locale: Locale) => squares === undefined ? "" : String(locale === "es" ? squares * 1.5 : squares * 5);

const text = {
  en: {
    combat: "Initiative", startCombat: "Roll initiative", setupHint: "Type the rolls players call out, or leave them empty to roll for them. Speed limits how far each creature moves on its turn; leave it empty not to limit it.",
    include: "In the fight", bonus: "Bonus", initiative: "Init.", speed: "Speed", speedUnit: "ft", groupSame: "Same roll for monsters of the same kind",
    rollEmpty: "Roll the empty ones", begin: "Start the fight", cancel: "Cancel",
    round: (n: number) => `Round ${n}`, turnOf: (name: string) => `${name}'s turn`, hiddenTurn: "A creature you can't see is acting.",
    next: "Next turn", prev: "Previous turn", endTurn: "End my turn", endCombat: "End the fight", endConfirm: "End the fight and clear the initiative order?",
    movement: "Movement", moved: (used: string, budget: string) => `${used} of ${budget}`, left: (value: string) => `${value} left`, over: (value: string) => `${value} over`,
    movedOnly: (used: string) => `${used} moved`, dash: "Dash", dashOn: "Dashing: double movement", resetMove: "Reset movement",
    jumpTo: (name: string) => `Give the turn to ${name}`, removeFrom: (name: string) => `Take ${name} out of the fight`,
    initiativeOf: (name: string) => `Initiative of ${name}`, speedOf: (name: string) => `Speed of ${name} (ft)`,
    join: "Add to the fight", pickToken: "Choose a token", add: "Add", roll: "Roll", noCombat: "No fight in progress.",
    current: "current turn", defeated: "defeated", hidden: "hidden",
    noOne: "Put some tokens on the map first.",
  },
  es: {
    combat: "Iniciativa", startCombat: "Tirar iniciativa", setupHint: "Escribe las tiradas que digan los jugadores o déjalas vacías para tirarlas tú. La velocidad limita cuánto se mueve cada criatura en su turno; déjala vacía para no limitarla.",
    include: "En el combate", bonus: "Bono", initiative: "Ini.", speed: "Vel.", speedUnit: "m", groupSame: "Misma tirada para monstruos del mismo tipo",
    rollEmpty: "Tirar las vacías", begin: "Empezar el combate", cancel: "Cancelar",
    round: (n: number) => `Ronda ${n}`, turnOf: (name: string) => `Turno de ${name}`, hiddenTurn: "Está actuando una criatura que no ves.",
    next: "Siguiente turno", prev: "Turno anterior", endTurn: "Terminar mi turno", endCombat: "Terminar el combate", endConfirm: "¿Terminar el combate y borrar el orden de iniciativa?",
    movement: "Movimiento", moved: (used: string, budget: string) => `${used} de ${budget}`, left: (value: string) => `quedan ${value}`, over: (value: string) => `${value} de más`,
    movedOnly: (used: string) => `${used} recorridos`, dash: "Correr", dashOn: "Corriendo: movimiento doble", resetMove: "Reiniciar movimiento",
    jumpTo: (name: string) => `Dar el turno a ${name}`, removeFrom: (name: string) => `Sacar a ${name} del combate`,
    initiativeOf: (name: string) => `Iniciativa de ${name}`, speedOf: (name: string) => `Velocidad de ${name} (m)`,
    join: "Añadir al combate", pickToken: "Elige una ficha", add: "Añadir", roll: "Tirar", noCombat: "No hay ningún combate en marcha.",
    current: "turno actual", defeated: "derrotado", hidden: "oculto",
    noOne: "Pon antes alguna ficha en el mapa.",
  },
};

const d20 = () => 1 + Math.floor(Math.random() * 20);
const clampInitiative = (value: number) => Math.max(INITIATIVE_MIN, Math.min(INITIATIVE_MAX, Math.round(value)));
const signedBonus = (value: number) => `${value >= 0 ? "+" : "−"}${Math.abs(value)}`;

/**
 * What the app knows about a creature before the fight: its initiative bonus and its walking speed in squares.
 * For a monster typed in by hand whose stat block was found by its name, `slug` (and the `size` it gives) too.
 */
export interface CombatInfo { bonus: number; speed?: number; slug?: string; size?: TokenSize }

/** Link a monster to the stat block its name led to, so its sheet opens and later fights find it at once. */
const linkOps = (token: MapToken, info: CombatInfo | undefined): MapOp[] => info?.slug && !token.monsterSlug
  ? [{ type: "update", tokenId: token.id, monsterSlug: info.slug, ...(info.size !== undefined && token.size === 1 && info.size !== 1 ? { size: info.size } : {}) }] : [];

/** Initiative bonus and speed from the character sheet or the stat block, when there is one. */
export function combatInfo(token: MapToken, character: Character | undefined, monster: MonsterStatBlock | undefined): CombatInfo {
  if (token.kind === "hero") {
    if (!character) return { bonus: 0, speed: 6 };
    const sheet = sheetFor(character);
    return { bonus: sheet?.initiative ?? abilityModifier(character.scores.dex), speed: Math.round((sheet?.speed ?? 30) / 5) };
  }
  if (!monster) return { bonus: 0 };
  const speeds = Object.entries(monster.speed ?? {}).filter(([kind]) => kind !== "hover")
    .map(([kind, value]) => [kind, Number(/\d+/.exec(String(value ?? ""))?.[0])] as const).filter(([, feet]) => feet > 0);
  const feet = speeds.find(([kind]) => kind === "walk")?.[1] ?? Math.max(0, ...speeds.map(([, value]) => value));
  return { bonus: abilityModifier(monster.dexterity ?? 10), ...(feet ? { speed: Math.min(COMBAT_MAX_SPEED, Math.round(feet / 5)) } : {}) };
}

/** "Movement: 15 ft of 30 ft · 15 ft left", with a bar. */
@Component({
  selector: "app-movement",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: "contents" },
  template: `
    @let shown = view();
    @if (shown.budget === null) {
      <span [class]="styles.movement(inBar())">{{ t().movement }}: {{ t().movedOnly(shown.used) }}</span>
    } @else {
      <span [class]="styles.movement(inBar())">{{ t().movement }}: {{ t().moved(shown.used, shown.budget) }} · <b [attr.class]="shown.over ? styles.over : null">{{ shown.left }}</b><span [class]="styles.moveBar" aria-hidden="true"><span [style.width.%]="shown.fill" [class]="styles.moveFill(shown.over)"></span></span></span>
    }
  `,
})
export class MovementComponent {
  private readonly i18n = inject(I18nService);

  readonly entry = input.required<Combatant>();
  readonly inBar = input(false);

  protected readonly styles = bm;
  protected readonly t = computed(() => text[this.i18n.locale()]);
  protected readonly view = computed(() => {
    const locale = this.i18n.locale();
    const t = text[locale];
    const entry = this.entry();
    const used = entry.moved ?? 0;
    const budget = movementBudget(entry);
    const distance = (squares: number) => formatDistance(squares, locale);
    if (budget === null) return { used: distance(used), budget: null, over: false, left: "", fill: 0 };
    const left = budget - used;
    return {
      used: distance(used), budget: distance(budget), over: left < 0,
      left: left >= 0 ? t.left(distance(left)) : t.over(distance(-left)),
      fill: budget ? Math.min(100, used / budget * 100) : 100,
    };
  });
}

/**
 * A number field that is sent when it's done being typed (on blur or Enter), not on every keystroke.
 * The draft follows the stored value whenever that changes (someone else edited it, or the commit came back).
 */
abstract class DraftNumberInput {
  protected readonly host = inject<ElementRef<HTMLInputElement>>(ElementRef);
  /** The stored value, as the field shows it. */
  protected abstract readonly stored: () => string;
  protected abstract commit(draft: string): void;
  protected readonly draft = linkedSignal(() => this.stored());

  protected typed(): void { this.draft.set(this.host.nativeElement.value); }
  protected blurred(): void { if (this.draft() !== this.stored()) this.commit(this.draft()); }
  protected enter(): void { this.host.nativeElement.blur(); }
}

/** The DM's initiative field on a row of the order. */
@Component({
  selector: "input[appInitiativeInput]",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    type: "number", "[class]": "styles.initiativeInput", "[attr.min]": "min", "[attr.max]": "max", "[attr.aria-label]": "label()",
    "[value]": "draft()", "(input)": "typed()", "(blur)": "blurred()", "(keydown.enter)": "enter()",
  },
  template: "",
})
export class InitiativeInputComponent extends DraftNumberInput {
  readonly value = input.required<number>();
  readonly label = input.required<string>();
  readonly onChange = input.required<(value: number) => void>();

  protected readonly styles = bm;
  protected readonly min = INITIATIVE_MIN;
  protected readonly max = INITIATIVE_MAX;
  protected readonly stored = computed(() => String(this.value()));

  protected commit(typed: string): void {
    const number = Number(typed);
    if (typed.trim() && Number.isFinite(number)) this.onChange()(clampInitiative(number));
  }
}

/** The DM's speed field for the creature whose turn it is, in feet or metres. */
@Component({
  selector: "input[appSpeedInput]",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    type: "number", "[class]": "styles.initiativeInput", min: "0", "[attr.step]": "step()", "[attr.aria-label]": "label()",
    "[value]": "draft()", "(input)": "typed()", "(blur)": "blurred()", "(keydown.enter)": "enter()",
  },
  template: "",
})
export class SpeedInputComponent extends DraftNumberInput {
  private readonly i18n = inject(I18nService);

  readonly entry = input.required<Combatant>();
  readonly label = input.required<string>();
  readonly onChange = input.required<(speed: number | null) => void>();

  protected readonly styles = bm;
  protected readonly step = computed(() => this.i18n.locale() === "es" ? 1.5 : 5);
  protected readonly stored = computed(() => distanceValue(this.entry().speed, this.i18n.locale()));

  protected commit(typed: string): void { this.onChange()(parseDistance(typed, this.i18n.locale())); }
}

type SetupRow = { include: boolean; initiative: string; speed: string; speedTouched: boolean };
const blankRow = (): SetupRow => ({ include: true, initiative: "", speed: "", speedTouched: false });

/** Before the fight: who's in it, their rolls and speeds. Bonuses come from the character sheets and stat blocks. */
@Component({
  selector: "app-combat-setup",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: "contents" },
  template: `
    <div [class]="styles.setup">
      <p [class]="styles.empty">{{ t().setupHint }}</p>
      <table [class]="styles.setupTable">
        <thead><tr><th scope="col"><span class="sr-only">{{ t().include }}</span></th><th scope="col"></th><th scope="col">{{ t().bonus }}</th><th scope="col">{{ t().initiative }}</th><th scope="col">{{ t().speed }} ({{ t().speedUnit }})</th></tr></thead>
        <tbody>
          @for (line of lines(); track line.token.id) {
            <tr [attr.class]="line.row.include ? null : styles.setupOut">
              <td><input #include type="checkbox" [checked]="line.row.include" [attr.aria-label]="t().include + ': ' + line.token.label" (change)="change(line.token.id, 'include', include.checked)" /></td>
              <th scope="row"><span [class]="styles.legendDot" [style.background]="line.color" aria-hidden="true"></span> {{ line.token.label }}</th>
              <td>{{ line.bonus }}</td>
              <td><input #initiative [class]="styles.initiativeInput" type="number" [attr.min]="min" [attr.max]="max" placeholder="d20" [attr.aria-label]="t().initiativeOf(line.token.label)"
                [value]="line.row.initiative" [disabled]="!line.row.include" (input)="change(line.token.id, 'initiative', initiative.value)" /></td>
              <td><input #speed [class]="styles.initiativeInput" type="number" min="0" [attr.step]="step()" [attr.aria-label]="t().speedOf(line.token.label)"
                [value]="line.row.speed" [disabled]="!line.row.include" (input)="change(line.token.id, 'speed', speed.value)" /></td>
            </tr>
          }
        </tbody>
      </table>
      <label [class]="styles.check"><input #grouped type="checkbox" [checked]="group()" (change)="group.set(grouped.checked)" />{{ t().groupSame }}</label>
      <div [class]="styles.form">
        <button type="button" class="button button-quiet" [disabled]="!included()" (click)="rows.set(rolled())">🎲 {{ t().rollEmpty }}</button>
        <button type="button" class="button button-primary" [disabled]="!included()" (click)="begin()">⚔ {{ t().begin }}</button>
        <button type="button" class="button button-quiet" (click)="onCancel()()">{{ t().cancel }}</button>
      </div>
    </div>
  `,
})
export class CombatSetupComponent implements OnInit {
  private readonly i18n = inject(I18nService);

  readonly state = input.required<MapState>();
  readonly colorOf = input.required<(token: MapToken) => string>();
  readonly send = input.required<(ops: MapOp[]) => Promise<void>>();
  readonly infoFor = input.required<(token: MapToken) => Promise<CombatInfo>>();
  readonly onCancel = input.required<() => void>();

  protected readonly styles = bm;
  protected readonly min = INITIATIVE_MIN;
  protected readonly max = INITIATIVE_MAX;
  protected readonly t = computed(() => text[this.i18n.locale()]);
  protected readonly step = computed(() => this.i18n.locale() === "es" ? 1.5 : 5);

  private readonly info = signal<Record<string, CombatInfo>>({});
  protected readonly rows = signal<Record<string, SetupRow>>({});
  protected readonly group = signal(true);
  /** Look the creatures up again only when a token comes, goes or gets another stat block, not when one moves. */
  private readonly tokenKey = computed(() => this.state().tokens.map((token) => `${token.id}:${token.monsterSlug ?? ""}`).join("|"));
  private readonly tokens = computed(() => { this.tokenKey(); return untracked(() => this.state().tokens); });

  protected readonly included = computed(() => this.state().tokens.filter((token) => this.row(token.id).include).length);
  protected readonly lines = computed(() => {
    const info = this.info();
    const colorOf = this.colorOf();
    return this.state().tokens.map((token) => {
      const bonus = info[token.id]?.bonus;
      return { token, row: this.row(token.id), color: colorOf(token), bonus: bonus === undefined ? "…" : signedBonus(bonus) };
    });
  });

  constructor() {
    effect((onCleanup) => {
      const tokens = this.tokens();
      const infoFor = this.infoFor();
      const locale = this.i18n.locale();
      let live = true;
      untracked(() => {
        for (const token of tokens) {
          void infoFor(token).then((found) => {
            if (!live) return;
            this.info.update((current) => ({ ...current, [token.id]: found }));
            this.rows.update((current) => {
              const row = current[token.id] ?? blankRow();
              return row.speedTouched ? current : { ...current, [token.id]: { ...row, speed: distanceValue(found.speed, locale) } };
            });
          });
        }
      });
      onCleanup(() => { live = false; });
    });
  }

  ngOnInit(): void {
    this.rows.set(Object.fromEntries(this.state().tokens.map((token) => [token.id, {
      include: !(token.kind === "monster" && token.defeated), initiative: "", speed: "", speedTouched: false,
    }])));
  }

  private row(id: string): SetupRow { return this.rows()[id] ?? blankRow(); }

  protected change(id: string, field: "include", value: boolean): void;
  protected change(id: string, field: "initiative" | "speed", value: string): void;
  protected change(id: string, field: "include" | "initiative" | "speed", value: boolean | string): void {
    const patch: Partial<SetupRow> = field === "include" ? { include: Boolean(value) }
      : field === "initiative" ? { initiative: String(value) } : { speed: String(value), speedTouched: true };
    this.rows.update((current) => ({ ...current, [id]: { ...(current[id] ?? blankRow()), ...patch } }));
  }

  /** Identical monsters share one roll when asked (the 2024 DMG's suggestion for groups). */
  private groupOf(token: MapToken): string {
    return token.kind === "monster" && this.group() ? `m:${token.monsterSlug ?? token.label.replace(/\s*\d+$/, "").toLocaleLowerCase()}` : `t:${token.id}`;
  }

  protected rolled(): Record<string, SetupRow> {
    const tokens = this.state().tokens;
    const info = this.info();
    const next = { ...this.rows() };
    const groupRolls = new Map<string, number>();
    // A roll typed for one of a group goes to the rest of it.
    for (const token of tokens) {
      const current = this.row(token.id);
      const typed = Number(current.initiative);
      if (current.include && current.initiative.trim() && Number.isFinite(typed) && !groupRolls.has(this.groupOf(token))) groupRolls.set(this.groupOf(token), clampInitiative(typed));
    }
    for (const token of tokens) {
      const current = this.row(token.id);
      if (!current.include || current.initiative.trim()) continue;
      const key = this.groupOf(token);
      if (!groupRolls.has(key)) groupRolls.set(key, clampInitiative(d20() + (info[token.id]?.bonus ?? 0)));
      next[token.id] = { ...current, initiative: String(groupRolls.get(key)) };
    }
    return next;
  }

  protected begin(): void {
    const tokens = this.state().tokens;
    const info = this.info();
    const locale = this.i18n.locale();
    const filled = this.rolled();
    const entries: CombatEntry[] = tokens.flatMap((token) => {
      const current = filled[token.id];
      if (!current?.include) return [];
      const initiative = Number(current.initiative);
      const speed = parseDistance(current.speed, locale);
      return [{ tokenId: token.id, initiative: clampInitiative(Number.isFinite(initiative) ? initiative : 0), ...(speed !== null ? { speed } : {}) }];
    });
    if (entries.length) void this.send()([...tokens.flatMap((token) => filled[token.id]?.include ? linkOps(token, info[token.id]) : []), { type: "combat-start", entries }]);
  }
}

/** Initiative order, whose turn it is and how far it has moved; the DM runs it, players end their own turns. */
@Component({
  selector: "app-battle-map-combat",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MovementComponent, InitiativeInputComponent, SpeedInputComponent, CombatSetupComponent],
  host: { class: "contents" },
  templateUrl: "./battle-map-combat.component.html",
})
export class BattleMapCombatComponent {
  private readonly i18n = inject(I18nService);
  private readonly feedback = inject(FeedbackService);

  readonly state = input.required<MapState>();
  readonly isDm = input.required<boolean>();
  readonly colorOf = input.required<(token: MapToken) => string>();
  readonly canControl = input.required<(token: MapToken) => boolean>();
  readonly selectedId = input.required<string | null>();
  readonly onSelect = input.required<(id: string) => void>();
  readonly send = input.required<(ops: MapOp[]) => Promise<void>>();
  readonly infoFor = input.required<(token: MapToken) => Promise<CombatInfo>>();

  protected readonly styles = bm;
  protected readonly min = INITIATIVE_MIN;
  protected readonly max = INITIATIVE_MAX;
  protected readonly t = computed(() => text[this.i18n.locale()]);

  protected readonly setup = signal(false);
  protected readonly combat = computed(() => this.state().combat);

  // The fight in progress (everything below is only shown while there is one).
  protected readonly joinId = signal("");
  protected readonly joinInitiative = signal("");
  private readonly tokens = computed(() => new Map(this.state().tokens.map((token) => [token.id, token])));
  protected readonly active = computed(() => { const id = this.combat()?.active; return id ? this.tokens().get(id) : undefined; });
  protected readonly activeEntry = computed(() => { const active = this.active(); return active ? combatantOf(this.state(), active.id) : undefined; });
  protected readonly mayEnd = computed(() => { const active = this.active(); return this.isDm() || (active !== undefined && this.canControl()(active)); });
  protected readonly mayTool = computed(() => { const active = this.active(); return active !== undefined && (this.isDm() || this.canControl()(active)); });
  protected readonly outside = computed(() => this.state().tokens.filter((token) => !combatantOf(this.state(), token.id)));

  /** The rows of the initiative order, with everything they show. */
  protected readonly order = computed(() => {
    const combat = this.combat();
    if (!combat) return [];
    const t = this.t();
    const locale = this.i18n.locale();
    const distance = (squares: number) => formatDistance(squares, locale);
    const tokens = this.tokens();
    const colorOf = this.colorOf();
    return combat.order.flatMap((entry) => {
      const token = tokens.get(entry.tokenId);
      if (!token) return [];
      const isActive = entry.tokenId === combat.active;
      const budget = movementBudget(entry);
      const tags = [token.hidden ? t.hidden : "", token.defeated ? t.defeated : ""].filter(Boolean).join(" · ");
      const moved = entry.moved ?? 0;
      return [{
        entry, token, isActive,
        className: bm.orderItem({ active: isActive, defeated: Boolean(token.defeated), hidden: Boolean(token.hidden) }),
        color: colorOf(token),
        detail: `${squareName(token.x, token.y)}${tags ? ` · ${tags}` : ""}${moved > 0 ? ` · ${budget !== null ? t.moved(distance(moved), distance(budget)) : t.movedOnly(distance(moved))}` : ""}`,
        setInitiative: (initiative: number) => void this.send()([{ type: "combatant", tokenId: token.id, initiative }]),
      }];
    });
  });

  constructor() {
    effect(() => {
      const combat = this.combat();
      untracked(() => {
        if (combat) this.setup.set(false);
        else { this.joinId.set(""); this.joinInitiative.set(""); }
      });
    });
  }

  protected readonly cancelSetup = () => this.setup.set(false);

  protected turn(step: 1 | -1): void { void this.send()([{ type: "turn", step }]); }
  protected jumpTo(token: MapToken): void { void this.send()([{ type: "turn", tokenId: token.id }]); }
  protected leave(token: MapToken): void { void this.send()([{ type: "combat-leave", tokenId: token.id }]); }

  protected toggleDash(active: MapToken, entry: Combatant): void { void this.send()([{ type: "dash", tokenId: active.id, dash: !entry.dash }]); }
  protected resetMove(active: MapToken): void { void this.send()([{ type: "combatant", tokenId: active.id, moved: 0 }]); }
  protected readonly setActiveSpeed = (speed: number | null) => {
    const active = this.active();
    if (active) void this.send()([{ type: "combatant", tokenId: active.id, speed }]);
  };

  protected async join(): Promise<void> {
    const token = this.tokens().get(this.joinId());
    if (!token) return;
    const info = await this.infoFor()(token);
    const typedText = this.joinInitiative();
    const typed = Number(typedText);
    const initiative = typedText.trim() && Number.isFinite(typed) ? clampInitiative(typed) : clampInitiative(d20() + info.bonus);
    await this.send()([...linkOps(token, info), { type: "combatant", tokenId: token.id, initiative, ...(info.speed !== undefined ? { speed: info.speed } : {}) }]);
    this.joinId.set("");
    this.joinInitiative.set("");
  }

  protected async endCombat(): Promise<void> {
    const t = this.t();
    if (await this.feedback.confirm({ title: t.endConfirm, confirmLabel: t.endCombat, tone: "danger" })) void this.send()([{ type: "combat-end" }]);
  }
}
