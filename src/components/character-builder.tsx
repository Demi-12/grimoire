"use client";

import { useEffect, useState, type FormEvent } from "react";
import { abilities, abilityModifier, type AbilityKey, type AbilityScores, proficiencyBonus } from "@/lib/rules";
import { translate, type Locale } from "@/lib/i18n";

/** Character shape shared with the encounter builder through local storage. */
export interface CharacterRecord {
  id: string;
  name: string;
  className: string;
  species: string;
  background: string;
  level: number;
  scores: AbilityScores;
  notes: string;
}

const STORAGE_KEY = "characters";
const blankScores: AbilityScores = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };
const standardArray: AbilityScores = { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 };

function makeId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function loadCharacters(): CharacterRecord[] {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is CharacterRecord =>
      item !== null && typeof item === "object" && typeof item.id === "string" &&
      typeof item.name === "string" && Number.isInteger(item.level) && item.level >= 1 && item.level <= 20 &&
      item.scores !== null && typeof item.scores === "object" && abilities.every(({ key }) =>
        Number.isInteger(item.scores[key]) && item.scores[key] >= 1 && item.scores[key] <= 30),
    );
  } catch {
    return [];
  }
}

function ScoreFields({ scores, onChange, locale }: { scores: AbilityScores; onChange: (key: AbilityKey, value: number) => void; locale: Locale }) {
  return <div className="ability-grid">{abilities.map(({ key }) => {
    const score = scores[key];
    const modifier = abilityModifier(score);
    const ability = translate(locale, `ability.${key}`);
    return <label className="ability-input" key={key}>
      <span>{ability}</span>
      <input aria-label={translate(locale, "character.scoreAria", { ability })} type="number" min={1} max={30} required value={score}
        onChange={(event) => onChange(key, Number(event.target.value))} />
      <small aria-label={translate(locale, "character.modifierAria", { sign: translate(locale, modifier >= 0 ? "character.positive" : "character.negative"), value: Math.abs(modifier) })}>
        {modifier >= 0 ? "+" : "−"}{Math.abs(modifier)}
      </small>
    </label>;
  })}</div>;
}

function CharacterEditor({ character, onSave, onCancel, locale }: {
  character?: CharacterRecord;
  onSave: (record: CharacterRecord) => void;
  onCancel: () => void;
  locale: Locale;
}) {
  const [name, setName] = useState(character?.name ?? "");
  const [className, setClassName] = useState(character?.className ?? "");
  const [species, setSpecies] = useState(character?.species ?? "");
  const [background, setBackground] = useState(character?.background ?? "");
  const [level, setLevel] = useState(String(character?.level ?? 1));
  const [scores, setScores] = useState(character?.scores ?? blankScores);
  const [notes, setNotes] = useState(character?.notes ?? "");
  const numericLevel = Number(level);
  const validLevel = Number.isInteger(numericLevel) && numericLevel >= 1 && numericLevel <= 20;
  const validScores = abilities.every(({ key }) => Number.isInteger(scores[key]) && scores[key] >= 1 && scores[key] <= 30);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim() || !validLevel || !validScores) return;
    onSave({ id: character?.id ?? makeId(), name: name.trim(), className: className.trim(), species: species.trim(), background: background.trim(), level: numericLevel, scores, notes: notes.trim() });
  }

  return <form className="editor-panel" onSubmit={handleSubmit}>
    <div className="panel-heading"><div><p className="eyebrow">{translate(locale, "character.sheetKicker")}</p><h2>{translate(locale, character ? "character.editTitle" : "character.createTitle")}</h2></div>
      <button className="icon-button" type="button" onClick={onCancel} aria-label={translate(locale, "character.closeEditor")}>×</button></div>
    <div className="form-grid three-columns">
      <label>{translate(locale, "character.name")}<input autoFocus required maxLength={50} value={name} onChange={(event) => setName(event.target.value)} placeholder={translate(locale, "character.namePlaceholder")} /></label>
      <label>{translate(locale, "character.class")}<input maxLength={40} value={className} onChange={(event) => setClassName(event.target.value)} placeholder={translate(locale, "character.classPlaceholder")} /></label>
      <label>{translate(locale, "character.level")}<input type="number" min={1} max={20} step={1} required value={level} aria-invalid={level !== "" && !validLevel}
        onChange={(event) => setLevel(event.target.value)} />{!validLevel && <small role="alert">{translate(locale, "character.levelValidation")}</small>}</label>
      <label>{translate(locale, "character.species")}<input maxLength={40} value={species} onChange={(event) => setSpecies(event.target.value)} placeholder={translate(locale, "character.speciesPlaceholder")} /></label>
      <label>{translate(locale, "character.background")}<input maxLength={50} value={background} onChange={(event) => setBackground(event.target.value)} placeholder={translate(locale, "character.backgroundPlaceholder")} /></label>
      <div className="form-aside"><span>{translate(locale, "character.proficiencyBonus")}</span><strong>+{validLevel ? proficiencyBonus(numericLevel) : "—"}</strong><small>{translate(locale, "character.totalLevelHint")}</small></div>
    </div>
    <div className="score-heading"><div><p className="eyebrow">{translate(locale, "character.abilitiesKicker")}</p><h3>{translate(locale, "character.scoresTitle")}</h3></div>
      <button className="text-button" type="button" onClick={() => setScores(standardArray)}>{translate(locale, "character.standardArray")}</button></div>
    <p className="field-help mt-2 text-xs leading-relaxed text-muted">{translate(locale, "character.scoresHint")}</p>
    <ScoreFields scores={scores} locale={locale} onChange={(key, value) => setScores((current) => ({ ...current, [key]: value }))} />
    {!validScores && <p className="validation-message mt-2 text-sm font-medium text-red-700" role="alert">{translate(locale, "character.scoresValidation")}</p>}
    <label className="full-label">{translate(locale, "character.notes")}<textarea rows={3} maxLength={500} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder={translate(locale, "character.notesPlaceholder")} /></label>
    <div className="form-actions"><button className="button button-quiet" type="button" onClick={onCancel}>{translate(locale, "character.cancel")}</button>
      <button className="button button-primary" type="submit" disabled={!name.trim() || !validLevel || !validScores}>{translate(locale, "character.save")}</button></div>
  </form>;
}

/** CRUD for character records; stores compatible records for party/encounter selection. */
export default function CharacterBuilder({ locale }: { locale: Locale }) {
  const [characters, setCharacters] = useState<CharacterRecord[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [editing, setEditing] = useState<CharacterRecord | undefined>();
  const [showEditor, setShowEditor] = useState(false);
  const [printingId, setPrintingId] = useState<string | null>(null);

  useEffect(() => { setCharacters(loadCharacters()); setLoaded(true); }, []);
  useEffect(() => {
    const resetPrintState = () => {
      delete document.body.dataset.printingSheet;
      setPrintingId(null);
    };
    window.addEventListener("afterprint", resetPrintState);
    return () => window.removeEventListener("afterprint", resetPrintState);
  }, []);
  useEffect(() => {
    if (loaded) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(characters));
  }, [characters, loaded]);

  function save(record: CharacterRecord) {
    setCharacters((current) => current.some(({ id }) => id === record.id)
      ? current.map((item) => item.id === record.id ? record : item)
      : [record, ...current]);
    setShowEditor(false);
    setEditing(undefined);
  }

  function remove(record: CharacterRecord) {
    if (window.confirm(translate(locale, "character.deleteConfirm", { name: record.name }))) setCharacters((current) => current.filter(({ id }) => id !== record.id));
  }

  function exportSheet(record: CharacterRecord) {
    document.body.dataset.printingSheet = "true";
    setPrintingId(record.id);
    window.setTimeout(() => window.print(), 50);
  }

  return <section aria-labelledby="characters-title">
    <div className="section-heading"><div><p className="eyebrow">{translate(locale, "character.groupKicker")}</p><h2 id="characters-title">{translate(locale, "character.title")}</h2>
      <p>{translate(locale, "character.description")}</p></div>
      {!showEditor && <button className="button button-primary" onClick={() => { setEditing(undefined); setShowEditor(true); }}>{translate(locale, "character.newButton")}</button>}
    </div>
    {showEditor && <CharacterEditor character={editing} locale={locale} onSave={save} onCancel={() => { setShowEditor(false); setEditing(undefined); }} />}
    {characters.length === 0 && !showEditor ? <div className="empty-state"><span aria-hidden="true">✦</span><h3>{translate(locale, "character.emptyTitle")}</h3><p>{translate(locale, "character.emptyDescription")}</p>
      <button className="button button-primary" onClick={() => setShowEditor(true)}>{translate(locale, "character.createFirst")}</button></div> :
      <div className="character-grid">{characters.map((character) => <article className="character-card" key={character.id} data-print-target={printingId === character.id ? "true" : undefined}>
        <div className="character-card-top"><span className="avatar-mark">{character.name.slice(0, 1).toLocaleUpperCase(locale === "es" ? "es-ES" : "en-US")}</span><span className="level-pill">{translate(locale, "character.levelPill", { level: character.level })}</span></div>
        <h3>{character.name}</h3><p className="character-subtitle">{[character.species, character.className, character.background].filter(Boolean).join(" · ") || translate(locale, "character.adventurer")}</p>
        <div className="export-only export-sheet-content">
          <section className="sheet-page sheet-page-main">
            <header className="sheet-banner"><span aria-hidden="true">✧</span><p>{translate(locale, "character.sheetEdition")}</p><h2>{character.name}</h2><small>{[character.className, character.species].filter(Boolean).join(" · ") || translate(locale, "character.adventurer")}</small></header>
            <div className="export-details">
              <div><small>{translate(locale, "character.speciesLabel")}</small><b>{character.species || "—"}</b></div>
              <div><small>{translate(locale, "character.classLabel")}</small><b>{character.className || "—"} · {character.level}</b></div>
              <div><small>{translate(locale, "character.backgroundLabel")}</small><b>{character.background || "—"}</b></div>
              <div><small>{translate(locale, "character.proficiencyLabel")}</small><b>+{proficiencyBonus(character.level)}</b></div>
            </div>
            <section className="sheet-section"><h4>{translate(locale, "character.scoresTitle")}</h4><p className="export-legend">{translate(locale, "character.abilityScoreLabel")} · {translate(locale, "character.abilityModifierLabel")}</p>
              <div className="export-abilities">{abilities.map(({ key }) => { const score = character.scores[key]; const modifier = abilityModifier(score); return <div key={key}><span>{translate(locale, `ability.${key}`)}</span><b>{score}</b><small>{modifier >= 0 ? "+" : "−"}{Math.abs(modifier)}</small></div>; })}</div>
            </section>
            <section className="sheet-section"><h4>{translate(locale, "character.sheetCombat")}</h4>
              <div className="export-combat">{["character.armorClass", "character.initiative", "character.speed", "character.hitPoints", "character.hitDice"].map((key) => <div key={key}>{translate(locale, key)}<b /></div>)}</div>
            </section>
            <div className="sheet-columns">
              <section className="sheet-section"><h4>{translate(locale, "character.sheetSavingThrows")}</h4><div className="sheet-line-list">{abilities.map(({ key }) => <div key={key}><span>{translate(locale, `ability.${key}`)}</span><i /> <b /></div>)}</div></section>
              <section className="sheet-section"><h4>{translate(locale, "character.sheetSkills")}</h4><div className="sheet-line-list sheet-skill-list">{["acrobatics", "animalHandling", "arcana", "athletics", "deception", "history", "insight", "intimidation", "investigation", "medicine", "nature", "perception", "performance", "persuasion", "religion", "sleightOfHand", "stealth", "survival"].map((skill) => <div key={skill}><span>{translate(locale, `skill.${skill}`)}</span><i /><b /></div>)}</div></section>
            </div>
            <section className="sheet-section"><h4>{translate(locale, "character.notes")}</h4><div className="sheet-note-area">{character.notes}</div></section>
            <footer className="sheet-footer"><span>✧ GRIMOIRE ✧</span><span>{translate(locale, "character.sheetEdition")}</span></footer>
          </section>
          <section className="sheet-page sheet-page-extra">
            <header className="sheet-banner"><span aria-hidden="true">✧</span><p>{translate(locale, "character.sheetEdition")}</p><h2>{translate(locale, "character.sheetAdventurerRecord")}</h2><small>{character.name}</small></header>
            <section className="sheet-section"><h4>{translate(locale, "character.sheetFeatures")}</h4><div className="sheet-writing-area tall" /></section>
            <div className="sheet-columns">
              <section className="sheet-section"><h4>{translate(locale, "character.sheetSpeciesTraits")}</h4><div className="sheet-writing-area medium" /></section>
              <section className="sheet-section"><h4>{translate(locale, "character.sheetProficiencies")}</h4><div className="sheet-writing-area medium" /></section>
            </div>
            <section className="sheet-section"><h4>{translate(locale, "character.sheetEquipment")}</h4><div className="sheet-equipment-table"><div><b>{translate(locale, "character.sheetItem")}</b><b>{translate(locale, "character.sheetQuantity")}</b><b>{translate(locale, "character.sheetWeight")}</b><b>{translate(locale, "character.sheetNotes")}</b></div>{Array.from({ length: 7 }, (_, index) => <div key={index}><span /><span /><span /><span /></div>)}</div></section>
            <div className="sheet-columns">
              <section className="sheet-section"><h4>{translate(locale, "character.sheetStory")}</h4><div className="sheet-writing-area short" /></section>
              <section className="sheet-section"><h4>{translate(locale, "character.sheetTreasure")}</h4><div className="sheet-writing-area short" /></section>
            </div>
            <section className="sheet-section"><h4>{translate(locale, "character.sheetSpells")}</h4><div className="sheet-spell-lines">{Array.from({ length: 4 }, (_, index) => <div key={index}><i /><span /><span /><span /></div>)}</div></section>
            <footer className="sheet-footer"><span>✧ GRIMOIRE ✧</span><span>{translate(locale, "character.sheetEdition")}</span></footer>
          </section>
        </div>
        <div className="mini-stats">{abilities.map(({ key }) => { const modifier = abilityModifier(character.scores[key]); return <div key={key}>
          <span>{translate(locale, `ability.${key}`).slice(0, 3).toLocaleUpperCase(locale === "es" ? "es-ES" : "en-US")}</span><b>{character.scores[key]}</b><small>{modifier >= 0 ? "+" : "−"}{Math.abs(modifier)}</small></div>; })}</div>
        {character.notes && <p className="character-notes">{character.notes}</p>}
        <div className="character-card-footer"><span>{translate(locale, "character.proficiencyShort")} <b>+{proficiencyBonus(character.level)}</b></span><div>
          <button className="small-action export-action" type="button" onClick={() => exportSheet(character)}>{translate(locale, "character.exportPdf")}</button>
          <button className="small-action" onClick={() => { setEditing(character); setShowEditor(true); }}>{translate(locale, "character.edit")}</button>
          <button className="small-action danger-action" onClick={() => remove(character)}>{translate(locale, "character.delete")}</button>
        </div></div>
      </article>)}</div>}
  </section>;
}
