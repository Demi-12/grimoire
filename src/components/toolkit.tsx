"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  abilities,
  abilityModifier,
  encounterBudget,
  type AbilityKey,
  type AbilityScores,
  type Creature,
  type Difficulty,
  type EncounterSuggestion,
  proficiencyBonus,
  sampleCreatures,
  suggestEncounters,
} from "@/lib/rules";

type Character = {
  id: string;
  name: string;
  className: string;
  species: string;
  background: string;
  level: number;
  scores: AbilityScores;
  notes: string;
};
type View = "home" | "characters" | "encounters";

const emptyScores: AbilityScores = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };
const standardArray: AbilityScores = { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 };
const difficultyNames: Record<Difficulty, string> = { low: "Baja", moderate: "Moderada", high: "Alta" };

function readSaved<T>(key: string, fallback: T): T {
  try {
    const value = window.localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
}

function makeId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function CharacterForm({ initial, onSave, onCancel }: {
  initial?: Character;
  onSave: (character: Character) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [className, setClassName] = useState(initial?.className ?? "");
  const [species, setSpecies] = useState(initial?.species ?? "");
  const [background, setBackground] = useState(initial?.background ?? "");
  const [level, setLevel] = useState(initial?.level ?? 1);
  const [scores, setScores] = useState(initial?.scores ?? emptyScores);
  const [notes, setNotes] = useState(initial?.notes ?? "");

  function setScore(key: AbilityKey, score: number) {
    setScores((current) => ({ ...current, [key]: score }));
  }

  return (
    <form className="editor-panel" onSubmit={(event) => {
      event.preventDefault();
      onSave({ id: initial?.id ?? makeId(), name: name.trim(), className: className.trim(), species: species.trim(), background: background.trim(), level, scores, notes: notes.trim() });
    }}>
      <div className="panel-heading"><div><p className="eyebrow">HOJA DE AVENTURERO</p><h2>{initial ? "Editar personaje" : "Nuevo personaje"}</h2></div><button className="icon-button" type="button" onClick={onCancel} aria-label="Cerrar">×</button></div>
      <div className="form-grid three-columns">
        <label>Nombre<input autoFocus required maxLength={50} value={name} onChange={(event) => setName(event.target.value)} placeholder="Iria Valen" /></label>
        <label>Clase<input maxLength={40} value={className} onChange={(event) => setClassName(event.target.value)} placeholder="Exploradora" /></label>
        <label>Nivel<input type="number" min={1} max={20} required value={level} onChange={(event) => setLevel(Math.min(20, Math.max(1, Number(event.target.value))))} /></label>
        <label>Especie<input maxLength={40} value={species} onChange={(event) => setSpecies(event.target.value)} placeholder="Humana" /></label>
        <label>Trasfondo<input maxLength={50} value={background} onChange={(event) => setBackground(event.target.value)} placeholder="Ermitaña" /></label>
        <div className="form-aside"><span>Bonificador por competencia</span><strong>+{proficiencyBonus(level)}</strong><small>Según nivel total</small></div>
      </div>
      <div className="score-heading"><div><p className="eyebrow">ATRIBUTOS</p><h3>Puntuaciones</h3></div><button className="text-button" type="button" onClick={() => setScores(standardArray)}>Usar matriz estándar</button></div>
      <div className="ability-grid">{abilities.map(({ key, label }) => <label className="ability-input" key={key}><span>{label}</span><input type="number" min={1} max={30} value={scores[key]} onChange={(event) => setScore(key, Number(event.target.value))} /><small>{abilityModifier(scores[key]) >= 0 ? "+" : ""}{abilityModifier(scores[key])}</small></label>)}</div>
      <label className="full-label">Notas<textarea rows={3} maxLength={500} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Objetivos, rasgos o recordatorios" /></label>
      <div className="form-actions"><button className="button button-quiet" type="button" onClick={onCancel}>Cancelar</button><button className="button button-primary" type="submit">Guardar personaje</button></div>
    </form>
  );
}

function CharacterCard({ character, onEdit, onDelete }: { character: Character; onEdit: () => void; onDelete: () => void }) {
  return <article className="character-card">
    <div className="character-card-top"><span className="avatar-mark">{character.name.slice(0, 1).toUpperCase()}</span><span className="level-pill">NIVEL {character.level}</span></div>
    <h3>{character.name}</h3><p className="character-subtitle">{[character.species, character.className, character.background].filter(Boolean).join(" · ") || "Aventurero"}</p>
    <div className="mini-stats">{abilities.map(({ key, label }) => <div key={key}><span>{label.slice(0, 3).toUpperCase()}</span><b>{character.scores[key]}</b><small>{abilityModifier(character.scores[key]) >= 0 ? "+" : ""}{abilityModifier(character.scores[key])}</small></div>)}</div>
    {character.notes && <p className="character-notes">{character.notes}</p>}
    <div className="character-card-footer"><span>Competencia <b>+{proficiencyBonus(character.level)}</b></span><div><button className="small-action" onClick={onEdit}>Editar</button><button className="small-action danger-action" onClick={onDelete}>Borrar</button></div></div>
  </article>;
}

function EncounterCard({ suggestion, index }: { suggestion: EncounterSuggestion; index: number }) {
  const percent = Math.min(100, Math.round((suggestion.totalXp / suggestion.budget) * 100));
  return <article className="encounter-card">
    <div className="encounter-card-top"><span className="encounter-index">OPCIÓN 0{index + 1}</span><span className={`difficulty-tag ${suggestion.difficulty}`}>{difficultyNames[suggestion.difficulty]}</span></div>
    <div className="xp-total"><strong>{suggestion.totalXp.toLocaleString("es-ES")}</strong><span> / {suggestion.budget.toLocaleString("es-ES")} PX</span></div>
    <div className="budget-track"><span style={{ width: `${percent}%` }} /></div>
    <div className="creature-lines">{suggestion.lines.map(({ creature, quantity }) => <div className="creature-line" key={creature.id}><span className="creature-glyph" aria-hidden="true">✦</span><span>{creature.name}<small>{creature.xp.toLocaleString("es-ES")} PX · {creature.source}</small></span><b>×{quantity}</b></div>)}</div>
    <p className="encounter-footnote">Presupuesto usado: {percent}%. Revisa los rasgos y el contexto antes de usarlo.</p>
  </article>;
}

export default function Toolkit() {
  const [view, setView] = useState<View>("home");
  const [characters, setCharacters] = useState<Character[]>([]);
  const [creatures, setCreatures] = useState<Creature[]>(sampleCreatures);
  const [loaded, setLoaded] = useState(false);
  const [editing, setEditing] = useState<Character | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [partySize, setPartySize] = useState(4);
  const [partyLevel, setPartyLevel] = useState(3);
  const [difficulty, setDifficulty] = useState<Difficulty>("moderate");
  const [suggestions, setSuggestions] = useState<EncounterSuggestion[]>([]);
  const [creatureName, setCreatureName] = useState("");
  const [creatureXp, setCreatureXp] = useState(100);
  const [showCatalog, setShowCatalog] = useState(false);

  useEffect(() => {
    setCharacters(readSaved<Character[]>("grimoire.characters.v1", []));
    setCreatures(readSaved<Creature[]>("grimoire.creatures.v1", sampleCreatures));
    setLoaded(true);
  }, []);
  useEffect(() => { if (loaded) window.localStorage.setItem("grimoire.characters.v1", JSON.stringify(characters)); }, [characters, loaded]);
  useEffect(() => { if (loaded) window.localStorage.setItem("grimoire.creatures.v1", JSON.stringify(creatures)); }, [creatures, loaded]);

  const partyLevels = useMemo(() => {
    const chosen = characters.filter((character) => selectedIds.includes(character.id)).map((character) => character.level);
    return chosen.length ? chosen : Array.from({ length: partySize }, () => partyLevel);
  }, [characters, partySize, partyLevel, selectedIds]);
  const title = view === "home" ? "Tu mesa de juego" : view === "characters" ? "Personajes" : "Encuentros";

  function saveCharacter(character: Character) {
    setCharacters((current) => current.some((item) => item.id === character.id) ? current.map((item) => item.id === character.id ? character : item) : [character, ...current]);
    setEditing(null);
    setShowForm(false);
  }

  function deleteCharacter(character: Character) {
    if (!window.confirm(`¿Borrar a ${character.name}?`)) return;
    setCharacters((current) => current.filter((item) => item.id !== character.id));
    setSelectedIds((current) => current.filter((id) => id !== character.id));
  }

  function addCreature(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!creatureName.trim() || creatureXp < 1) return;
    setCreatures((current) => [{ id: makeId(), name: creatureName.trim(), xp: creatureXp, source: "Catálogo propio" }, ...current]);
    setCreatureName("");
  }

  function generate() { setSuggestions(suggestEncounters(creatures, partyLevels, difficulty)); }

  return <main className="app-shell">
    <aside className="sidebar">
      <button className="brand" onClick={() => setView("home")}><span>✳</span><b>GRIMOIRE</b></button>
      <div className="sidebar-caption">TU ESPACIO</div>
      <nav className="side-nav" aria-label="Navegación principal">
        <button className={view === "home" ? "active" : ""} onClick={() => setView("home")}><span>⌂</span>Resumen</button>
        <button className={view === "characters" ? "active" : ""} onClick={() => setView("characters")}><span>♙</span>Personajes<small>{characters.length}</small></button>
        <button className={view === "encounters" ? "active" : ""} onClick={() => setView("encounters")}><span>⚔</span>Encuentros</button>
      </nav>
      <div className="sidebar-bottom"><span className="edition-dot" />REGLAS · D&D 5E 2024<p>Datos guardados en este dispositivo</p></div>
    </aside>

    <section className="workspace">
      <header className="workspace-header"><div className="mobile-brand">✳ GRIMOIRE</div><span className="breadcrumb">CAMPAÑA PERSONAL <i>/</i> {title.toUpperCase()}</span><span className="edition-badge">5E · 2024</span></header>
      {view === "home" && <div className="page-content">
        <section className="welcome-banner"><div className="banner-copy"><p className="eyebrow light-eyebrow"><span /> CUADERNO DE CAMPAÑA</p><h1>Las grandes historias<br />empiezan <em>aquí.</em></h1><p>Prepara a tus aventureros y encuentra el desafío perfecto para la mesa.</p><div className="banner-actions"><button className="button button-lime" onClick={() => { setView("characters"); setShowForm(true); }}>Crear personaje <span>↗</span></button><button className="button button-outline" onClick={() => setView("encounters")}>Preparar encuentro</button></div></div><div className="banner-art" aria-hidden="true"><div className="art-ring ring-a" /><div className="art-ring ring-b" /><span>✳</span><small>EST. MMXXIV</small></div></section>
        <section className="dashboard-section"><div className="section-title"><div><p className="eyebrow">PUNTO DE PARTIDA</p><h2>Tu caja de herramientas</h2></div><span className="section-aside">{characters.length} {characters.length === 1 ? "personaje" : "personajes"} guardados</span></div><div className="dashboard-grid">
          <button className="dashboard-card" onClick={() => setView("characters")}><span className="dashboard-icon">♙</span><span className="card-kicker">01 · PERSONAJES</span><strong>Diseña tu héroe</strong><p>Guarda sus atributos y consulta los valores derivados automáticamente.</p><span className="card-link">Abrir creador <b>↗</b></span></button>
          <button className="dashboard-card" onClick={() => setView("encounters")}><span className="dashboard-icon crossed-swords">⚔</span><span className="card-kicker">02 · ENCUENTROS</span><strong>Prepara el desafío</strong><p>Calcula el presupuesto por nivel y genera combinaciones de tu catálogo.</p><span className="card-link">Generar encuentro <b>↗</b></span></button>
        </div></section>
        <div className="privacy-note"><span>◈</span><p><b>Tu cuaderno se queda contigo.</b> Esta versión guarda personajes y catálogo en este navegador.</p></div>
      </div>}

      {view === "characters" && <div className="page-content">
        <div className="section-title page-title"><div><p className="eyebrow">EL REPARTO</p><h1>Tus personajes</h1><p className="title-description">Crea hojas sencillas con atributos y cálculos automáticos.</p></div>{!showForm && <button className="button button-primary" onClick={() => { setEditing(null); setShowForm(true); }}>＋ Nuevo personaje</button>}</div>
        {showForm && <CharacterForm key={editing?.id ?? "new"} initial={editing ?? undefined} onSave={saveCharacter} onCancel={() => { setShowForm(false); setEditing(null); }} />}
        {!showForm && !characters.length && <div className="empty-state"><span>♙</span><h2>Aún no hay aventureros</h2><p>Crea el primer personaje para empezar a preparar tu party.</p><button className="button button-primary" onClick={() => setShowForm(true)}>Crear primer personaje</button></div>}
        {!showForm && characters.length > 0 && <div className="character-grid">{characters.map((character) => <CharacterCard key={character.id} character={character} onEdit={() => { setEditing(character); setShowForm(true); }} onDelete={() => deleteCharacter(character)} />)}</div>}
        <p className="local-data-note">Los datos de esta versión se guardan localmente en este navegador.</p>
      </div>}

      {view === "encounters" && <div className="page-content">
        <div className="section-title page-title"><div><p className="eyebrow">EL ENCUENTRO</p><h1>Diseña un desafío</h1><p className="title-description">Presupuesto según niveles y dificultad de las reglas 2024.</p></div><button className="button button-quiet" onClick={() => setShowCatalog((open) => !open)}>{showCatalog ? "Cerrar catálogo" : `Catálogo · ${creatures.length}`}</button></div>
        <div className="encounter-layout"><section className="encounter-controls">
          <div className="control-section"><div className="control-heading"><span className="step-number">01</span><div><h2>La party</h2><p>Elige personajes guardados o configura el grupo.</p></div></div>
            {characters.length > 0 && <div className="party-select-list">{characters.map((character) => <label className="party-select" key={character.id}><input type="checkbox" checked={selectedIds.includes(character.id)} onChange={(event) => setSelectedIds((current) => event.target.checked ? [...current, character.id] : current.filter((id) => id !== character.id))} /><span>{character.name}<small>{character.className || "Aventurero"} · nivel {character.level}</small></span></label>)}</div>}
            {!selectedIds.length && <div className="manual-party"><label>Número de personajes<input type="number" min={1} max={12} value={partySize} onChange={(event) => setPartySize(Math.max(1, Math.min(12, Number(event.target.value))))} /></label><label>Nivel del grupo<input type="number" min={1} max={20} value={partyLevel} onChange={(event) => setPartyLevel(Math.max(1, Math.min(20, Number(event.target.value))))} /></label></div>}
            {!!selectedIds.length && <p className="selected-party-note">{selectedIds.length} elegidos · presupuesto por nivel individual.</p>}
          </div>
          <div className="control-section"><div className="control-heading"><span className="step-number">02</span><div><h2>Dificultad</h2><p>Elige la intensidad de la escena.</p></div></div><div className="difficulty-options">{(["low", "moderate", "high"] as Difficulty[]).map((item) => <button type="button" key={item} className={`difficulty-option ${difficulty === item ? "selected" : ""}`} onClick={() => setDifficulty(item)}><span className={`difficulty-dot ${item}`} /><b>{difficultyNames[item]}</b><small>{item === "low" ? "Un momento tenso" : item === "moderate" ? "Riesgo y recursos" : "Puede ser letal"}</small></button>)}</div></div>
          <div className="budget-summary"><span>Presupuesto total estimado</span><strong>{encounterBudget(partyLevels, difficulty).toLocaleString("es-ES")} <small>PX</small></strong><p>{partyLevels.length} aventureros · 5e 2024</p></div>
          <button className="button button-primary generate-button" onClick={() => setSuggestions(suggestEncounters(creatures, partyLevels, difficulty))} disabled={!creatures.length}>✦ Generar opciones</button>
        </section>
        <section className="encounter-results"><div className="results-heading"><div><p className="eyebrow">PROPUESTAS</p><h2>{suggestions.length ? `${suggestions.length} encuentros posibles` : "Tus opciones aparecerán aquí"}</h2></div><span className="result-sigil">✳</span></div>
          {suggestions.length ? <div className="encounter-card-list">{suggestions.map((suggestion, index) => <EncounterCard key={`${index}-${suggestion.totalXp}`} suggestion={suggestion} index={index} />)}</div> : <div className="results-empty"><div className="empty-orbit">✦</div><p>Configura tu party y pulsa <b>Generar opciones</b>.<br />Usaremos el XP del catálogo de criaturas.</p></div>}
          <p className="rules-source">El presupuesto suma el valor por personaje según dificultad. Revisa rasgos, terreno y contexto; el cálculo es orientativo.</p>
        </section></div>
        {showCatalog && <section className="catalog-panel"><div className="catalog-heading"><div><p className="eyebrow">BIBLIOTECA PROPIA</p><h2>Catálogo de criaturas</h2><p>Los perfiles de ejemplo son genéricos. Añade criaturas y XP de tus fuentes.</p></div></div>
          <form className="creature-form" onSubmit={addCreature}><label>Nombre<input required maxLength={60} value={creatureName} onChange={(event) => setCreatureName(event.target.value)} placeholder="Nombre de criatura" /></label><label>Valor en PX<input type="number" min={1} max={100000} value={creatureXp} onChange={(event) => setCreatureXp(Number(event.target.value))} /></label><button className="button button-primary" type="submit">＋ Añadir criatura</button></form>
          <div className="catalog-list">{creatures.map((creature) => <div className="catalog-row" key={creature.id}><span>✦</span><b>{creature.name}</b><small>{creature.source}</small><strong>{creature.xp.toLocaleString("es-ES")} PX</strong>{creature.source === "Catálogo propio" && <button className="small-action danger-action" onClick={() => setCreatures((current) => current.filter((item) => item.id !== creature.id))}>Quitar</button>}</div>)}</div>
        </section>}
      </div>}
      <footer className="app-footer"><span>GRIMOIRE · HERRAMIENTAS PARA TU MESA</span><span>REGLAS DE ENCUENTRO · 5E 2024</span></footer>
    </section>
  </main>;
}
