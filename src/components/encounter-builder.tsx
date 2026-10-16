"use client";

import { useEffect, useMemo, useState } from "react";
import { translate, type Locale } from "@/lib/i18n";
import {
  encounterBudget,
  sampleCreatures,
  suggestEncounters,
  type Creature,
  type Difficulty,
  type EncounterSuggestion,
} from "@/lib/rules";

export interface EncounterBuilderProps {
  locale: Locale;
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

function EncounterOption({ suggestion, index, locale }: { suggestion: EncounterSuggestion; index: number; locale: Locale }) {
  const percent = Math.round((suggestion.totalXp / suggestion.budget) * 100);
  const margin = suggestion.budget - suggestion.totalXp;
  const feedbackKey = percent >= 90
    ? "encounter.budget.feedbackHigh"
    : percent >= 65
      ? "encounter.budget.feedbackModerate"
      : "encounter.budget.feedbackLow";
  const numberLocale = locale === "es" ? "es-ES" : "en-US";

  function creatureName(creature: Creature) {
    return creature.id.startsWith("sample-")
      ? translate(locale, `creature.sample.${creature.xp}.name`)
      : creature.name;
  }

  return (
    <article className="encounter-card" aria-label={translate(locale, "encounter.optionAria", { number: index + 1 })}>
      <div className="encounter-card-top">
        <span className="encounter-index">{translate(locale, "encounter.option", { number: String(index + 1).padStart(2, "0") })}</span>
        <span className={`difficulty-tag ${suggestion.difficulty}`}>{translate(locale, `encounter.difficulty.${suggestion.difficulty}`)}</span>
      </div>
      <div className="xp-total">
        <strong>{suggestion.totalXp.toLocaleString(numberLocale)}</strong>
        <span> / {suggestion.budget.toLocaleString(numberLocale)} {translate(locale, "encounter.xp")}</span>
      </div>
      <div
        className="budget-track"
        role="progressbar"
        aria-label={translate(locale, "encounter.budgetUsedAria")}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.min(percent, 100)}
      >
        <span style={{ width: `${Math.min(percent, 100)}%` }} />
      </div>
      <p className="encounter-footnote mt-2 text-xs leading-relaxed text-muted">
        {translate(locale, "encounter.budget.feedback", {
          percent,
          remaining: margin.toLocaleString(numberLocale),
          xp: translate(locale, "encounter.xp"),
          feedback: translate(locale, feedbackKey),
        })}
      </p>
      <div className="creature-lines">
        {suggestion.lines.map(({ creature, quantity }) => (
          <div className="creature-line" key={creature.id}>
            <span className="creature-glyph" aria-hidden="true">✦</span>
            <span>{creatureName(creature)}<small>{creature.xp.toLocaleString(numberLocale)} {translate(locale, "encounter.xp")} · {creature.id.startsWith("sample-") ? translate(locale, "creature.sample.source") : creature.source}</small></span>
            <b>×{quantity}</b>
          </div>
        ))}
      </div>
    </article>
  );
}

/** Encounter suggestions for a party, with visible budget feedback and one-click rerolls. */
export default function EncounterBuilder({ partyLevels: initialPartyLevels, creatures = sampleCreatures, locale }: EncounterBuilderProps) {
  const [savedCharacters, setSavedCharacters] = useState<SavedCharacter[]>([]);
  const [selectedCharacterIds, setSelectedCharacterIds] = useState<string[]>([]);
  const [storageMessageKey, setStorageMessageKey] = useState("");
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
        if (!Array.isArray(parsed)) throw new Error("Invalid saved character format");
        const valid = parsed.filter(isSavedCharacter).map((character) => ({
          ...character,
          level: Math.min(20, Math.max(1, Math.floor(character.level))),
        }));
        if (valid.length !== parsed.length) setStorageMessageKey("encounter.storage.incomplete");
        setSavedCharacters(valid);
      }
    } catch {
      setStorageMessageKey("encounter.storage.unavailable");
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
  const numberLocale = locale === "es" ? "es-ES" : "en-US";

  function generate() {
    setSuggestions(suggestEncounters(creatures, partyLevels, difficulty));
    setRoll((current) => current + 1);
  }

  return (
    <section className="encounter-layout" aria-label={translate(locale, "encounter.generatorAria")}>
      <section className="encounter-controls">
        <div className="control-section">
          <div className="control-heading"><span className="step-number">01</span><div><h2>{translate(locale, "encounter.party.title")}</h2><p>{translate(locale, "encounter.party.description")}</p></div></div>
          {initialPartyLevels?.length ? (
            <p className="selected-party-note">{translate(locale, "encounter.party.levelSummary", { count: partyLevels.length, levels: partyLevels.join(", ") })}</p>
          ) : (
            <>
              {storageLoaded && savedCharacters.length > 0 && <>
                <p className="title-description">{translate(locale, "encounter.party.savedDescription")}</p>
                <div className="party-select-list" role="group" aria-label={translate(locale, "encounter.party.savedAria")}>
                  {savedCharacters.map((character) => (
                    <label className="party-select" key={character.id}>
                      <input
                        type="checkbox"
                        checked={selectedCharacterIds.includes(character.id)}
                        aria-label={translate(locale, "encounter.party.characterAria", { name: character.name, level: character.level })}
                        onChange={(event) => setSelectedCharacterIds((current) => event.target.checked
                          ? [...current, character.id]
                          : current.filter((id) => id !== character.id))}
                      />
                      <span>{character.name}<small>{translate(locale, "encounter.party.level", { level: character.level })}</small></span>
                    </label>
                  ))}
                </div>
              </>}
              {storageMessageKey && <p role="status" className="encounter-footnote">{translate(locale, storageMessageKey)}</p>}
              {selectedCharacterIds.length > 0 && savedCharacters.some((character) => selectedCharacterIds.includes(character.id)) ? (
                <p className="selected-party-note" aria-live="polite">{translate(locale, "encounter.party.selectedSummary", { count: partyLevels.length, levels: partyLevels.join(", ") })}</p>
              ) : (
                <div className="manual-party">
                  <label>{translate(locale, "encounter.party.size")}<input aria-label={translate(locale, "encounter.party.sizeAria")} type="number" min={1} max={12} value={partySize} onChange={(event) => setPartySize(Math.max(1, Math.min(12, Number(event.target.value) || 1)))} /></label>
                  <label>{translate(locale, "encounter.party.levelLabel")}<input aria-label={translate(locale, "encounter.party.levelAria")} type="number" min={1} max={20} value={partyLevel} onChange={(event) => setPartyLevel(Math.max(1, Math.min(20, Number(event.target.value) || 1)))} /></label>
                </div>
              )}
            </>
          )}
        </div>
        <div className="control-section">
          <div className="control-heading"><span className="step-number">02</span><div><h2>{translate(locale, "encounter.difficulty.title")}</h2><p>{translate(locale, "encounter.difficulty.description")}</p></div></div>
          <div className="difficulty-options">
            {(["low", "moderate", "high"] as const).map((item) => (
              <button type="button" key={item} aria-pressed={difficulty === item} className={`difficulty-option ${difficulty === item ? "selected" : ""}`} onClick={() => setDifficulty(item)}>
                <span className={`difficulty-dot ${item}`} /><b>{translate(locale, `encounter.difficulty.${item}`)}</b>
                <small>{translate(locale, `encounter.difficulty.description.${item}`)}</small>
              </button>
            ))}
          </div>
        </div>
        <div className="budget-summary"><span>{translate(locale, "encounter.budget.title")}</span><strong>{budget.toLocaleString(numberLocale)} <small>{translate(locale, "encounter.xp")}</small></strong><p>{translate(locale, "encounter.budget.partyRules", { count: partyLevels.length })}</p></div>
        <button className="button button-primary generate-button" type="button" onClick={generate} disabled={!creatures.length}>
          {roll ? `↻ ${translate(locale, "encounter.regenerate")}` : `✦ ${translate(locale, "encounter.generate")}`}
        </button>
      </section>
      <section className="encounter-results" aria-live="polite" aria-label={translate(locale, "encounter.resultsAria")}>
        <div className="results-heading"><div><p className="eyebrow">{translate(locale, "encounter.proposals")}{roll > 1 ? ` · ${translate(locale, "encounter.roll", { number: roll })}` : ""}</p><h2>{suggestions.length ? translate(locale, "encounter.optionsReady", { count: suggestions.length }) : translate(locale, "encounter.optionsWaiting")}</h2></div><span className="result-sigil" aria-hidden="true">✳</span></div>
        {!suggestions.length ? (
          <div className="results-empty"><div className="empty-orbit" aria-hidden="true">⚔</div><p>{translate(locale, "encounter.empty.prompt")}<br /><b>{translate(locale, "encounter.empty.action")}</b> {translate(locale, "encounter.empty.detail")}</p></div>
        ) : (
          <div className="encounter-card-list">{suggestions.map((suggestion, index) => <EncounterOption key={`${roll}-${index}`} suggestion={suggestion} index={index} locale={locale} />)}</div>
        )}
        <p className="rules-source">{translate(locale, "encounter.rulesNote")}</p>
      </section>
    </section>
  );
}
