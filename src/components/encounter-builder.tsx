"use client";

import { Skeleton, SkeletonRegion, Spinner } from "./skeleton";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { translate, type Locale } from "@/lib/i18n";
import {
  encounterBudget,
  sampleCreatures,
  suggestEncounters,
  type Creature,
  type Difficulty,
  type EncounterSuggestion,
  type EncounterRole,
  type PartyRoleProfile,
} from "@/lib/rules";
import MonsterSheet from "@/components/monster-sheet";
import { creatureTypeKey, creatureTypeLabel, fetchSrdCatalog, formatChallenge, srdLabel, type MonsterEdition, type SrdMonster } from "@/lib/monster-api";
import { api, type Campaign, type Character, type EncounterDraft } from "@/lib/api-client";

export interface EncounterBuilderProps {
  locale: Locale;
  /** Optional party levels, one entry per adventurer. Defaults to a configurable party. */
  partyLevels?: number[];
  /** Optional campaign creature catalog. */
  creatures?: Creature[];
  /** Characters the user can see: their own and those in shared campaigns. */
  characters?: Character[];
  /** Campaigns the user belongs to, for one-click party selection. */
  campaigns?: Campaign[];
}

type SavedCharacter = Pick<Character, "id" | "name" | "level" | "campaignId" | "ownerName" | "editable"> & {
  className?: string;
  scores?: Partial<Record<"str" | "dex" | "con" | "int" | "wis" | "cha", number>>;
};

type PartyRoles = Record<"frontline" | "damage" | "support" | "control" | "scouting", string[]>;
const roleKeys: EncounterRole[] = ["frontline", "damage", "support", "control", "scouting"];

function inferRoles(characters: SavedCharacter[]): PartyRoles {
  const roles: PartyRoles = { frontline: [], damage: [], support: [], control: [], scouting: [] };
  for (const character of characters) {
    const name = character.className?.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase() ?? "";
    const score = character.scores ?? {};
    const add = (role: keyof PartyRoles) => roles[role].push(character.name);
    let recognized = false;
    if (/barbarian|barbar[oa]|fighter|guerrer[oa]|paladin|monk|monje/.test(name)) { add("frontline"); recognized = true; }
    if (/rogue|picar[oa]|ranger|explorador[oa]|fighter|guerrer[oa]|barbarian|barbar[oa]|warlock|bruj[oa]/.test(name)) { add("damage"); recognized = true; }
    if (/cleric|clerig[oa]|druid|druida|bard|bard[oa]|paladin/.test(name)) { add("support"); recognized = true; }
    if (/wizard|mago|sorcerer|hechicer[oa]|warlock|bruj[oa]|bard|bard[oa]|druid|druida|monk|monje/.test(name)) { add("control"); recognized = true; }
    if (/rogue|picar[oa]|ranger|explorador[oa]|bard|bard[oa]|monk|monje|druid|druida/.test(name)) { add("scouting"); recognized = true; }
    if (!recognized) {
      // For custom class names, ability scores provide a modest, explicit heuristic.
      if ((score.str ?? 0) >= 14 || (score.con ?? 0) >= 14) add("frontline");
      if ((score.dex ?? 0) >= 14 || (score.str ?? 0) >= 14) add("damage");
      if ((score.wis ?? 0) >= 14 || (score.cha ?? 0) >= 14) add("support");
      if ((score.int ?? 0) >= 14 || (score.wis ?? 0) >= 14) add("control");
      if ((score.dex ?? 0) >= 14 || (score.wis ?? 0) >= 14) add("scouting");
    }
  }
  return roles;
}

function SaveToCampaign({ suggestion, partyLevels, campaigns, locale, creatureName }: {
  suggestion: EncounterSuggestion; partyLevels: number[]; campaigns: Campaign[]; locale: Locale; creatureName: (creature: Creature) => string;
}) {
  const defaultTitle = suggestion.lines.slice(0, 3).map(({ creature, quantity }) => `${quantity}× ${creatureName(creature)}`).join(", ").slice(0, 80);
  const [open, setOpen] = useState(false);
  const [campaignId, setCampaignId] = useState(campaigns[0]?.id ?? "");
  const [title, setTitle] = useState(defaultTitle);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [savedTo, setSavedTo] = useState("");
  const selectedId = campaigns.some((campaign) => campaign.id === campaignId) ? campaignId : campaigns[0]?.id ?? "";

  if (!campaigns.length) return <p className="encounter-footnote">{translate(locale, "encounter.save.noCampaign")}</p>;

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const campaign = campaigns.find((item) => item.id === selectedId);
    if (!campaign || !title.trim()) return;
    const draft: EncounterDraft = {
      title: title.trim().slice(0, 80), notes: "", status: "planned", difficulty: suggestion.difficulty,
      budget: Math.round(suggestion.budget), totalXp: Math.round(suggestion.totalXp), partyLevels,
      lines: suggestion.lines.map(({ creature, quantity }) => ({
        name: creatureName(creature).slice(0, 60), xp: Math.round(creature.xp), count: quantity,
        ...(creature.monsterSlug ? { monsterSlug: creature.monsterSlug } : {}),
        ...(creature.cr !== undefined ? { cr: creature.cr } : {}),
        ...(creature.type ? { type: creature.type } : {}),
        ...(creature.source ? { source: creature.source.slice(0, 60) } : {}),
      })),
    };
    setStatus("saving");
    try {
      await api(`/api/campaigns/${campaign.id}/encounters`, { method: "POST", body: draft });
      setSavedTo(campaign.name);
      setStatus("saved");
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className="encounter-save">
      <button type="button" className="button button-quiet" aria-expanded={open} onClick={() => setOpen((current) => !current)}>✧ {translate(locale, "encounter.save.toggle")}</button>
      {open && (
        <form onSubmit={(event) => void save(event)} className="manual-party" style={{ marginTop: 10 }}>
          <label>{translate(locale, "encounter.save.campaign")}
            <select value={selectedId} onChange={(event) => { setCampaignId(event.target.value); setStatus("idle"); }}>
              {campaigns.map((campaign) => <option key={campaign.id} value={campaign.id}>{campaign.name}</option>)}
            </select>
          </label>
          <label>{translate(locale, "encounter.save.title")}
            <input value={title} maxLength={80} required onChange={(event) => { setTitle(event.target.value); setStatus("idle"); }} />
          </label>
          <button type="submit" className="button button-primary" style={{ gridColumn: "1 / -1" }} disabled={status === "saving" || !title.trim()}>
            {status === "saving" ? translate(locale, "encounter.save.saving") : translate(locale, "encounter.save.submit")}
          </button>
        </form>
      )}
      <p className="encounter-footnote" role={status === "error" ? "alert" : "status"} aria-live="polite">
        {status === "saved" ? translate(locale, "encounter.save.done", { campaign: savedTo }) : status === "error" ? translate(locale, "encounter.save.error") : ""}
      </p>
    </div>
  );
}

function EncounterOption({ suggestion, index, locale, roles, partyLevels, campaigns }: { suggestion: EncounterSuggestion; index: number; locale: Locale; roles: PartyRoles; partyLevels: number[]; campaigns: Campaign[] }) {
  const [openMonster, setOpenMonster] = useState<string | null>(null);
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
            <span>{creatureName(creature)}<small>{creature.cr !== undefined && <>{translate(locale, "encounter.cr")} {formatChallenge(creature.cr)} · </>}{creature.type && <>{creatureTypeLabel(creatureTypeKey(creature.type), locale)} · </>}{creature.xp.toLocaleString(numberLocale)} {translate(locale, "encounter.xp")} · {creature.id.startsWith("sample-") ? translate(locale, "creature.sample.source") : creature.source}</small>
              {creature.monsterSlug && <button type="button" className="small-action" onClick={() => setOpenMonster((current) => current === creature.monsterSlug ? null : creature.monsterSlug!)}>{locale === "es" ? "Ver ficha" : "View stat block"}</button>}
            </span>
            <b>×{quantity}</b>
            {openMonster === creature.monsterSlug && creature.monsterSlug && <div className="w-full basis-full"><MonsterSheet monsterSlug={creature.monsterSlug} locale={locale} /></div>}
          </div>
        ))}
      </div>
      <div className="encounter-footnote mt-3 text-xs leading-relaxed text-muted" aria-label={translate(locale, "encounter.roles.aria")}>
        <strong>{translate(locale, "encounter.roles.title")}</strong>
        {Object.entries(roles).some(([, members]) => members.length > 0) ? (
          <>
            <p>{translate(locale, "encounter.roles.coverage", { roles: Object.entries(roles).filter(([, members]) => members.length).map(([role, members]) => `${translate(locale, `encounter.roles.${role}`)} (${members.length})`).join(", ") })}</p>
            <p>{translate(locale, "encounter.roles.gaps", { roles: Object.entries(roles).filter(([, members]) => !members.length).map(([role]) => translate(locale, `encounter.roles.${role}`)).join(", ") || translate(locale, "encounter.roles.none") })}</p>
            {suggestion.roleFit && <p>{translate(locale, "encounter.roles.monsterFit", { roles: suggestion.roleFit.monsterRoles.map((role) => translate(locale, `encounter.roles.${role}`)).join(", "), gaps: suggestion.roleFit.focusedRoles.map((role) => translate(locale, `encounter.roles.${role}`)).join(", ") || translate(locale, "encounter.roles.none"), score: suggestion.roleFit.score })}</p>}
            {!suggestion.roleFit && <p>{translate(locale, "encounter.roles.caveat")}</p>}
          </>
        ) : <p>{translate(locale, "encounter.roles.unknown")}</p>}
      </div>
      <SaveToCampaign suggestion={suggestion} partyLevels={partyLevels} campaigns={campaigns} locale={locale} creatureName={creatureName} />
    </article>
  );
}

/** Encounter suggestions for a party, with visible budget feedback and one-click rerolls. */
export default function EncounterBuilder({ partyLevels: initialPartyLevels, creatures = sampleCreatures, locale, characters = [], campaigns = [] }: EncounterBuilderProps) {
  const savedCharacters: SavedCharacter[] = characters;
  const [selectedCharacterIds, setSelectedCharacterIds] = useState<string[]>([]);
  const [partySize, setPartySize] = useState(4);
  const [partyLevel, setPartyLevel] = useState(3);
  const [difficulty, setDifficulty] = useState<Difficulty>("moderate");
  const [suggestions, setSuggestions] = useState<EncounterSuggestion[]>([]);
  const [roll, setRoll] = useState(0);
  const [source, setSource] = useState<"srd" | "custom" | "both">("srd");
  const [srd, setSrd] = useState<{ edition?: MonsterEdition; monsters: SrdMonster[] } | null>(null);
  const [srdError, setSrdError] = useState("");
  const [srdAttempt, setSrdAttempt] = useState(0);
  const [types, setTypes] = useState<string[]>([]);
  const [maxKinds, setMaxKinds] = useState(2);
  const usesSrd = source !== "custom";

  useEffect(() => {
    if (!usesSrd || srd) return;
    const controller = new AbortController();
    setSrdError("");
    fetchSrdCatalog(controller.signal).then(setSrd).catch((cause: unknown) => {
      if (!controller.signal.aborted) setSrdError(cause instanceof Error ? cause.message : "Request failed");
    });
    return () => controller.abort();
  }, [usesSrd, srd, srdAttempt]);

  const typeCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const monster of srd?.monsters ?? []) counts.set(creatureTypeKey(monster.type), (counts.get(creatureTypeKey(monster.type)) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => creatureTypeLabel(a[0], locale).localeCompare(creatureTypeLabel(b[0], locale)));
  }, [srd, locale]);
  const srdCreatures = useMemo<Creature[]>(() => (srd?.monsters ?? [])
    .filter((monster) => !types.length || types.includes(creatureTypeKey(monster.type)))
    .map((monster) => ({ id: `srd-${monster.index}`, name: monster.name, xp: monster.xp, source: `D&D ${srdLabel(srd?.edition)}`, roleTags: monster.roles, monsterSlug: monster.index, cr: monster.cr, type: monster.type })),
  [srd, types]);
  const pool = useMemo(() => {
    if (source === "custom") return creatures;
    if (source === "srd") return srdCreatures;
    const ids = new Set(srdCreatures.map((creature) => creature.id));
    return [...srdCreatures, ...creatures.filter((creature) => !ids.has(creature.id))];
  }, [source, creatures, srdCreatures]);

  const partyLevels = useMemo(() => {
    if (initialPartyLevels?.length) {
      return initialPartyLevels.map((level) => Math.min(20, Math.max(1, Math.floor(level))));
    }
    const selected = savedCharacters.filter((character) => selectedCharacterIds.includes(character.id));
    if (selected.length) return selected.map((character) => character.level);
    return Array.from({ length: partySize }, () => partyLevel);
  }, [initialPartyLevels, partyLevel, partySize, savedCharacters, selectedCharacterIds]);
  const budget = encounterBudget(partyLevels, difficulty);
  const selectedParty = savedCharacters.filter((character) => selectedCharacterIds.includes(character.id));
  const partyRoles = inferRoles(selectedParty);
  const roleProfile: PartyRoleProfile = Object.fromEntries(roleKeys.map((role) => [role, partyRoles[role].length]));
  const managedCampaigns = campaigns.filter((campaign) => campaign.canManage);
  const numberLocale = locale === "es" ? "es-ES" : "en-US";

  function generate() {
    setSuggestions(suggestEncounters(pool, partyLevels, difficulty, Math.random, 4, roleProfile,
      source === "custom" ? { maxCreatures: 20 } : { maxKinds, maxCreatures: 12 }));
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
              {savedCharacters.length > 0 && <>
                <p className="title-description">{translate(locale, "encounter.party.savedDescription")}</p>
                {campaigns.length > 0 && <label className="party-campaign-select">{translate(locale, "encounter.party.fromCampaign")}
                  <select value="" onChange={(event) => {
                    const ids = savedCharacters.filter((character) => character.campaignId === event.target.value).map((character) => character.id);
                    if (event.target.value) setSelectedCharacterIds(ids);
                  }}>
                    <option value="">…</option>
                    {campaigns.map((campaign) => <option key={campaign.id} value={campaign.id}>{campaign.name}</option>)}
                  </select>
                </label>}
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
                      <span>{character.name}<small>{translate(locale, "encounter.party.level", { level: character.level })}{character.ownerName && !character.editable ? ` · ${character.ownerName}` : ""}</small></span>
                    </label>
                  ))}
                </div>
              </>}
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
        <div className="control-section">
          <div className="control-heading"><span className="step-number">03</span><div><h2>{translate(locale, "encounter.monsters.title")}</h2><p>{translate(locale, "encounter.monsters.description")}</p></div></div>
          <div className="difficulty-options source-options">
            {(["srd", "both", "custom"] as const).map((item) => (
              <button type="button" key={item} aria-pressed={source === item} className={`difficulty-option ${source === item ? "selected" : ""}`} onClick={() => setSource(item)}>
                <b>{translate(locale, `encounter.monsters.source.${item}`)}</b>
                <small>{item === "custom" ? translate(locale, "encounter.monsters.customCount", { count: creatures.length }) : srd ? translate(locale, "encounter.monsters.srdCount", { count: srd.monsters.length, edition: srdLabel(srd.edition) }) : translate(locale, "encounter.monsters.api")}</small>
              </button>
            ))}
          </div>
          {usesSrd && !srd && !srdError && <SkeletonRegion label={translate(locale, "encounter.monsters.loading")}><p className="encounter-footnote" aria-hidden="true"><Spinner />{translate(locale, "encounter.monsters.loading")}</p><div className="type-chips">{[64, 88, 72, 96, 80].map((width) => <Skeleton key={width} width={width} height={30} style={{ borderRadius: 999 }} />)}</div></SkeletonRegion>}
          {usesSrd && srdError && <p className="encounter-footnote monster-error" role="alert">{translate(locale, "encounter.monsters.error")} {srdError} <button type="button" className="small-action" onClick={() => setSrdAttempt((attempt) => attempt + 1)}>{translate(locale, "encounter.monsters.retry")}</button></p>}
          {usesSrd && srd && <>
            <p className="filter-label">{translate(locale, "encounter.monsters.types")}</p>
            <div className="type-chips" role="group" aria-label={translate(locale, "encounter.monsters.types")}>
              <button type="button" className={`type-chip ${types.length ? "" : "on"}`} aria-pressed={!types.length} onClick={() => setTypes([])}>{translate(locale, "encounter.monsters.allTypes")}</button>
              {typeCounts.map(([key, count]) => <button type="button" key={key} aria-pressed={types.includes(key)} className={`type-chip ${types.includes(key) ? "on" : ""}`}
                onClick={() => setTypes((current) => current.includes(key) ? current.filter((item) => item !== key) : [...current, key])}>{creatureTypeLabel(key, locale)} <small>{count}</small></button>)}
            </div>
            <label className="kinds-field">{translate(locale, "encounter.monsters.kinds")}
              <select value={maxKinds} onChange={(event) => setMaxKinds(Number(event.target.value))}>
                {[1, 2, 3].map((value) => <option key={value} value={value}>{translate(locale, `encounter.monsters.kinds.${value}`)}</option>)}
              </select>
            </label>
          </>}
        </div>
        <div className="budget-summary"><span>{translate(locale, "encounter.budget.title")}</span><strong>{budget.toLocaleString(numberLocale)} <small>{translate(locale, "encounter.xp")}</small></strong><p>{translate(locale, "encounter.budget.partyRules", { count: partyLevels.length })}</p></div>
        <button className="button button-primary generate-button" type="button" onClick={generate} disabled={!pool.length}>
          {roll ? `↻ ${translate(locale, "encounter.regenerate")}` : `✦ ${translate(locale, "encounter.generate")}`}
        </button>
      </section>
      <section className="encounter-results" aria-live="polite" aria-label={translate(locale, "encounter.resultsAria")}>
        <div className="results-heading"><div><p className="eyebrow">{translate(locale, "encounter.proposals")}{roll > 1 ? ` · ${translate(locale, "encounter.roll", { number: roll })}` : ""}</p><h2>{suggestions.length ? translate(locale, "encounter.optionsReady", { count: suggestions.length }) : translate(locale, "encounter.optionsWaiting")}</h2></div><span className="result-sigil" aria-hidden="true">✳︎</span></div>
        {!suggestions.length ? (
          <div className="results-empty"><div className="empty-orbit" aria-hidden="true">⚔︎</div><p>{translate(locale, "encounter.empty.prompt")}<br /><b>{translate(locale, "encounter.empty.action")}</b> {translate(locale, "encounter.empty.detail")}</p></div>
        ) : (
          <div className="encounter-card-list">{suggestions.map((suggestion, index) => <EncounterOption key={`${roll}-${index}`} suggestion={suggestion} index={index} locale={locale} roles={partyRoles} partyLevels={partyLevels} campaigns={managedCampaigns} />)}</div>
        )}
        <p className="rules-source">{translate(locale, "encounter.rulesNote")}</p>
      </section>
    </section>
  );
}
