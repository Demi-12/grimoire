"use client";

import { useEffect, useMemo, useState } from "react";
import {
  encounterBudget,
  sampleCreatures,
  suggestEncounters,
  type Creature,
  type Difficulty,
  type EncounterSuggestion,
} from "@/lib/rules";

const difficultyNames: Record<Difficulty, string> = {
  low: "Baja",
  moderate: "Moderada",
  high: "Alta",
};

export interface EncounterBuilderProps {
  /** Optional party levels, one entry per adventurer. Defaults to a configurable party. */
  partyLevels?: number[];
  /** Optional campaign creature catalog. */
  creatures?: Creature[];
}

type SavedCharacter = { id: string; name: string; level: number };

function isSavedCharacter(value: unknown): value is SavedCharacter {
  if (!value || typeof value !== "object") return false;
  const character = value as Partial<SavedCharacter>;
  return typeof character.id === "string"
    && typeof character.name === "string"
    && typeof character.level === "number"
    && Number.isFinite(character.level);
}

function EncounterOption({ suggestion, index }: { suggestion: EncounterSuggestion; index: number }) {
  const percent = Math.round((suggestion.totalXp / suggestion.budget) * 100);
  const margin = suggestion.budget - suggestion.totalXp;
  const feedback = percent >= 90
    ? "Cerca del límite: una escena exigente para esta party."
    : percent >= 65
      ? "Buen uso del presupuesto; deja algo de margen para la escena."
      : "Encuentro por debajo del presupuesto; puede funcionar como escaramuza.";

  return (
    <article className="encounter-card" aria-label={`Opción ${index + 1}`}>
      <div className="encounter-card-top">
        <span className="encounter-index">OPCIÓN {String(index + 1).padStart(2, "0")}</span>
        <span className={`difficulty-tag ${suggestion.difficulty}`}>{difficultyNames[suggestion.difficulty]}</span>
      </div>
      <div className="xp-total">
        <strong>{suggestion.totalXp.toLocaleString("es-ES")}</strong>
        <span> / {suggestion.budget.toLocaleString("es-ES")} PX</span>
      </div>
      <div
        className="budget-track"
        role="progressbar"
        aria-label="Presupuesto de experiencia usado"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.min(percent, 100)}
      >
        <span style={{ width: `${Math.min(percent, 100)}%` }} />
      </div>
      <p className="encounter-footnote mt-2 text-xs leading-relaxed text-muted">
        {percent}% del presupuesto · quedan {margin.toLocaleString("es-ES")} PX. {feedback}
      </p>
      <div className="creature-lines">
        {suggestion.lines.map(({ creature, quantity }) => (
          <div className="creature-line" key={creature.id}>
            <span className="creature-glyph" aria-hidden="true">✦</span>
            <span>{creature.name}<small>{creature.xp.toLocaleString("es-ES")} PX · {creature.source}</small></span>
            <b>×{quantity}</b>
          </div>
        ))}
      </div>
    </article>
  );
}

/** Encounter suggestions for a party, with visible budget feedback and one-click rerolls. */
export default function EncounterBuilder({ partyLevels: initialPartyLevels, creatures = sampleCreatures }: EncounterBuilderProps) {
  const [savedCharacters, setSavedCharacters] = useState<SavedCharacter[]>([]);
  const [selectedCharacterIds, setSelectedCharacterIds] = useState<string[]>([]);
  const [storageMessage, setStorageMessage] = useState("");
  const [storageLoaded, setStorageLoaded] = useState(false);
  const [partySize, setPartySize] = useState(4);
  const [partyLevel, setPartyLevel] = useState(3);
  const [difficulty, setDifficulty] = useState<Difficulty>("moderate");
  const [suggestions, setSuggestions] = useState<EncounterSuggestion[]>([]);
  const [roll, setRoll] = useState(0);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem("grimoire.characters.v1");
      if (stored) {
        const parsed: unknown = JSON.parse(stored);
        if (!Array.isArray(parsed)) throw new Error("El formato guardado no es una lista.");
        const valid = parsed.filter(isSavedCharacter).map((character) => ({
          ...character,
          level: Math.min(20, Math.max(1, Math.floor(character.level))),
        }));
        if (valid.length !== parsed.length) setStorageMessage("Algunos personajes guardados tenían datos incompletos y no se pudieron cargar.");
        setSavedCharacters(valid);
      }
    } catch {
      setStorageMessage("No se pudieron leer los personajes guardados. Puedes configurar la party manualmente.");
    } finally {
      setStorageLoaded(true);
    }
  }, []);

  const partyLevels = useMemo(() => {
    if (initialPartyLevels?.length) {
      return initialPartyLevels.map((level) => Math.min(20, Math.max(1, Math.floor(level))));
    }
    const selected = savedCharacters.filter((character) => selectedCharacterIds.includes(character.id));
    if (selected.length) return selected.map((character) => character.level);
    return Array.from({ length: partySize }, () => partyLevel);
  }, [initialPartyLevels, partyLevel, partySize, savedCharacters, selectedCharacterIds]);
  const budget = encounterBudget(partyLevels, difficulty);

  function generate() {
    setSuggestions(suggestEncounters(creatures, partyLevels, difficulty));
    setRoll((current) => current + 1);
  }

  return (
    <section className="encounter-layout" aria-label="Generador de encuentros">
      <section className="encounter-controls">
        <div className="control-section">
          <div className="control-heading"><span className="step-number">01</span><div><h2>La party</h2><p>Elige tamaño y nivel del grupo.</p></div></div>
          {initialPartyLevels?.length ? (
            <p className="selected-party-note">{partyLevels.length} aventureros · niveles {partyLevels.join(", ")}</p>
          ) : (
            <>
              {storageLoaded && savedCharacters.length > 0 && <>
                <p className="title-description">Selecciona personajes guardados o deja la selección vacía para usar un grupo manual.</p>
                <div className="party-select-list" role="group" aria-label="Personajes guardados para la party">
                  {savedCharacters.map((character) => (
                    <label className="party-select" key={character.id}>
                      <input
                        type="checkbox"
                        checked={selectedCharacterIds.includes(character.id)}
                        aria-label={`${character.name}, nivel ${character.level}`}
                        onChange={(event) => setSelectedCharacterIds((current) => event.target.checked
                          ? [...current, character.id]
                          : current.filter((id) => id !== character.id))}
                      />
                      <span>{character.name}<small>Nivel {character.level}</small></span>
                    </label>
                  ))}
                </div>
              </>}
              {storageMessage && <p role="status" className="encounter-footnote">{storageMessage}</p>}
              {selectedCharacterIds.length > 0 && savedCharacters.some((character) => selectedCharacterIds.includes(character.id)) ? (
                <p className="selected-party-note" aria-live="polite">{partyLevels.length} aventureros elegidos · niveles {partyLevels.join(", ")}</p>
              ) : (
                <div className="manual-party">
                  <label>Número de personajes<input aria-label="Número de personajes de la party" type="number" min={1} max={12} value={partySize} onChange={(event) => setPartySize(Math.max(1, Math.min(12, Number(event.target.value) || 1)))} /></label>
                  <label>Nivel del grupo<input aria-label="Nivel del grupo" type="number" min={1} max={20} value={partyLevel} onChange={(event) => setPartyLevel(Math.max(1, Math.min(20, Number(event.target.value) || 1)))} /></label>
                </div>
              )}
            </>
          )}
        </div>
        <div className="control-section">
          <div className="control-heading"><span className="step-number">02</span><div><h2>Dificultad</h2><p>Marca la intensidad que buscas.</p></div></div>
          <div className="difficulty-options">
            {(["low", "moderate", "high"] as const).map((item) => (
              <button type="button" key={item} aria-pressed={difficulty === item} className={`difficulty-option ${difficulty === item ? "selected" : ""}`} onClick={() => setDifficulty(item)}>
                <span className={`difficulty-dot ${item}`} /><b>{difficultyNames[item]}</b>
                <small>{item === "low" ? "Un momento tenso" : item === "moderate" ? "Riesgo y recursos" : "Puede ser letal"}</small>
              </button>
            ))}
          </div>
        </div>
        <div className="budget-summary"><span>Presupuesto de XP para este encuentro</span><strong>{budget.toLocaleString("es-ES")} <small>PX</small></strong><p>{partyLevels.length} aventureros · reglas D&amp;D 5e 2024</p></div>
        <button className="button button-primary generate-button" type="button" onClick={generate} disabled={!creatures.length}>
          {roll ? "↻ Volver a generar" : "✦ Generar encuentros"}
        </button>
      </section>
      <section className="encounter-results" aria-live="polite">
        <div className="results-heading"><div><p className="eyebrow">PROPUESTAS {roll > 1 ? `· TIRADA ${roll}` : ""}</p><h2>{suggestions.length ? `${suggestions.length} opciones para preparar` : "Tus opciones aparecerán aquí"}</h2></div><span className="result-sigil" aria-hidden="true">✳</span></div>
        {!suggestions.length ? (
          <div className="results-empty"><div className="empty-orbit" aria-hidden="true">⚔</div><p>Elige la party y la dificultad.<br /><b>Genera opciones</b> para comparar su presupuesto.</p></div>
        ) : (
          <div className="encounter-card-list">{suggestions.map((suggestion, index) => <EncounterOption key={`${roll}-${index}`} suggestion={suggestion} index={index} />)}</div>
        )}
        <p className="rules-source">El presupuesto es una guía de preparación. Revisa rasgos, terreno y recursos del grupo antes de usar el encuentro.</p>
      </section>
    </section>
  );
}
