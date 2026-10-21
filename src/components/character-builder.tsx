"use client";

import { Spinner } from "./skeleton";
import { useEffect, useState, type FormEvent } from "react";
import { abilities, abilityModifier, type AbilityKey, type AbilityScores, proficiencyBonus } from "@/lib/rules";
import { translate, type Locale } from "@/lib/i18n";
import type { Campaign, Character, CharacterDraft } from "@/lib/api-client";
import CharacterWizard, { describeBuild, type WizardResult } from "@/components/character-wizard";
import LevelUp, { type LevelUpResult } from "@/components/level-up";
import { attackList, deriveSheet, type CharacterBuild, type DerivedSheet } from "@/lib/character-sheet";
import { alignments, backgrounds, classes, findBackground, findClass, findSpecies, say, skillKeys, species as speciesList, standardLanguages, type Text } from "@/lib/dnd2024";
import { featInfo } from "@/lib/levelup-data";
import { MAX_LEVEL, unlockedFeatures } from "@/lib/levelup";

const signed = (value: number) => `${value >= 0 ? "+" : "−"}${Math.abs(value)}`;
/** Starting gear chosen in the creator, without the coin entries. */
function startingItems(build: CharacterBuild, locale: Locale): string[] {
  const cls = findClass(build.classId);
  const bg = findBackground(build.backgroundId);
  const options = [cls?.equipment.find((option) => option.id === build.classEquipment), bg?.equipment.find((option) => option.id === build.backgroundEquipment)];
  return options.flatMap((option) => option?.items ?? []).filter((item) => !/ GP$/.test(item.en)).map((item) => say(item, locale));
}

const sheetFor = (character: Character): DerivedSheet | null => character.build ? deriveSheet(character.build, character.level) : null;

const blankScores: AbilityScores = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };
const standardArray: AbilityScores = { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 };

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

/** Select over catalog names; keeps a legacy free-text value selectable so older sheets don't lose it. */
function CatalogSelect({ value, onChange, options, locale, placeholder, maxLength }: {
  value: string; onChange: (value: string) => void; options: Text[]; locale: Locale; placeholder: string; maxLength: number;
}) {
  const names = options.map((option) => say(option, locale));
  const extra = value && !names.includes(value) ? value : "";
  return <select value={value} onChange={(event) => onChange(event.target.value.slice(0, maxLength))}>
    <option value="">{placeholder}</option>
    {extra && <option value={extra}>{extra}</option>}
    {names.map((name) => <option key={name} value={name}>{name}</option>)}
  </select>;
}

function CharacterEditor({ character, campaigns, onSave, onCancel, locale }: {
  character?: Character;
  campaigns: Campaign[];
  onSave: (draft: CharacterDraft) => Promise<void>;
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
  const [campaignId, setCampaignId] = useState(character?.campaignId ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const numericLevel = Number(level);
  const validLevel = Number.isInteger(numericLevel) && numericLevel >= 1 && numericLevel <= 20;
  const validScores = abilities.every(({ key }) => Number.isInteger(scores[key]) && scores[key] >= 1 && scores[key] <= 30);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim() || !validLevel || !validScores) return;
    setSaving(true);
    setError("");
    try {
      await onSave({ name: name.trim(), className: className.trim(), species: species.trim(), background: background.trim(), level: numericLevel, scores, notes: notes.trim(), campaignId: campaignId || null });
    } catch {
      setError(translate(locale, "character.saveError"));
    } finally {
      setSaving(false);
    }
  }

  return <form className="editor-panel" onSubmit={(event) => void handleSubmit(event)}>
    <div className="panel-heading"><div><p className="eyebrow">{translate(locale, "character.sheetKicker")}</p><h2>{translate(locale, character ? "character.editTitle" : "character.createTitle")}</h2></div>
      <button className="icon-button" type="button" onClick={onCancel} aria-label={translate(locale, "character.closeEditor")}>×</button></div>
    <div className="form-grid three-columns">
      <label>{translate(locale, "character.name")}<input autoFocus required maxLength={50} value={name} onChange={(event) => setName(event.target.value)} placeholder={translate(locale, "character.namePlaceholder")} /></label>
      <label>{translate(locale, "character.class")}<CatalogSelect value={className} onChange={setClassName} options={classes.map((item) => item.name)} locale={locale} maxLength={40} placeholder={translate(locale, "character.classPlaceholder")} /></label>
      <label>{translate(locale, "character.level")}<input type="number" min={1} max={20} step={1} required value={level} aria-invalid={level !== "" && !validLevel}
        onChange={(event) => setLevel(event.target.value)} />{!validLevel && <small role="alert">{translate(locale, "character.levelValidation")}</small>}</label>
      <label>{translate(locale, "character.species")}<CatalogSelect value={species} onChange={setSpecies} options={speciesList.map((item) => item.name)} locale={locale} maxLength={40} placeholder={translate(locale, "character.speciesPlaceholder")} /></label>
      <label>{translate(locale, "character.background")}<CatalogSelect value={background} onChange={setBackground} options={backgrounds.map((item) => item.name)} locale={locale} maxLength={50} placeholder={translate(locale, "character.backgroundPlaceholder")} /></label>
      <label>{translate(locale, "character.campaign")}<select value={campaignId} onChange={(event) => setCampaignId(event.target.value)}>
        <option value="">{translate(locale, "character.noCampaign")}</option>
        {campaigns.map((campaign) => <option key={campaign.id} value={campaign.id}>{campaign.name}</option>)}
      </select></label>
      <div className="form-aside"><span>{translate(locale, "character.proficiencyBonus")}</span><strong>+{validLevel ? proficiencyBonus(numericLevel) : "—"}</strong><small>{translate(locale, "character.totalLevelHint")}</small></div>
    </div>
    <div className="score-heading"><div><p className="eyebrow">{translate(locale, "character.abilitiesKicker")}</p><h3>{translate(locale, "character.scoresTitle")}</h3></div>
      <button className="text-button" type="button" onClick={() => setScores(standardArray)}>{translate(locale, "character.standardArray")}</button></div>
    <p className="field-help mt-2 text-xs leading-relaxed text-muted">{translate(locale, "character.scoresHint")}</p>
    <ScoreFields scores={scores} locale={locale} onChange={(key, value) => setScores((current) => ({ ...current, [key]: value }))} />
    {!validScores && <p className="validation-message mt-2 text-sm font-medium text-red-700" role="alert">{translate(locale, "character.scoresValidation")}</p>}
    <label className="full-label">{translate(locale, "character.notes")}<textarea rows={3} maxLength={500} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder={translate(locale, "character.notesPlaceholder")} /></label>
    {error && <p className="validation-message mt-2 text-sm font-medium text-red-700" role="alert">{error}</p>}
    <div className="form-actions"><button className="button button-quiet" type="button" onClick={onCancel}>{translate(locale, "character.cancel")}</button>
      <button className="button button-primary" type="submit" disabled={saving || !name.trim() || !validLevel || !validScores}>{saving && <Spinner />}{translate(locale, saving ? "common.saving" : "character.save")}</button></div>
  </form>;
}

/** CRUD for the signed-in user's characters, stored in PostgreSQL through the API. */
export default function CharacterBuilder({ locale, characters, campaigns, onSave, onDelete }: {
  locale: Locale;
  /** Characters the user owns (editable). */
  characters: Character[];
  /** Campaigns the user belongs to, offered when placing a character. */
  campaigns: Campaign[];
  onSave: (draft: CharacterDraft, id?: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState<Character | undefined>();
  const [showEditor, setShowEditor] = useState(false);
  const [wizard, setWizard] = useState<{ record?: Character; quick?: boolean } | null>(null);
  const [levelingUp, setLevelingUp] = useState<Character | null>(null);
  const [printingId, setPrintingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const resetPrintState = () => {
      delete document.body.dataset.printingSheet;
      setPrintingId(null);
    };
    window.addEventListener("afterprint", resetPrintState);
    return () => window.removeEventListener("afterprint", resetPrintState);
  }, []);

  async function save(draft: CharacterDraft) {
    await onSave(draft, editing?.id);
    setShowEditor(false);
    setEditing(undefined);
  }

  async function saveFromWizard(result: WizardResult) {
    const described = describeBuild(result.build, locale, result.level);
    const record = wizard?.record;
    setError("");
    try {
      await onSave({ name: result.name, level: result.level, notes: result.notes, build: result.build, campaignId: record?.campaignId ?? null,
        className: described.className, species: described.species, background: described.background, scores: described.scores }, record?.id);
      setWizard(null);
    } catch {
      setError(translate(locale, "character.saveError"));
    }
  }

  async function saveLevelUp(record: Character, result: LevelUpResult) {
    const described = describeBuild(result.build, locale, result.level);
    setError("");
    try {
      await onSave({ name: record.name, level: result.level, notes: record.notes, build: result.build, campaignId: record.campaignId,
        className: described.className, species: described.species, background: described.background, scores: described.scores }, record.id);
      setLevelingUp(null);
    } catch {
      setError(translate(locale, "character.saveError"));
    }
  }

  function startLevelUp(record: Character) {
    setShowEditor(false); setWizard(null); setLevelingUp(record);
  }

  function startEdit(record: Character) {
    setLevelingUp(null);
    if (record.build) { setShowEditor(false); setWizard({ record }); return; }
    setWizard(null); setEditing(record); setShowEditor(true);
  }

  async function remove(record: Character) {
    if (!window.confirm(translate(locale, "character.deleteConfirm", { name: record.name }))) return;
    setError("");
    try {
      await onDelete(record.id);
    } catch {
      setError(translate(locale, "character.deleteError"));
    }
  }

  function campaignName(id: string | null) {
    return id ? campaigns.find((campaign) => campaign.id === id)?.name : undefined;
  }

  function exportSheet(record: Character) {
    document.body.dataset.printingSheet = "true";
    setPrintingId(record.id);
    window.setTimeout(() => window.print(), 50);
  }

  return <section aria-labelledby="characters-title">
    <div className="section-heading"><div><h2 id="characters-title">{translate(locale, "character.title")}</h2>
      <p>{translate(locale, "character.description")}</p></div>
      {!showEditor && !wizard && !levelingUp && <div className="builder-actions">
        <button className="button button-quiet" onClick={() => setWizard({ quick: true })}>{translate(locale, "character.quickButton")}</button>
        <button className="button button-primary" onClick={() => setWizard({})}>{translate(locale, "character.newButton")}</button>
      </div>}
    </div>
    {wizard && <CharacterWizard locale={locale} quick={wizard.quick} onCancel={() => setWizard(null)} onSave={(result) => void saveFromWizard(result)}
      initial={wizard.record?.build ? { name: wizard.record.name, level: wizard.record.level, notes: wizard.record.notes, build: wizard.record.build } : undefined} />}
    {levelingUp?.build && <LevelUp key={levelingUp.id} locale={locale} name={levelingUp.name} level={levelingUp.level} build={levelingUp.build}
      onCancel={() => setLevelingUp(null)} onSave={(result) => void saveLevelUp(levelingUp, result)} />}
    {showEditor && <CharacterEditor key={editing?.id ?? "new"} character={editing} campaigns={campaigns} locale={locale} onSave={save} onCancel={() => { setShowEditor(false); setEditing(undefined); }} />}
    {error && <p className="validation-message mt-2 text-sm font-medium text-red-700" role="alert">{error}</p>}
    {characters.length === 0 && !showEditor && !wizard && !levelingUp ? <div className="empty-state"><span aria-hidden="true">✦</span><h3>{translate(locale, "character.emptyTitle")}</h3><p>{translate(locale, "character.emptyDescription")}</p>
      <button className="button button-primary" onClick={() => setWizard({})}>{translate(locale, "character.createFirst")}</button></div> :
      <div className="character-grid">{characters.map((character) => { const sheet = sheetFor(character); return <article className="character-card" key={character.id} data-print-target={printingId === character.id ? "true" : undefined}>
        <div className="character-card-top"><span className="avatar-mark">{character.name.slice(0, 1).toLocaleUpperCase(locale === "es" ? "es-ES" : "en-US")}</span><span className="level-pill">{translate(locale, "character.levelPill", { level: character.level })}</span></div>
        <h3>{character.name}</h3><p className="character-subtitle">{[character.species, character.className, character.background].filter(Boolean).join(" · ") || translate(locale, "character.adventurer")}</p>
        {campaignName(character.campaignId) && <p className="character-subtitle">⚑ {campaignName(character.campaignId)}</p>}
        <div className="export-only export-sheet-content">
          <section className="sheet-page sheet-page-main">
            <header className="sheet-banner"><span aria-hidden="true">✧</span><p>{translate(locale, "character.sheetEdition")}</p><h2>{character.name}</h2><small>{[character.className, character.species].filter(Boolean).join(" · ") || translate(locale, "character.adventurer")}</small></header>
            <div className="export-details">
              <div><small>{translate(locale, "character.speciesLabel")}</small><b>{character.species || "—"}</b></div>
              <div><small>{translate(locale, "character.classLabel")}</small><b>{character.className || "—"} · {character.level}</b></div>
              <div><small>{translate(locale, "character.backgroundLabel")}</small><b>{character.background || "—"}</b></div>
              <div><small>{translate(locale, "character.proficiencyLabel")}</small><b>+{proficiencyBonus(character.level)}</b></div>
              <div><small>{translate(locale, "character.sheetAlignment")}</small><b>{character.build ? say(alignments[character.build.alignment] ?? alignments[4], locale) : "—"}</b></div>
              <div><small>{translate(locale, "character.sheetPassivePerception")}</small><b>{sheet?.passivePerception ?? "—"}</b></div>
            </div>
            <section className="sheet-section"><h4>{translate(locale, "character.scoresTitle")}</h4><p className="export-legend">{translate(locale, "character.abilityScoreLabel")} · {translate(locale, "character.abilityModifierLabel")}</p>
              <div className="export-abilities">{abilities.map(({ key }) => { const score = character.scores[key]; const modifier = abilityModifier(score); return <div key={key}><span>{translate(locale, `ability.${key}`)}</span><b>{score}</b><small>{modifier >= 0 ? "+" : "−"}{Math.abs(modifier)}</small></div>; })}</div>
            </section>
            <section className="sheet-section"><h4>{translate(locale, "character.sheetCombat")}</h4>
              <div className="export-combat">{([["character.armorClass", sheet?.armorClass], ["character.initiative", sheet ? signed(sheet.initiative) : undefined], ["character.speed", sheet?.speed], ["character.hitPoints", sheet?.hitPoints], ["character.hitDice", sheet?.hitDice]] as const).map(([key, value]) => <div key={key}>{translate(locale, key)}<b>{value ?? ""}</b></div>)}</div>
            </section>
            <section className="sheet-section"><h4>{translate(locale, "character.sheetAttacks")}</h4>
              <div className="sheet-equipment-table sheet-attack-table"><div><b>{translate(locale, "character.sheetItem")}</b><b>{translate(locale, "character.sheetAttackBonus")}</b><b>{translate(locale, "character.sheetDamage")}</b></div>
                {(() => { const attacks = character.build && sheet ? attackList(character.build, sheet) : []; return Array.from({ length: Math.max(4, attacks.length) }, (_, index) => { const attack = attacks[index];
                  return <div key={index}><span>{attack ? say(attack.name, locale) : ""}</span><span>{attack ? signed(attack.bonus) : ""}</span><span>{attack ? `${attack.dice}${attack.modifier ? signed(attack.modifier) : ""} ${say(attack.type, locale)}` : ""}</span></div>; }); })()}</div></section>
            <div className="sheet-columns">
              <section className="sheet-section"><h4>{translate(locale, "character.sheetSavingThrows")}</h4><div className="sheet-line-list">{abilities.map(({ key }) => <div key={key}><span>{translate(locale, `ability.${key}`)}</span><i className={sheet?.saves[key].proficient ? "filled" : undefined} /> <b>{sheet ? signed(sheet.saves[key].bonus) : ""}</b></div>)}</div></section>
              <section className="sheet-section"><h4>{translate(locale, "character.sheetSkills")}</h4><div className="sheet-line-list sheet-skill-list">{skillKeys.map((skill) => <div key={skill}><span>{translate(locale, `skill.${skill}`)}</span><i className={sheet?.skills[skill].expertise ? "filled expert" : sheet?.skills[skill].proficient ? "filled" : undefined} /><b>{sheet ? signed(sheet.skills[skill].bonus) : ""}</b></div>)}</div></section>
            </div>
            <section className="sheet-section"><h4>{translate(locale, "character.notes")}</h4><div className="sheet-note-area">{character.notes}</div></section>
            <footer className="sheet-footer"><span>✧ GRIMOIRE ✧</span><span>{translate(locale, "character.sheetEdition")}</span></footer>
          </section>
          <section className="sheet-page sheet-page-extra">
            <header className="sheet-banner"><span aria-hidden="true">✧</span><p>{translate(locale, "character.sheetEdition")}</p><h2>{translate(locale, "character.sheetAdventurerRecord")}</h2><small>{character.name}</small></header>
            <section className="sheet-section"><h4>{translate(locale, "character.sheetFeatures")}</h4><div className="sheet-writing-area tall">{character.build && <p className="sheet-filled">{[
              ...unlockedFeatures(character.build, character.level).map((feature) => say(feature, locale)),
              ...(sheet?.feats ?? []).map((feat) => say(featInfo(feat).name, locale)),
            ].join(" · ")}{sheet?.spellSaveDc ? ` · ${translate(locale, "character.spellDc")} ${sheet.spellSaveDc}, ${translate(locale, "character.spellAttack")} ${signed(sheet.spellAttack ?? 0)}` : ""}</p>}</div></section>
            <div className="sheet-columns">
              <section className="sheet-section"><h4>{translate(locale, "character.sheetSpeciesTraits")}</h4><div className="sheet-writing-area medium">{character.build && <p className="sheet-filled">{(findSpecies(character.build.speciesId)?.traits ?? []).map((trait) => say(trait, locale)).join(" · ")}{sheet?.darkvision ? ` · ${translate(locale, "character.darkvision")} ${sheet.darkvision}` : ""}</p>}</div></section>
              <section className="sheet-section"><h4>{translate(locale, "character.sheetProficiencies")}</h4><div className="sheet-writing-area medium">{character.build && (() => { const cls = findClass(character.build.classId); return cls ? <p className="sheet-filled">{say(cls.armor, locale)} · {say(cls.weapons, locale)}{cls.tools ? ` · ${say(cls.tools, locale)}` : ""}<br />{translate(locale, "character.sheetLanguages")}: {[locale === "es" ? "Común" : "Common", ...character.build.languages.map((index) => standardLanguages[index] ? say(standardLanguages[index], locale) : "")].filter(Boolean).join(", ")}</p> : null; })()}</div></section>
            </div>
            <section className="sheet-section"><h4>{translate(locale, "character.sheetEquipment")}</h4><div className="sheet-equipment-table"><div><b>{translate(locale, "character.sheetItem")}</b><b>{translate(locale, "character.sheetQuantity")}</b><b>{translate(locale, "character.sheetWeight")}</b><b>{translate(locale, "character.sheetNotes")}</b></div>{(() => { const items = character.build ? startingItems(character.build, locale) : []; return Array.from({ length: Math.max(7, items.length) }, (_, index) => <div key={index}><span>{items[index] ?? ""}</span><span /><span /><span /></div>); })()}</div></section>
            <div className="sheet-columns">
              <section className="sheet-section"><h4>{translate(locale, "character.sheetStory")}</h4><div className="sheet-writing-area short">{character.build?.appearance && <p className="sheet-filled">{character.build.appearance}</p>}</div></section>
              <section className="sheet-section"><h4>{translate(locale, "character.sheetTreasure")}</h4><div className="sheet-writing-area short">{sheet && <p className="sheet-filled">{sheet.gold} {locale === "es" ? "po" : "GP"}</p>}</div></section>
            </div>
            <section className="sheet-section"><h4>{translate(locale, "character.sheetSpells")}</h4><div className="sheet-spell-lines">{Array.from({ length: 4 }, (_, index) => <div key={index}><i /><span /><span /><span /></div>)}</div></section>
            <footer className="sheet-footer"><span>✧ GRIMOIRE ✧</span><span>{translate(locale, "character.sheetEdition")}</span></footer>
          </section>
        </div>
        {sheet && <div className="card-vitals">
          <div><span>{translate(locale, "character.acShort")}</span><b>{sheet.armorClass}</b></div>
          <div><span>{translate(locale, "character.hpShort")}</span><b>{sheet.hitPoints}</b></div>
          <div><span>{translate(locale, "character.initShort")}</span><b>{signed(sheet.initiative)}</b></div>
          <div><span>{translate(locale, "character.speedShort")}</span><b>{sheet.speed}</b></div>
        </div>}
        <div className="mini-stats">{abilities.map(({ key }) => { const modifier = abilityModifier(character.scores[key]); return <div key={key}>
          <span>{translate(locale, `ability.${key}`).slice(0, 3).toLocaleUpperCase(locale === "es" ? "es-ES" : "en-US")}</span><b>{character.scores[key]}</b><small>{modifier >= 0 ? "+" : "−"}{Math.abs(modifier)}</small></div>; })}</div>
        {character.notes && <p className="character-notes">{character.notes}</p>}
        <div className="character-card-footer"><span>{translate(locale, "character.proficiencyShort")} <b>+{proficiencyBonus(character.level)}</b></span><div>
          <button className="small-action export-action" type="button" onClick={() => exportSheet(character)}>{translate(locale, "character.exportPdf")}</button>
          {character.build && character.level < MAX_LEVEL && <button className="small-action" onClick={() => startLevelUp(character)}>{translate(locale, "character.levelUp")}</button>}
          <button className="small-action" onClick={() => startEdit(character)}>{translate(locale, "character.edit")}</button>
          <button className="small-action danger-action" onClick={() => void remove(character)}>{translate(locale, "character.delete")}</button>
        </div></div>
      </article>; })}</div>}
  </section>;
}
