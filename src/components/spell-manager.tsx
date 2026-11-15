"use client";

import { useEffect, useMemo, useState } from "react";
import type { CharacterBuild } from "@/lib/character-sheet";
import { say } from "@/lib/dnd2024";
import { translate, type Locale } from "@/lib/i18n";
import {
  castingFor, castingTimeName, classSpells, emptySpells, findSpell, MAX_CUSTOM_SPELLS, MAX_SPELL_LEVEL, MAX_SPELL_NAME, spellCounts, spellFacts,
  spellLevelName, spellMeasure, spells as catalogue, type Spell, type SpellChoices,
} from "@/lib/spells";
import styles from "./spell-manager.module.css";

const copy = {
  en: {
    ability: "Spellcasting ability", cantrips: "Cantrips", prepared: "Prepared spells", of: "of", tabs: { class: "From your class", book: "Spellbook", extra: "Other spells" },
    classHelp: "Pick the cantrips you know and the spells you have prepared. You can change them later from the sheet.",
    bookHelp: (count: number) => `Spells written in your spellbook that you haven't prepared today. A wizard's book holds ${count} spells at this level (prepared ones included), plus any you copy during your adventures.`,
    extraHelp: "Spells that don't come from your class list: feats such as Magic Initiate, your species or lineage, your subclass's always-prepared spells or magic items. They don't count against your class limits.",
    noCasting: "Your class doesn't cast spells. If a feat, your species or a magic item gives you one, add it here.",
    search: "Search spells", level: "Spell level", all: "All levels", empty: "No spells match.", full: "You've already chosen them all: untick one to swap it.",
    over: "You have more than your class allows: untick some.", details: (name: string) => `Details of ${name}`, loading: "Loading description…",
    failed: "The description couldn't be loaded. It's in your rulebook under the English name.", higher: "At higher levels", material: "Material", trigger: "Trigger",
    concentration: "Concentration", ritual: "Ritual", english: "Description in English, from the SRD 5.2.",
    customTitle: "A spell that isn't in the list?", customHelp: "The list holds the spells of the free rules (SRD 5.2). Write the name of any other one; it counts as a class spell.",
    customHelpOther: "The list holds the spells of the free rules (SRD 5.2). Write the name of any other one.",
    customName: "Spell name", add: "Add", remove: (name: string) => `Remove ${name}`, chosen: "Chosen",
  },
  es: {
    ability: "Característica para lanzar conjuros", cantrips: "Trucos", prepared: "Conjuros preparados", of: "de", tabs: { class: "De tu clase", book: "Libro de conjuros", extra: "Otros conjuros" },
    classHelp: "Elige los trucos que conoces y los conjuros que tienes preparados. Podrás cambiarlos después desde la hoja.",
    bookHelp: (count: number) => `Conjuros apuntados en tu libro que hoy no tienes preparados. A este nivel el libro de un mago tiene ${count} conjuros (contando los preparados), más los que copies en tus aventuras.`,
    extraHelp: "Conjuros que no salen de la lista de tu clase: dotes como Iniciado en la magia, tu especie o linaje, los conjuros siempre preparados de tu subclase u objetos mágicos. No cuentan para los límites de tu clase.",
    noCasting: "Tu clase no lanza conjuros. Si una dote, tu especie o un objeto mágico te da alguno, añádelo aquí.",
    search: "Buscar conjuros", level: "Nivel de conjuro", all: "Todos los niveles", empty: "Ningún conjuro coincide.", full: "Ya los has elegido todos: desmarca uno para cambiarlo.",
    over: "Tienes más de los que permite tu clase: desmarca alguno.", details: (name: string) => `Detalles de ${name}`, loading: "Cargando la descripción…",
    failed: "No se ha podido cargar la descripción. La tienes en tu manual.", higher: "A niveles superiores", material: "Material", trigger: "Desencadenante",
    concentration: "Concentración", ritual: "Ritual", english: "Descripción en inglés, del SRD 5.2.",
    customTitle: "¿Un conjuro que no está en la lista?", customHelp: "La lista trae los conjuros de las reglas gratuitas (SRD 5.2). Escribe el nombre de cualquier otro; cuenta como conjuro de tu clase.",
    customHelpOther: "La lista trae los conjuros de las reglas gratuitas (SRD 5.2). Escribe el nombre de cualquier otro.",
    customName: "Nombre del conjuro", add: "Añadir", remove: (name: string) => `Quitar ${name}`, chosen: "Elegidos",
  },
};

type Detail = { description: string; higherLevel: string; material: string; reaction: string };
const details = new Map<string, Promise<Detail>>();
function loadDetail(id: string): Promise<Detail> {
  let pending = details.get(id);
  if (!pending) {
    pending = fetch(`/api/spells/${id}`).then((response) => {
      if (!response.ok) throw new Error(String(response.status));
      return response.json() as Promise<Detail>;
    });
    pending.catch(() => details.delete(id));
    details.set(id, pending);
  }
  return pending;
}

/** The numbers and the rules text of one spell; the text is fetched the first time it is shown. */
export function SpellDetails({ spell, locale }: { spell: Spell; locale: Locale }) {
  const c = copy[locale];
  const [state, setState] = useState<{ id: string; detail?: Detail; failed?: boolean }>({ id: spell.id });
  useEffect(() => {
    let live = true;
    loadDetail(spell.id).then((detail) => { if (live) setState({ id: spell.id, detail }); }, () => { if (live) setState({ id: spell.id, failed: true }); });
    return () => { live = false; };
  }, [spell.id]);
  const current = state.id === spell.id ? state : { id: spell.id };
  return <div className={styles.details}>
    <p className={styles.facts}>{spellFacts(spell, locale)}</p>
    {!current.detail && !current.failed && <p className={styles.muted} role="status">{c.loading}</p>}
    {current.failed && <p className={styles.muted} role="status">{c.failed}</p>}
    {current.detail && <>
      {current.detail.reaction && <p><b>{c.trigger}:</b> {current.detail.reaction}</p>}
      {current.detail.material && <p><b>{c.material}:</b> {current.detail.material}</p>}
      {current.detail.description.split(/\n+/).filter(Boolean).map((paragraph, index) => <p key={index} lang="en">{paragraph}</p>)}
      {current.detail.higherLevel && <p lang="en"><b lang={locale}>{c.higher}:</b> {current.detail.higherLevel}</p>}
      {locale === "es" && <p className={styles.muted}>{c.english}</p>}
    </>}
  </div>;
}

type Bucket = "class" | "book" | "extra";

/**
 * Picks the character's spells: class cantrips and prepared spells (with the class limits), the rest of a wizard's spellbook,
 * and spells from anywhere else. Used by the creator, the level-up guide and the sheet.
 */
export default function SpellManager({ locale, build, level, value, onChange }: {
  locale: Locale; build: Pick<CharacterBuild, "classId" | "useSubclass" | "subclassId">; level: number; value: SpellChoices | undefined; onChange: (next: SpellChoices) => void;
}) {
  const c = copy[locale];
  const casting = useMemo(() => castingFor(build, level), [build, level]);
  const choices = value ?? emptySpells;
  const [bucket, setBucket] = useState<Bucket>("class");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [open, setOpen] = useState<string | null>(null);
  const [customName, setCustomName] = useState("");
  const [customLevel, setCustomLevel] = useState(1);
  const active: Bucket = casting ? (bucket === "book" && !casting.spellbook ? "class" : bucket) : "extra";

  const counts = spellCounts(choices);
  const known = choices.known;
  const book = choices.book ?? [];
  const extra = choices.extra ?? [];
  const custom = choices.custom ?? [];
  /** Typed-in spells belong to the tab they were added in: class ones count against the limits, the others don't. */
  const customHere = custom.map((entry, index) => ({ entry, index })).filter(({ entry }) => !!entry.other === (active === "extra"));
  const selected = active === "class" ? known : active === "book" ? book : extra;

  const pool = useMemo(() => {
    const available = casting ? classSpells(casting) : [];
    if (active === "class") return available;
    if (active === "book") return available.filter((spell) => spell.level > 0);
    return catalogue;
  }, [casting, active]);
  const needle = query.trim().toLocaleLowerCase(locale);
  const visible = pool.filter((spell) => {
    // A spell lives in one place only: prepared ones leave the book and the "other" list.
    if (active === "book" && known.includes(spell.id)) return false;
    if (active === "extra" && (known.includes(spell.id) || book.includes(spell.id))) return false;
    if (filter !== "all" && spell.level !== Number(filter)) return false;
    return !needle || spell.name.en.toLocaleLowerCase(locale).includes(needle) || spell.name.es.toLocaleLowerCase(locale).includes(needle);
  }).sort((a, b) => a.level - b.level || say(a.name, locale).localeCompare(say(b.name, locale), locale));
  const levels = [...new Set(pool.map((spell) => spell.level))].sort((a, b) => a - b);

  function toggle(spell: Spell, on: boolean) {
    const without = (ids: string[]) => ids.filter((id) => id !== spell.id);
    if (active === "class") onChange({ ...choices, known: on ? [...known, spell.id] : without(known), book: without(book), extra: without(extra) });
    else if (active === "book") onChange({ ...choices, book: on ? [...book, spell.id] : without(book), extra: without(extra) });
    else onChange({ ...choices, extra: on ? [...extra, spell.id] : without(extra) });
  }
  /** Class picks stop at the class limits; the other two lists are free. */
  const blocked = (spell: Spell) => active === "class" && !!casting && (spell.level === 0 ? counts.cantrips >= casting.cantrips : counts.prepared >= casting.prepared);
  const customFull = active === "class" && !!casting && (customLevel === 0 ? counts.cantrips >= casting.cantrips : counts.prepared >= casting.prepared);
  function addCustom() {
    const name = customName.trim().slice(0, MAX_SPELL_NAME);
    if (!name || custom.length >= MAX_CUSTOM_SPELLS || customFull) return;
    onChange({ ...choices, custom: [...custom, { name, level: customLevel, ...(active === "extra" ? { other: true } : {}) }] });
    setCustomName("");
  }

  const counter = (label: string, have: number, limit: number) => limit > 0 || have > 0
    ? <span className={`${styles.counter} ${have > limit ? styles.bad : have === limit ? styles.complete : ""}`}>{label} <b>{have}</b> {c.of} {limit}</span> : null;
  const tabs: Bucket[] = casting ? ["class", ...(casting.spellbook ? ["book" as const] : []), "extra"] : ["extra"];
  const chosenNames = selected.map((id) => findSpell(id)).filter((spell): spell is Spell => !!spell);

  return <div className={styles.manager}>
    {casting ? <div className={styles.summary}>
      <span className={styles.counter}>{c.ability}: <b>{translate(locale, `ability.${casting.ability}`)}</b></span>
      {counter(c.cantrips, counts.cantrips, casting.cantrips)}
      {counter(c.prepared, counts.prepared, casting.prepared)}
    </div> : <p className={styles.help}>{c.noCasting}</p>}
    {casting && (counts.cantrips > casting.cantrips || counts.prepared > casting.prepared) && <p className={styles.warning} role="alert">{c.over}</p>}

    {tabs.length > 1 && <div className={styles.tabs} role="group">
      {tabs.map((tab) => <button type="button" key={tab} className={`${styles.tab} ${active === tab ? styles.tabOn : ""}`} aria-pressed={active === tab}
        onClick={() => { setBucket(tab); setFilter("all"); setOpen(null); }}>{c.tabs[tab]}{tab !== "class" && (tab === "book" ? book : extra).length > 0 ? ` (${(tab === "book" ? book : extra).length})` : ""}</button>)}
    </div>}
    <p className={styles.help}>{active === "class" ? c.classHelp : active === "book" ? c.bookHelp(6 + (level - 1) * 2) : casting ? c.extraHelp : ""}</p>

    {chosenNames.length > 0 && <p className={styles.chosen}><b>{c.chosen}:</b> {chosenNames.sort((a, b) => a.level - b.level).map((spell) => say(spell.name, locale)).join(" · ")}</p>}

    <div className={styles.filters}>
      <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={c.search} aria-label={c.search} />
      <select value={filter} onChange={(event) => setFilter(event.target.value)} aria-label={c.level}>
        <option value="all">{c.all}</option>
        {levels.map((spellLevel) => <option key={spellLevel} value={spellLevel}>{spellLevelName(spellLevel, locale)}</option>)}
      </select>
    </div>

    <div className={styles.list}>
      {visible.length === 0 && <p className={styles.muted}>{c.empty}</p>}
      {[...new Set(visible.map((spell) => spell.level))].map((spellLevel) => <section key={spellLevel} aria-label={spellLevelName(spellLevel, locale)}>
        <h4>{spellLevelName(spellLevel, locale)}</h4>
        <ul>{visible.filter((spell) => spell.level === spellLevel).map((spell) => {
          const isOn = selected.includes(spell.id);
          const name = say(spell.name, locale);
          return <li key={spell.id} className={isOn ? styles.on : ""}>
            <div className={styles.row}>
              <label title={!isOn && blocked(spell) ? c.full : undefined}>
                <input type="checkbox" checked={isOn} disabled={!isOn && blocked(spell)} onChange={(event) => toggle(spell, event.target.checked)} />
                <span><b>{name}</b><small>{castingTimeName(spell, locale)} · {spellMeasure(spell.range, locale)}{spell.concentration ? ` · ${c.concentration}` : ""}{spell.ritual ? ` · ${c.ritual}` : ""}</small></span>
              </label>
              <button type="button" className={styles.info} aria-expanded={open === spell.id} aria-label={c.details(name)} onClick={() => setOpen(open === spell.id ? null : spell.id)}>{open === spell.id ? "−" : "i"}</button>
            </div>
            {open === spell.id && <SpellDetails spell={spell} locale={locale} />}
          </li>;
        })}</ul>
      </section>)}
    </div>

    {active !== "book" && <fieldset className={styles.custom}>
      <legend>{c.customTitle}</legend>
      <p className={styles.help}>{active === "class" ? c.customHelp : c.customHelpOther}</p>
      <div className={styles.filters}>
        <input value={customName} maxLength={MAX_SPELL_NAME} onChange={(event) => setCustomName(event.target.value)} placeholder={c.customName} aria-label={c.customName}
          onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addCustom(); } }} />
        <select value={customLevel} onChange={(event) => setCustomLevel(Number(event.target.value))} aria-label={c.level}>
          {Array.from({ length: MAX_SPELL_LEVEL + 1 }, (_, spellLevel) => <option key={spellLevel} value={spellLevel}>{spellLevelName(spellLevel, locale)}</option>)}
        </select>
        <button type="button" className="button button-quiet" onClick={addCustom} disabled={!customName.trim() || custom.length >= MAX_CUSTOM_SPELLS || customFull} title={customFull ? c.full : undefined}>{c.add}</button>
      </div>
      {customHere.length > 0 && <ul className={styles.customList}>{customHere.map(({ entry, index }) => <li key={`${entry.name}-${index}`}>
        <span>{entry.name} <small>{spellLevelName(entry.level, locale)}</small></span>
        <button type="button" className={styles.info} aria-label={c.remove(entry.name)} onClick={() => onChange({ ...choices, custom: custom.filter((_, position) => position !== index) })}>×</button>
      </li>)}</ul>}
    </fieldset>}
  </div>;
}
