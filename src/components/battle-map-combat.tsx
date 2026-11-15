"use client";

import { useEffect, useMemo, useState } from "react";
import type { Character } from "@/lib/api-client";
import { sheetFor } from "@/lib/character-view";
import type { MonsterStatBlock } from "@/lib/monster-api";
import { abilityModifier } from "@/lib/rules";
import {
  combatantOf, movementBudget, squareName,
  COMBAT_MAX_SPEED, INITIATIVE_MAX, INITIATIVE_MIN,
  type CombatEntry, type Combatant, type MapOp, type MapState, type MapToken,
} from "@/lib/battle-map";
import { useConfirm } from "./feedback";
import { bm as styles } from "./battle-map-styles";

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

/** What the app knows about a creature before the fight: its initiative bonus and its walking speed in squares. */
export interface CombatInfo { bonus: number; speed?: number }

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

type Props = {
  state: MapState; isDm: boolean; locale: Locale; colorOf: (token: MapToken) => string;
  canControl: (token: MapToken) => boolean; selectedId: string | null; onSelect: (id: string) => void;
  send: (ops: MapOp[]) => Promise<void>; infoFor: (token: MapToken) => Promise<CombatInfo>;
};

/** Initiative order, whose turn it is and how far it has moved; the DM runs it, players end their own turns. */
export default function CombatTracker(props: Props) {
  const { state, isDm, locale } = props;
  const t = text[locale];
  const [setup, setSetup] = useState(false);
  const combat = state.combat;
  useEffect(() => { if (combat) setSetup(false); }, [combat]);
  if (!combat) {
    if (!isDm) return null;
    return <section className={styles.combat}>
      <h2>{t.combat}</h2>
      {setup ? <CombatSetup {...props} onCancel={() => setSetup(false)} /> : <>
        <p className={styles.empty}>{t.noCombat}</p>
        <button type="button" className="button button-primary" disabled={!state.tokens.length} onClick={() => setSetup(true)}>⚔ {t.startCombat}</button>
        {!state.tokens.length && <p className={styles.empty}>{t.noOne}</p>}
      </>}
    </section>;
  }
  return <ActiveCombat {...props} />;
}

function ActiveCombat({ state, isDm, locale, colorOf, canControl, selectedId, onSelect, send, infoFor }: Props) {
  const t = text[locale];
  const confirm = useConfirm();
  const combat = state.combat!;
  const tokens = new Map(state.tokens.map((token) => [token.id, token]));
  const active = combat.active ? tokens.get(combat.active) : undefined;
  const activeEntry = active ? combatantOf(state, active.id) : undefined;
  const mayEnd = isDm || (active !== undefined && canControl(active));
  const outside = state.tokens.filter((token) => !combatantOf(state, token.id));
  const [joinId, setJoinId] = useState("");
  const [joinInitiative, setJoinInitiative] = useState("");
  const distance = (squares: number) => formatDistance(squares, locale);

  async function join() {
    const token = tokens.get(joinId);
    if (!token) return;
    const info = await infoFor(token);
    const typed = Number(joinInitiative);
    const initiative = joinInitiative.trim() && Number.isFinite(typed) ? clampInitiative(typed) : clampInitiative(d20() + info.bonus);
    await send([{ type: "combatant", tokenId: token.id, initiative, ...(info.speed !== undefined ? { speed: info.speed } : {}) }]);
    setJoinId("");
    setJoinInitiative("");
  }

  return <section className={styles.combat} aria-label={t.combat}>
    <div className={styles.combatHead}>
      <h2>{t.combat} · {t.round(combat.round)}</h2>
      {isDm && <button type="button" className={styles.smallButton} aria-label={t.prev} title={t.prev} onClick={() => void send([{ type: "turn", step: -1 }])}>◀</button>}
      {mayEnd && <button type="button" className="button button-primary" onClick={() => void send([{ type: "turn", step: 1 }])}>{isDm ? t.next : t.endTurn} ▶</button>}
    </div>
    <div className={styles.turnBanner} aria-live="polite">
      {active ? <>
        <b>{t.turnOf(active.label)}</b>
        {activeEntry && <Movement entry={activeEntry} locale={locale} />}
        {activeEntry && (isDm || canControl(active)) && <span className={styles.turnTools}>
          <button type="button" className={styles.smallButton} aria-pressed={activeEntry.dash === true} title={t.dashOn}
            onClick={() => void send([{ type: "dash", tokenId: active.id, dash: !activeEntry.dash }])}>{t.dash}</button>
          {isDm && (activeEntry.moved ?? 0) > 0 && <button type="button" className={styles.smallButton} onClick={() => void send([{ type: "combatant", tokenId: active.id, moved: 0 }])}>{t.resetMove}</button>}
          {isDm && <label className={styles.inlineField}>{t.speed}
            <SpeedInput entry={activeEntry} locale={locale} label={t.speedOf(active.label)} onChange={(speed) => void send([{ type: "combatant", tokenId: active.id, speed }])} />
            <small>{t.speedUnit}</small></label>}
        </span>}
      </> : <span className={styles.empty}>{t.hiddenTurn}</span>}
    </div>
    <ol className={styles.order}>
      {combat.order.map((entry) => {
        const token = tokens.get(entry.tokenId);
        if (!token) return null;
        const isActive = entry.tokenId === combat.active;
        const budget = movementBudget(entry);
        const tags = [token.hidden ? t.hidden : "", token.defeated ? t.defeated : ""].filter(Boolean).join(" · ");
        return <li key={entry.tokenId} className={styles.orderItem({ active: isActive, defeated: Boolean(token.defeated), hidden: Boolean(token.hidden) })}
          aria-current={isActive ? "step" : undefined}>
          {isDm ? <InitiativeInput value={entry.initiative} label={t.initiativeOf(token.label)} onChange={(initiative) => void send([{ type: "combatant", tokenId: token.id, initiative }])} />
            : <span className={styles.initiative}>{entry.initiative}</span>}
          <span className={styles.legendDot} style={{ background: colorOf(token) }} aria-hidden="true" />
          <button type="button" className={styles.itemName} aria-pressed={token.id === selectedId} onClick={() => onSelect(token.id)}>
            {token.label}{isActive && <span className="sr-only"> ({t.current})</span>}
            <small>{squareName(token.x, token.y)}{tags ? ` · ${tags}` : ""}{(entry.moved ?? 0) > 0 ? ` · ${budget !== null ? t.moved(distance(entry.moved!), distance(budget)) : t.movedOnly(distance(entry.moved!))}` : ""}</small>
          </button>
          {isDm && !isActive && <button type="button" className={styles.smallButton} aria-label={t.jumpTo(token.label)} title={t.jumpTo(token.label)} onClick={() => void send([{ type: "turn", tokenId: token.id }])}>▸</button>}
          {isDm && <button type="button" className={styles.smallButton} aria-label={t.removeFrom(token.label)} title={t.removeFrom(token.label)} onClick={() => void send([{ type: "combat-leave", tokenId: token.id }])}>×</button>}
        </li>;
      })}
    </ol>
    {isDm && outside.length > 0 && <div className={styles.form}>
      <label className={styles.grow}>{t.join}<select className={styles.field} value={joinId} onChange={(event) => setJoinId(event.target.value)}>
        <option value="">{t.pickToken}</option>
        {outside.map((token) => <option key={token.id} value={token.id}>{token.label}</option>)}
      </select></label>
      <label>{t.initiative}<input type="number" min={INITIATIVE_MIN} max={INITIATIVE_MAX} value={joinInitiative} placeholder="d20" onChange={(event) => setJoinInitiative(event.target.value)} /></label>
      <button type="button" className="button button-quiet" disabled={!joinId} onClick={() => void join()}>{joinInitiative.trim() ? t.add : t.roll}</button>
    </div>}
    {isDm && <button type="button" className="button button-quiet" onClick={() => void confirm({ title: t.endConfirm, confirmLabel: t.endCombat, tone: "danger" }).then((ok) => { if (ok) void send([{ type: "combat-end" }]); })}>{t.endCombat}</button>}
  </section>;
}

/** "Movement: 15 ft of 30 ft · 15 ft left", with a bar. */
export function Movement({ entry, locale, inBar = false }: { entry: Combatant; locale: Locale; inBar?: boolean }) {
  const t = text[locale];
  const used = entry.moved ?? 0;
  const budget = movementBudget(entry);
  const distance = (squares: number) => formatDistance(squares, locale);
  if (budget === null) return <span className={styles.movement(inBar)}>{t.movement}: {t.movedOnly(distance(used))}</span>;
  const left = budget - used;
  return <span className={styles.movement(inBar)}>
    {t.movement}: {t.moved(distance(used), distance(budget))} · <b className={left < 0 ? styles.over : undefined}>{left >= 0 ? t.left(distance(left)) : t.over(distance(-left))}</b>
    <span className={styles.moveBar} aria-hidden="true"><span style={{ width: `${budget ? Math.min(100, used / budget * 100) : 100}%` }} className={styles.moveFill(left < 0)} /></span>
  </span>;
}

/** A number that is sent when it's done being typed (on blur or Enter), not on every keystroke. */
function useDraft(value: string, commit: (draft: string) => void) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  return {
    value: draft,
    onChange: (event: { target: { value: string } }) => setDraft(event.target.value),
    onBlur: () => { if (draft !== value) commit(draft); },
    onKeyDown: (event: { key: string; currentTarget: { blur(): void } }) => { if (event.key === "Enter") event.currentTarget.blur(); },
  };
}

function InitiativeInput({ value, label, onChange }: { value: number; label: string; onChange: (value: number) => void }) {
  const draft = useDraft(String(value), (typed) => {
    const number = Number(typed);
    if (typed.trim() && Number.isFinite(number)) onChange(clampInitiative(number));
  });
  return <input className={styles.initiativeInput} type="number" min={INITIATIVE_MIN} max={INITIATIVE_MAX} aria-label={label} {...draft} />;
}

function SpeedInput({ entry, locale, label, onChange }: { entry: Combatant; locale: Locale; label: string; onChange: (speed: number | null) => void }) {
  const draft = useDraft(distanceValue(entry.speed, locale), (typed) => onChange(parseDistance(typed, locale)));
  return <input className={styles.initiativeInput} type="number" min={0} step={locale === "es" ? 1.5 : 5} aria-label={label} {...draft} />;
}

type SetupRow = { include: boolean; initiative: string; speed: string; speedTouched: boolean };

/** Before the fight: who's in it, their rolls and speeds. Bonuses come from the character sheets and stat blocks. */
function CombatSetup({ state, locale, colorOf, send, infoFor, onCancel }: Props & { onCancel: () => void }) {
  const t = text[locale];
  const [info, setInfo] = useState<Record<string, CombatInfo>>({});
  const [rows, setRows] = useState<Record<string, SetupRow>>(() => Object.fromEntries(state.tokens.map((token) => [token.id, {
    include: !(token.kind === "monster" && token.defeated), initiative: "", speed: "", speedTouched: false,
  }])));
  const [group, setGroup] = useState(true);
  const tokenKey = state.tokens.map((token) => `${token.id}:${token.monsterSlug ?? ""}`).join("|");
  const tokens = useMemo(() => state.tokens, [tokenKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let live = true;
    for (const token of tokens) {
      void infoFor(token).then((found) => {
        if (!live) return;
        setInfo((current) => ({ ...current, [token.id]: found }));
        setRows((current) => {
          const row = current[token.id] ?? { include: true, initiative: "", speed: "", speedTouched: false };
          return row.speedTouched ? current : { ...current, [token.id]: { ...row, speed: distanceValue(found.speed, locale) } };
        });
      });
    }
    return () => { live = false; };
  }, [tokens, infoFor, locale]);

  const row = (id: string) => rows[id] ?? { include: true, initiative: "", speed: "", speedTouched: false };
  const change = (id: string, patch: Partial<SetupRow>) => setRows((current) => ({ ...current, [id]: { ...row(id), ...patch } }));
  /** Identical monsters share one roll when asked (the 2024 DMG's suggestion for groups). */
  const groupOf = (token: MapToken) => token.kind === "monster" && group ? `m:${token.monsterSlug ?? token.label.replace(/\s*\d+$/, "").toLocaleLowerCase()}` : `t:${token.id}`;

  function rolled(): Record<string, SetupRow> {
    const next = { ...rows };
    const groupRolls = new Map<string, number>();
    // A roll typed for one of a group goes to the rest of it.
    for (const token of state.tokens) {
      const current = row(token.id);
      const typed = Number(current.initiative);
      if (current.include && current.initiative.trim() && Number.isFinite(typed) && !groupRolls.has(groupOf(token))) groupRolls.set(groupOf(token), clampInitiative(typed));
    }
    for (const token of state.tokens) {
      const current = row(token.id);
      if (!current.include || current.initiative.trim()) continue;
      const key = groupOf(token);
      if (!groupRolls.has(key)) groupRolls.set(key, clampInitiative(d20() + (info[token.id]?.bonus ?? 0)));
      next[token.id] = { ...current, initiative: String(groupRolls.get(key)) };
    }
    return next;
  }

  function begin() {
    const filled = rolled();
    const entries: CombatEntry[] = state.tokens.flatMap((token) => {
      const current = filled[token.id];
      if (!current?.include) return [];
      const initiative = Number(current.initiative);
      const speed = parseDistance(current.speed, locale);
      return [{ tokenId: token.id, initiative: clampInitiative(Number.isFinite(initiative) ? initiative : 0), ...(speed !== null ? { speed } : {}) }];
    });
    if (entries.length) void send([{ type: "combat-start", entries }]);
  }

  const included = state.tokens.filter((token) => row(token.id).include).length;
  return <div className={styles.setup}>
    <p className={styles.empty}>{t.setupHint}</p>
    <table className={styles.setupTable}>
      <thead><tr><th scope="col"><span className="sr-only">{t.include}</span></th><th scope="col"></th><th scope="col">{t.bonus}</th><th scope="col">{t.initiative}</th><th scope="col">{t.speed} ({t.speedUnit})</th></tr></thead>
      <tbody>{state.tokens.map((token) => {
        const current = row(token.id);
        const bonus = info[token.id]?.bonus;
        return <tr key={token.id} className={current.include ? undefined : styles.setupOut}>
          <td><input type="checkbox" checked={current.include} aria-label={`${t.include}: ${token.label}`} onChange={(event) => change(token.id, { include: event.target.checked })} /></td>
          <th scope="row"><span className={styles.legendDot} style={{ background: colorOf(token) }} aria-hidden="true" /> {token.label}</th>
          <td>{bonus === undefined ? "…" : signedBonus(bonus)}</td>
          <td><input className={styles.initiativeInput} type="number" min={INITIATIVE_MIN} max={INITIATIVE_MAX} placeholder="d20" aria-label={t.initiativeOf(token.label)}
            value={current.initiative} disabled={!current.include} onChange={(event) => change(token.id, { initiative: event.target.value })} /></td>
          <td><input className={styles.initiativeInput} type="number" min={0} step={locale === "es" ? 1.5 : 5} aria-label={t.speedOf(token.label)}
            value={current.speed} disabled={!current.include} onChange={(event) => change(token.id, { speed: event.target.value, speedTouched: true })} /></td>
        </tr>;
      })}</tbody>
    </table>
    <label className={styles.check}><input type="checkbox" checked={group} onChange={(event) => setGroup(event.target.checked)} />{t.groupSame}</label>
    <div className={styles.form}>
      <button type="button" className="button button-quiet" disabled={!included} onClick={() => setRows(rolled())}>🎲 {t.rollEmpty}</button>
      <button type="button" className="button button-primary" disabled={!included} onClick={begin}>⚔ {t.begin}</button>
      <button type="button" className="button button-quiet" onClick={onCancel}>{t.cancel}</button>
    </div>
  </div>;
}
