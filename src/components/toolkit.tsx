"use client";

import { useEffect, useState, type FormEvent } from "react";
import CharacterBuilder from "@/components/character-builder";
import EncounterBuilder from "@/components/encounter-builder";
import { sampleCreatures, type Creature } from "@/lib/rules";

type View = "home" | "characters" | "encounters";

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

export default function Toolkit() {
  const [view, setView] = useState<View>("home");
  const [characters, setCharacters] = useState<{ id: string }[]>([]);
  const [creatures, setCreatures] = useState<Creature[]>(sampleCreatures);
  const [creatureName, setCreatureName] = useState("");
  const [creatureXp, setCreatureXp] = useState(100);
  const [showCatalog, setShowCatalog] = useState(false);

  useEffect(() => {
    setCharacters(readSaved("grimoire.characters.v1", []));
    setCreatures(readSaved("grimoire.creatures.v1", sampleCreatures));
  }, []);
  useEffect(() => {
    if (view === "home") setCharacters(readSaved("grimoire.characters.v1", []));
  }, [view]);
  useEffect(() => {
    window.localStorage.setItem("grimoire.creatures.v1", JSON.stringify(creatures));
  }, [creatures]);

  const title = view === "home" ? "Tu mesa de juego" : view === "characters" ? "Personajes" : "Encuentros";

  function addCreature(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!creatureName.trim() || creatureXp < 1) return;
    setCreatures((current) => [{ id: makeId(), name: creatureName.trim(), xp: creatureXp, source: "Catálogo propio" }, ...current]);
    setCreatureName("");
  }

  return <main className="app-shell min-h-screen bg-paper text-ink">
    <aside className="sidebar">
      <button className="brand" onClick={() => setView("home")}><span>✳</span><b>GRIMOIRE</b></button>
      <div className="sidebar-caption">TU ESPACIO</div>
      <nav className="side-nav" aria-label="Navegación principal">
        <button className={view === "home" ? "active" : ""} onClick={() => setView("home")}><span aria-hidden="true">⌂</span>Resumen</button>
        <button className={view === "characters" ? "active" : ""} onClick={() => setView("characters")}><span aria-hidden="true">♙</span>Personajes<small>{characters.length}</small></button>
        <button className={view === "encounters" ? "active" : ""} onClick={() => setView("encounters")}><span aria-hidden="true">⚔</span>Encuentros</button>
      </nav>
      <div className="sidebar-bottom"><span className="edition-dot" />REGLAS · D&amp;D 5E 2024<p>Datos guardados en este dispositivo</p></div>
    </aside>

    <section className="workspace">
      <header className="workspace-header"><div className="mobile-brand">✳ GRIMOIRE</div><span className="breadcrumb">CAMPAÑA PERSONAL <i>/</i> {title.toUpperCase()}</span><span className="edition-badge">5E · 2024</span></header>
      {view === "home" && <div className="page-content">
        <section className="welcome-banner"><div className="banner-copy"><p className="eyebrow light-eyebrow"><span /> CUADERNO DE CAMPAÑA</p><h1>Las grandes historias<br />empiezan <em>aquí.</em></h1><p>Prepara a tus aventureros y encuentra el desafío perfecto para la mesa.</p><div className="banner-actions"><button className="button button-lime" onClick={() => setView("characters")}>Crear personaje <span>↗</span></button><button className="button button-outline" onClick={() => setView("encounters")}>Preparar encuentro</button></div></div><div className="banner-art" aria-hidden="true"><div className="art-ring ring-a" /><div className="art-ring ring-b" /><span>✳</span><small>EST. MMXXIV</small></div></section>
        <section className="dashboard-section"><div className="section-title"><div><p className="eyebrow">PUNTO DE PARTIDA</p><h2>Tu caja de herramientas</h2></div><span className="section-aside">{characters.length} {characters.length === 1 ? "personaje" : "personajes"} guardados</span></div><div className="dashboard-grid">
          <button className="dashboard-card" onClick={() => setView("characters")}><span className="dashboard-icon">♙</span><span className="card-kicker">01 · PERSONAJES</span><strong>Diseña tu héroe</strong><p>Guarda sus atributos y consulta los valores derivados automáticamente.</p><span className="card-link">Abrir creador <b>↗</b></span></button>
          <button className="dashboard-card" onClick={() => setView("encounters")}><span className="dashboard-icon crossed-swords">⚔</span><span className="card-kicker">02 · ENCUENTROS</span><strong>Prepara el desafío</strong><p>Calcula el presupuesto por nivel y genera combinaciones de tu catálogo.</p><span className="card-link">Generar encuentro <b>↗</b></span></button>
        </div></section>
        <div className="privacy-note"><span>◈</span><p><b>Tu cuaderno se queda contigo.</b> Esta versión guarda personajes y catálogo en este navegador.</p></div>
      </div>}

      {view === "characters" && <div className="page-content">
        <div className="section-title page-title"><div><p className="eyebrow">EL REPARTO</p><h1>Tus personajes</h1><p className="title-description">Crea hojas sencillas con atributos y cálculos automáticos.</p></div></div>
        <CharacterBuilder />
        <p className="local-data-note">Los datos de esta versión se guardan localmente en este navegador.</p>
      </div>}

      {view === "encounters" && <div className="page-content">
        <div className="section-title page-title"><div><p className="eyebrow">EL ENCUENTRO</p><h1>Diseña un desafío</h1><p className="title-description">Presupuesto según niveles y dificultad de las reglas 2024.</p></div><button className="button button-quiet" onClick={() => setShowCatalog((open) => !open)}>{showCatalog ? "Cerrar catálogo" : `Catálogo · ${creatures.length}`}</button></div>
        <EncounterBuilder creatures={creatures} />
        {showCatalog && <section className="catalog-panel"><div className="catalog-heading"><div><p className="eyebrow">BIBLIOTECA PROPIA</p><h2>Catálogo de criaturas</h2><p>Los perfiles de ejemplo son genéricos. Añade criaturas y PX de tus fuentes.</p></div></div>
          <form className="creature-form" onSubmit={addCreature}><label>Nombre<input required maxLength={60} value={creatureName} onChange={(event) => setCreatureName(event.target.value)} placeholder="Nombre de criatura" /></label><label>Valor en PX<input type="number" min={1} max={100000} value={creatureXp} onChange={(event) => setCreatureXp(Number(event.target.value))} /></label><button className="button button-primary" type="submit">＋ Añadir criatura</button></form>
          <div className="catalog-list">{creatures.map((creature) => <div className="catalog-row" key={creature.id}><span aria-hidden="true">✦</span><b>{creature.name}</b><small>{creature.source}</small><strong>{creature.xp.toLocaleString("es-ES")} PX</strong>{creature.source === "Catálogo propio" && <button className="small-action danger-action" onClick={() => setCreatures((current) => current.filter((item) => item.id !== creature.id))}>Quitar</button>}</div>)}</div>
        </section>}
      </div>}
      <footer className="app-footer"><span>GRIMOIRE · HERRAMIENTAS PARA TU MESA</span><span>REGLAS DE ENCUENTRO · 5E 2024</span></footer>
    </section>
  </main>;
}
