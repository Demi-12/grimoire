"use client";

import { useEffect, useRef, useState } from "react";
import type { Character } from "@/lib/api-client";
import { signed } from "@/lib/character-view";
import { say } from "@/lib/dnd2024";
import { translate, type Locale } from "@/lib/i18n";
import { abilityModifier, proficiencyBonus } from "@/lib/rules";
import {
  castingFor, cleanSpells, sheetSpells, slotRows, spellLevelName, spellsLeft, withSlotUsed, type Casting, type SheetSpell, type SpellChoices,
} from "@/lib/spells";
import { useToast } from "./feedback";
import SpellManager, { SpellDetails } from "./spell-manager";
import sheetStyles from "./character-sheet-view.module.css";
import styles from "./character-spells.module.css";

const copy = {
  en: {
    title: "Spells", ability: "Ability", dc: "Spell save DC", attack: "Spell attack", slots: "Spell slots", pact: "Pact Magic slots", pactHelp: "They come back on a Short Rest.",
    slotsHelp: "Tap a slot when you spend it.", readOnlySlot: (level: number, left: number, total: number) => `Level ${level}: ${left} of ${total} left`,
    slot: (level: number, index: number, spent: boolean) => `Level ${level} slot ${index}: ${spent ? "spent, tap to recover" : "available, tap to spend"}`,
    rest: "Long Rest: recover all", manage: "Manage spells", add: "Choose spells", none: "No spells chosen yet.", close: "Close", save: "Save spells", cancel: "Cancel",
    saved: "Spells saved.", failed: "The spells couldn't be saved.", concentration: "Concentration", ritual: "Ritual", custom: "Not in the free rules: look it up in your book.",
    sources: { class: "", book: "Spellbook", extra: "Other source", custom: "" } as Record<string, string>,
    missing: (cantrips: number, prepared: number) => `You can still choose ${[cantrips ? `${cantrips} ${cantrips === 1 ? "cantrip" : "cantrips"}` : "", prepared ? `${prepared} ${prepared === 1 ? "spell" : "spells"}` : ""].filter(Boolean).join(" and ")}.`,
    left: "left",
  },
  es: {
    title: "Conjuros", ability: "Característica", dc: "CD de conjuros", attack: "Ataque de conjuro", slots: "Espacios de conjuro", pact: "Espacios de Magia del pacto", pactHelp: "Se recuperan con un descanso corto.",
    slotsHelp: "Toca un espacio cuando lo gastes.", readOnlySlot: (level: number, left: number, total: number) => `Nivel ${level}: quedan ${left} de ${total}`,
    slot: (level: number, index: number, spent: boolean) => `Espacio ${index} de nivel ${level}: ${spent ? "gastado, toca para recuperarlo" : "disponible, toca para gastarlo"}`,
    rest: "Descanso largo: recuperar todos", manage: "Gestionar conjuros", add: "Elegir conjuros", none: "Aún no has elegido conjuros.", close: "Cerrar", save: "Guardar conjuros", cancel: "Cancelar",
    saved: "Conjuros guardados.", failed: "No se han podido guardar los conjuros.", concentration: "Concentración", ritual: "Ritual", custom: "No está en las reglas gratuitas: consúltalo en tu manual.",
    sources: { class: "", book: "Libro", extra: "Otra fuente", custom: "" } as Record<string, string>,
    missing: (cantrips: number, prepared: number) => `Aún puedes elegir ${[cantrips ? `${cantrips} ${cantrips === 1 ? "truco" : "trucos"}` : "", prepared ? `${prepared} ${prepared === 1 ? "conjuro" : "conjuros"}` : ""].filter(Boolean).join(" y ")}.`,
    left: "quedan",
  },
};

/** Spell save DC and attack bonus for the ability the character casts with. */
export function castingNumbers(casting: Casting, score: number, level: number): { dc: number; attack: number } {
  const bonus = proficiencyBonus(level) + abilityModifier(score);
  return { dc: 8 + bonus, attack: bonus };
}

function SpellRow({ entry, locale }: { entry: SheetSpell; locale: Locale }) {
  const c = copy[locale];
  const [open, setOpen] = useState(false);
  const tags = [c.sources[entry.source], entry.spell?.concentration ? c.concentration : "", entry.spell?.ritual ? c.ritual : ""].filter(Boolean);
  return <li>
    <button type="button" className={styles.spell} aria-expanded={open} onClick={() => setOpen(!open)}>
      <span>{say(entry.name, locale)}</span>{tags.length > 0 && <small>{tags.join(" · ")}</small>}<i aria-hidden="true">{open ? "−" : "+"}</i>
    </button>
    {open && (entry.spell ? <SpellDetails spell={entry.spell} locale={locale} /> : <p className={styles.help}>{c.custom}</p>)}
  </li>;
}

/** The Spells panel of the on-screen sheet: casting numbers, slots to tick off, and the spells with their rules text. */
export default function CharacterSpells({ character, locale, scores, onSave }: {
  character: Character; locale: Locale; scores: Character["scores"];
  /** Only passed when the viewer may change the character. */
  onSave?: (spells: SpellChoices | undefined) => Promise<void>;
}) {
  const c = copy[locale];
  const toast = useToast();
  const build = character.build;
  /** Shown while a change is on its way to the server, so slots react at once. */
  const [pending, setPending] = useState<{ spells: SpellChoices | undefined } | null>(null);
  const [draft, setDraft] = useState<{ spells: SpellChoices | undefined } | null>(null);
  const [saving, setSaving] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (draft && dialog && !dialog.open) dialog.showModal();
  }, [draft]);
  if (!build) return null;

  const casting = castingFor(build, character.level);
  const choices = pending ? pending.spells : build.spells;
  const groups = sheetSpells(choices, locale);
  if (!casting && groups.length === 0) return null;
  const numbers = casting ? castingNumbers(casting, scores[casting.ability], character.level) : null;
  const slots = casting ? slotRows(casting, choices) : [];
  const missing = spellsLeft({ ...build, spells: choices }, character.level);

  async function store(next: SpellChoices | undefined, announce = false) {
    if (!onSave) return;
    setPending({ spells: next });
    try {
      await onSave(next);
      if (announce) toast.success(c.saved);
    } catch {
      toast.error(c.failed);
    } finally {
      setPending(null);
    }
  }
  function spend(level: number, index: number, used: number) {
    if (!casting) return;
    // Tapping an available slot spends up to it; tapping a spent one recovers from it on.
    void store(withSlotUsed(choices, casting, level, index < used ? index : index + 1));
  }
  async function saveDraft() {
    if (!draft || !build) return;
    setSaving(true);
    await store(cleanSpells({ ...build, spells: draft.spells ? { ...draft.spells, used: choices?.used } : undefined }, character.level), true);
    setSaving(false);
    setDraft(null);
  }

  return <section className={sheetStyles.panel} aria-labelledby="sheet-spells">
    <div className={styles.head}>
      <h3 id="sheet-spells">{c.title}</h3>
      {onSave && <button type="button" className="button button-quiet" onClick={() => setDraft({ spells: choices })}>{groups.length ? c.manage : c.add}</button>}
    </div>

    {casting && numbers && <div className={sheetStyles.vitals}>
      <div className={sheetStyles.vital}><span>{c.ability}</span><b className={styles.word}>{translate(locale, `ability.${casting.ability}`)}</b></div>
      <div className={sheetStyles.vital}><span>{c.dc}</span><b>{numbers.dc}</b></div>
      <div className={sheetStyles.vital}><span>{c.attack}</span><b>{signed(numbers.attack)}</b></div>
    </div>}

    {slots.length > 0 && <div className={styles.slots}>
      <div className={styles.slotsHead}><h4>{casting?.pact ? c.pact : c.slots}</h4>
        {onSave && slots.some((row) => row.used > 0) && <button type="button" className={styles.link} onClick={() => void store(choices ? { ...choices, used: undefined } : undefined)}>{c.rest}</button>}</div>
      <ul>{slots.map((row) => <li key={row.level}>
        <span>{spellLevelName(row.level, locale)}</span>
        <span className={styles.pips}>{Array.from({ length: row.total }, (_, index) => onSave
          ? <button type="button" key={index} className={`${styles.pip} ${index < row.used ? styles.spent : ""}`} aria-pressed={index < row.used}
              aria-label={c.slot(row.level, index + 1, index < row.used)} onClick={() => spend(row.level, index, row.used)} />
          : <i key={index} className={`${styles.pip} ${index < row.used ? styles.spent : ""}`} aria-hidden="true" />)}
          {!onSave && <span className="sr-only">{c.readOnlySlot(row.level, row.total - row.used, row.total)}</span>}</span>
        <small>{c.left} {row.total - row.used}/{row.total}</small>
      </li>)}</ul>
      <p className={styles.help}>{[onSave ? c.slotsHelp : "", casting?.pact ? c.pactHelp : ""].filter(Boolean).join(" ")}</p>
    </div>}

    {groups.length === 0 && <p className={styles.help}>{c.none}</p>}
    {groups.map((group) => <div className={styles.group} key={group.level}>
      <h4>{spellLevelName(group.level, locale)}</h4>
      <ul>{group.spells.map((entry) => <SpellRow key={entry.key} entry={entry} locale={locale} />)}</ul>
    </div>)}
    {onSave && casting && (missing.cantrips > 0 || missing.prepared > 0) && <p className={styles.help} role="note">{c.missing(missing.cantrips, missing.prepared)}</p>}

    {draft && <dialog ref={dialogRef} className={styles.dialog} aria-labelledby="spell-dialog-title" onClose={() => setDraft(null)}>
      <div className={styles.dialogBox}>
        <header><h3 id="spell-dialog-title">{c.manage} · {character.name}</h3>
          <button type="button" className={styles.close} aria-label={c.close} onClick={() => dialogRef.current?.close()}>×</button></header>
        <div className={styles.dialogBody}><SpellManager locale={locale} build={build} level={character.level} value={draft.spells} onChange={(spells) => setDraft({ spells })} /></div>
        <footer>
          <button type="button" className="button button-quiet" onClick={() => dialogRef.current?.close()}>{c.cancel}</button>
          <button type="button" className="button button-primary" disabled={saving} onClick={() => void saveDraft()}>{c.save}</button>
        </footer>
      </div>
    </dialog>}
  </section>;
}
