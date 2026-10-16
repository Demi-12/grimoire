"use client";

import { useEffect, useState, type FormEvent } from "react";
import { abilities, abilityModifier, type AbilityKey, type AbilityScores, proficiencyBonus } from "@/lib/rules";

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

const STORAGE_KEY = "grimoire.characters.v1";
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

function ScoreFields({ scores, onChange }: { scores: AbilityScores; onChange: (key: AbilityKey, value: number) => void }) {
  return <div className="ability-grid">{abilities.map(({ key, label }) => {
    const score = scores[key];
    const modifier = abilityModifier(score);
    return <label className="ability-input" key={key}>
      <span>{label}</span>
      <input aria-label={`${label}, puntuación`} type="number" min={1} max={30} required value={score}
        onChange={(event) => onChange(key, Number(event.target.value))} />
      <small aria-label={`Modificador ${modifier >= 0 ? "más" : "menos"} ${Math.abs(modifier)}`}>
        {modifier >= 0 ? "+" : "−"}{Math.abs(modifier)}
      </small>
    </label>;
  })}</div>;
}

function CharacterEditor({ character, onSave, onCancel }: {
  character?: CharacterRecord;
  onSave: (record: CharacterRecord) => void;
  onCancel: () => void;
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
    <div className="panel-heading"><div><p className="eyebrow">HOJA DE AVENTURERO · 5.ª EDICIÓN 2024</p><h2>{character ? "Editar personaje" : "Crear personaje"}</h2></div>
      <button className="icon-button" type="button" onClick={onCancel} aria-label="Cerrar editor">×</button></div>
    <div className="form-grid three-columns">
      <label>Nombre<input autoFocus required maxLength={50} value={name} onChange={(event) => setName(event.target.value)} placeholder="Iria Valen" /></label>
      <label>Clase<input maxLength={40} value={className} onChange={(event) => setClassName(event.target.value)} placeholder="Exploradora" /></label>
      <label>Nivel<input type="number" min={1} max={20} step={1} required value={level} aria-invalid={level !== "" && !validLevel}
        onChange={(event) => setLevel(event.target.value)} />{!validLevel && <small role="alert">El nivel debe ser un número entero del 1 al 20.</small>}</label>
      <label>Especie<input maxLength={40} value={species} onChange={(event) => setSpecies(event.target.value)} placeholder="Humana" /></label>
      <label>Trasfondo<input maxLength={50} value={background} onChange={(event) => setBackground(event.target.value)} placeholder="Ermitaña" /></label>
      <div className="form-aside"><span>Bonificador por competencia</span><strong>+{validLevel ? proficiencyBonus(numericLevel) : "—"}</strong><small>Calculado según nivel total</small></div>
    </div>
    <div className="score-heading"><div><p className="eyebrow">ATRIBUTOS</p><h3>Puntuaciones y modificadores</h3></div>
      <button className="text-button" type="button" onClick={() => setScores(standardArray)}>Aplicar matriz estándar</button></div>
    <p className="field-help mt-2 text-xs leading-relaxed text-muted">Puntuaciones de 1 a 30. Los modificadores se calculan automáticamente.</p>
    <ScoreFields scores={scores} onChange={(key, value) => setScores((current) => ({ ...current, [key]: value }))} />
    {!validScores && <p className="validation-message mt-2 text-sm font-medium text-red-700" role="alert">Cada atributo debe ser un número entero entre 1 y 30.</p>}
    <label className="full-label">Notas<textarea rows={3} maxLength={500} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Objetivos, rasgos o recordatorios" /></label>
    <div className="form-actions"><button className="button button-quiet" type="button" onClick={onCancel}>Cancelar</button>
      <button className="button button-primary" type="submit" disabled={!name.trim() || !validLevel || !validScores}>Guardar personaje</button></div>
  </form>;
}

/** CRUD for character records; stores compatible records for party/encounter selection. */
export default function CharacterBuilder() {
  const [characters, setCharacters] = useState<CharacterRecord[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [editing, setEditing] = useState<CharacterRecord | undefined>();
  const [showEditor, setShowEditor] = useState(false);

  useEffect(() => { setCharacters(loadCharacters()); setLoaded(true); }, []);
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
    if (window.confirm(`¿Borrar a ${record.name}?`)) setCharacters((current) => current.filter(({ id }) => id !== record.id));
  }

  return <section aria-labelledby="characters-title">
    <div className="section-heading"><div><p className="eyebrow">TU GRUPO DE AVENTUREROS</p><h2 id="characters-title">Personajes</h2>
      <p>Guarda las fichas aquí para reutilizar sus niveles al preparar encuentros.</p></div>
      {!showEditor && <button className="button button-primary" onClick={() => { setEditing(undefined); setShowEditor(true); }}>+ Nuevo personaje</button>}
    </div>
    {showEditor && <CharacterEditor character={editing} onSave={save} onCancel={() => { setShowEditor(false); setEditing(undefined); }} />}
    {characters.length === 0 && !showEditor ? <div className="empty-state"><span aria-hidden="true">✦</span><h3>Aún no hay personajes</h3><p>Crea una ficha para empezar a preparar tu party.</p>
      <button className="button button-primary" onClick={() => setShowEditor(true)}>Crear primer personaje</button></div> :
      <div className="character-grid">{characters.map((character) => <article className="character-card" key={character.id}>
        <div className="character-card-top"><span className="avatar-mark">{character.name.slice(0, 1).toLocaleUpperCase("es-ES")}</span><span className="level-pill">NIVEL {character.level}</span></div>
        <h3>{character.name}</h3><p className="character-subtitle">{[character.species, character.className, character.background].filter(Boolean).join(" · ") || "Aventurero"}</p>
        <div className="mini-stats">{abilities.map(({ key, label }) => { const modifier = abilityModifier(character.scores[key]); return <div key={key}>
          <span>{label.slice(0, 3).toLocaleUpperCase("es-ES")}</span><b>{character.scores[key]}</b><small>{modifier >= 0 ? "+" : "−"}{Math.abs(modifier)}</small></div>; })}</div>
        {character.notes && <p className="character-notes">{character.notes}</p>}
        <div className="character-card-footer"><span>Competencia <b>+{proficiencyBonus(character.level)}</b></span><div>
          <button className="small-action" onClick={() => { setEditing(character); setShowEditor(true); }}>Editar</button>
          <button className="small-action danger-action" onClick={() => remove(character)}>Borrar</button>
        </div></div>
      </article>)}</div>}
  </section>;
}
