"use client";

import { type Character } from "@/lib/api-client";
import { attackList } from "@/lib/character-sheet";
import { featureList, sheetFor, signed, speciesTraits, startingItems, characterIdentity } from "@/lib/character-view";
import { findClass, say, skillKeys, standardLanguages, type Feature } from "@/lib/dnd2024";
import { translate, type Locale } from "@/lib/i18n";
import { MAX_LEVEL } from "@/lib/levelup";
import { abilities, abilityModifier, proficiencyBonus } from "@/lib/rules";

/* Tailwind class lists for the repeated pieces of the sheet. */
const panel = "panel min-w-0 px-4 pt-3.5 pb-4";
const panelTitle = "m-0 mb-2.5 font-display text-[16px] font-semibold text-accent";
const statBox = "grid justify-items-center rounded-control border border-line bg-paper px-1.5 py-2.5 text-center";
const statLabel = "font-label text-xs font-semibold tracking-[.06em] text-muted";
const statValue = "font-display text-2xl font-bold text-ink";
const lineList = "m-0 grid list-none p-0";
const lineItem = "grid grid-cols-[14px_1fr_auto] items-center gap-2 border-b border-dotted border-line py-1.5 text-[15px] text-ink last:border-b-0";
const prose = "m-0 text-[15px] leading-[1.55] whitespace-pre-wrap [overflow-wrap:anywhere] text-ink";
const chip = "rounded-control border border-control-line px-2.5 py-0.5 font-label text-xs font-semibold tracking-[.05em] text-muted";
/** Proficiency marker: empty, proficient (filled) or expertise (gilt, ringed). */
const dot = (state: "none" | "on" | "expert") => `size-2.5 rounded-full border ${state === "expert" ? "border-gilt-text bg-gilt shadow-[0_0_0_2px_var(--surface),0_0_0_3px_var(--gilt-text)]" : state === "on" ? "border-accent bg-accent" : "border-control-line"}`;

type Props = {
  character: Character;
  campaignName?: string;
  locale: Locale;
  onBack: () => void;
  /** Only passed when the printable sheet exists, which is the case for the viewer's own characters. */
  onExport?: () => void;
  /** Only passed when the viewer may change the character. */
  onEdit?: () => void;
  onLevelUp?: () => void;
};

function FeatureList({ items, locale }: { items: Feature[]; locale: Locale }) {
  return <dl className="m-0 grid">{items.map((item, index) => <div key={`${item.name.en}-${index}`} className="border-b border-dotted border-line py-2 first:pt-0 last:border-b-0 last:pb-0">
    <dt className="font-display text-[15px] font-semibold text-ink">{say(item.name, locale)}</dt>{say(item.tip, locale) && <dd className="m-0 mt-0.5 text-[14px] leading-normal text-muted">{say(item.tip, locale)}</dd>}
  </div>)}</dl>;
}

/** Everything the app knows about a character, readable on screen (the PDF sheet is separate). */
export default function CharacterSheetView({ character, campaignName, locale, onBack, onExport, onEdit, onLevelUp }: Props) {
  const t = (key: string, values?: Record<string, string | number>) => translate(locale, key, values);
  const sheet = sheetFor(character);
  const build = character.build;
  const bonus = sheet?.proficiency ?? proficiencyBonus(character.level);
  const cls = build ? findClass(build.classId) : undefined;
  const features = build ? featureList(build, character.level) : [];
  const traits = build ? speciesTraits(build) : [];
  const gear = build ? startingItems(build, locale) : [];
  const attacks = build && sheet ? attackList(build, sheet) : [];
  const languages = build ? [t("character.common"), ...build.languages.map((index) => standardLanguages[index]).filter(Boolean).map((language) => say(language, locale))] : [];
  const identity = characterIdentity(character, locale);
  const subtitle = [identity.species, identity.className, identity.background].filter(Boolean).join(" · ") || t("character.adventurer");
  const initial = character.name.slice(0, 1).toLocaleUpperCase(locale === "es" ? "es-ES" : "en-US");

  return <article className="grid gap-4.5 print:hidden!" aria-labelledby="sheet-title">
    <div className="flex flex-wrap items-center justify-between gap-2.5">
      <button type="button" className="button button-quiet" onClick={onBack}>‹ {t("character.backToList")}</button>
      <div className="flex flex-wrap gap-2">
        {onExport && <button type="button" className="button button-quiet" onClick={onExport} title={t("character.printHint")}>{t("character.exportPdf")}</button>}
        {onLevelUp && build && character.level < MAX_LEVEL && <button type="button" className="button button-quiet" onClick={onLevelUp}>{t("character.levelUp")}</button>}
        {onEdit && <button type="button" className="button button-primary" onClick={onEdit}>{t("character.edit")}</button>}
      </div>
    </div>

    <header className="panel grid grid-cols-[auto_1fr] items-center gap-4 px-5 py-4.5 max-[650px]:grid-cols-1 max-[650px]:justify-items-start">
      <span className="grid size-16 place-items-center rounded-full bg-sunken font-display text-3xl font-medium text-accent max-[650px]:size-13 max-[650px]:text-2xl" aria-hidden="true">{initial}</span>
      <div>
        <h2 id="sheet-title" className="m-0 font-display text-[clamp(26px,4vw,36px)] leading-[1.1] font-medium [overflow-wrap:anywhere] text-ink">{character.name}</h2>
        <p className="mt-1 mb-0 text-[15px] text-muted">{subtitle}</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <span className={chip}>{t("character.levelPill", { level: character.level })}</span>
          {campaignName && <span className={chip}>⚑ {campaignName}</span>}
          {!character.editable && <span className={chip}>{t("character.ownedBy", { name: character.ownerName })}</span>}
        </div>
      </div>
    </header>

    {!sheet && <p className="m-0 rounded-card border border-dashed border-control-line px-3.5 py-3 text-[14px] text-muted" role="note">{t("character.quickNote")}</p>}

    <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] items-start gap-4.5 max-[900px]:grid-cols-1">
      <div className="grid min-w-0 gap-4.5">
        <section className={panel} aria-labelledby="sheet-abilities">
          <h3 id="sheet-abilities" className={panelTitle}>{t("character.scoresTitle")}</h3>
          <div className="grid grid-cols-3 gap-2">{abilities.map(({ key }) => {
            const score = sheet?.scores[key] ?? character.scores[key];
            const modifier = abilityModifier(score);
            const name = t(`ability.${key}`);
            // Full names ("Constitución") overflow the narrow cells, so show the three-letter short form.
            return <div className={statBox} key={key}><span className={statLabel}><abbr className="no-underline" title={name} aria-hidden="true">{name.slice(0, 3).toLocaleUpperCase(locale === "es" ? "es-ES" : "en-US")}</abbr><span className="sr-only">{name}</span></span><b className={statValue}>{score}</b><small className="font-body text-[14px] font-semibold text-accent">{signed(modifier)}</small></div>;
          })}</div>
        </section>

        {sheet && <section className={panel} aria-labelledby="sheet-saves">
          <h3 id="sheet-saves" className={panelTitle}>{t("character.sheetSavingThrows")}</h3>
          <ul className={lineList}>{abilities.map(({ key }) => <li key={key} className={lineItem}>
            <i className={dot(sheet.saves[key].proficient ? "on" : "none")} aria-hidden="true" />
            <span>{t(`ability.${key}`)}{sheet.saves[key].proficient && <span className="sr-only"> ({t("character.legendProficient")})</span>}</span>
            <b className="font-display text-[15px] font-bold">{signed(sheet.saves[key].bonus)}</b></li>)}</ul>
        </section>}

        {sheet && <section className={panel} aria-labelledby="sheet-skills">
          <h3 id="sheet-skills" className={panelTitle}>{t("character.sheetSkills")}</h3>
          <ul className={lineList}>{skillKeys.map((skill) => {
            const entry = sheet.skills[skill];
            return <li key={skill} className={lineItem}>
              <i className={dot(entry.expertise ? "expert" : entry.proficient ? "on" : "none")} aria-hidden="true" />
              <span>{t(`skill.${skill}`)}{entry.expertise ? <span className="sr-only"> ({t("character.legendExpertise")})</span> : entry.proficient ? <span className="sr-only"> ({t("character.legendProficient")})</span> : null}</span>
              <b className="font-display text-[15px] font-bold">{signed(entry.bonus)}</b></li>;
          })}</ul>
          <p className="mt-2 mb-0 flex flex-wrap gap-x-3.5 gap-y-1 text-xs text-muted">
            <span className="inline-flex items-center gap-1.5"><i className={dot("on")} aria-hidden="true" />{t("character.legendProficient")}</span>
            <span className="inline-flex items-center gap-1.5"><i className={dot("expert")} aria-hidden="true" />{t("character.legendExpertise")}</span>
          </p>
        </section>}
      </div>

      <div className="grid min-w-0 gap-4.5">
        <section className={panel} aria-labelledby="sheet-combat">
          <h3 id="sheet-combat" className={panelTitle}>{t("character.combatTitle")}</h3>
          {sheet ? <div className="grid grid-cols-[repeat(auto-fit,minmax(96px,1fr))] gap-2">
            <div className={`${statBox} gap-0.5`}><span className={`${statLabel} uppercase`}>{t("character.armorClass")}</span><b className={statValue}>{sheet.armorClass}</b>{sheet.armorSource && <small className="text-xs text-muted">{say(sheet.armorSource, locale)}</small>}</div>
            <div className={`${statBox} gap-0.5`}><span className={`${statLabel} uppercase`}>{t("character.hitPoints")}</span><b className={statValue}>{sheet.hitPoints}</b><small className="text-xs text-muted">{sheet.hitDice}</small></div>
            <div className={`${statBox} gap-0.5`}><span className={`${statLabel} uppercase`}>{t("character.initiative")}</span><b className={statValue}>{signed(sheet.initiative)}</b></div>
            <div className={`${statBox} gap-0.5`}><span className={`${statLabel} uppercase`}>{t("character.speed")}</span><b className={statValue}>{sheet.speed}</b></div>
            <div className={`${statBox} gap-0.5`}><span className={`${statLabel} uppercase`}>{t("character.proficiencyLabel")}</span><b className={statValue}>{signed(sheet.proficiency)}</b></div>
            <div className={`${statBox} gap-0.5`}><span className={`${statLabel} uppercase`}>{t("character.passivePerception")}</span><b className={statValue}>{sheet.passivePerception}</b></div>
            {sheet.darkvision ? <div className={`${statBox} gap-0.5`}><span className={`${statLabel} uppercase`}>{t("character.darkvision")}</span><b className={statValue}>{sheet.darkvision}</b></div> : null}
            {sheet.spellSaveDc ? <div className={`${statBox} gap-0.5`}><span className={`${statLabel} uppercase`}>{t("character.spellDc")}</span><b className={statValue}>{sheet.spellSaveDc}</b></div> : null}
            {sheet.spellAttack !== undefined && sheet.spellSaveDc ? <div className={`${statBox} gap-0.5`}><span className={`${statLabel} uppercase`}>{t("character.spellAttack")}</span><b className={statValue}>{signed(sheet.spellAttack)}</b></div> : null}
          </div> : <div className="grid grid-cols-[repeat(auto-fit,minmax(96px,1fr))] gap-2">
            <div className={`${statBox} gap-0.5`}><span className={`${statLabel} uppercase`}>{t("character.proficiencyLabel")}</span><b className={statValue}>{signed(bonus)}</b></div>
          </div>}
        </section>

        {attacks.length > 0 && <section className={panel} aria-labelledby="sheet-attacks">
          <h3 id="sheet-attacks" className={panelTitle}>{t("character.sheetAttacks")}</h3>
          <ul className={lineList}>{attacks.map((attack, index) => <li key={`${attack.dice}-${index}`} className="grid grid-cols-[minmax(0,1.2fr)_auto_minmax(0,1.4fr)] items-baseline gap-x-3 gap-y-1 border-b border-dotted border-line py-1.75 text-[15px] text-ink last:border-b-0 max-[650px]:grid-cols-[1fr_auto]">
            <span>{say(attack.name, locale)}</span>
            <b className="font-display text-[15px] font-bold" title={t("character.sheetAttackBonus")}>{signed(attack.bonus)}</b>
            <span className="text-muted max-[650px]:col-span-full">{`${attack.dice}${attack.modifier ? signed(attack.modifier) : ""} ${say(attack.type, locale)}`}</span></li>)}</ul>
        </section>}

        {features.length > 0 && <section className={panel} aria-labelledby="sheet-features">
          <h3 id="sheet-features" className={panelTitle}>{t("character.sheetFeatures")}</h3>
          <FeatureList items={features} locale={locale} />
        </section>}

        {traits.length > 0 && <section className={panel} aria-labelledby="sheet-traits">
          <h3 id="sheet-traits" className={panelTitle}>{t("character.sheetSpeciesTraits")}</h3>
          <FeatureList items={traits} locale={locale} />
          {sheet?.speciesSpells && <p className={prose}><b>{t("character.speciesSpells")}:</b> {t("character.spellDc")} {sheet.speciesSpells.saveDc} · {t("character.spellAttack")} {signed(sheet.speciesSpells.attack)}</p>}
        </section>}

        {cls && <section className={panel} aria-labelledby="sheet-proficiencies">
          <h3 id="sheet-proficiencies" className={panelTitle}>{t("character.sheetProficiencies")}</h3>
          <p className={prose}>{[say(cls.armor, locale), say(cls.weapons, locale), cls.tools ? say(cls.tools, locale) : ""].filter(Boolean).join(" · ")}</p>
          {languages.length > 0 && <p className={`${prose} mt-2`}><b>{t("character.languagesLabel")}:</b> {languages.join(", ")}</p>}
        </section>}

        {(gear.length > 0 || sheet) && <section className={panel} aria-labelledby="sheet-gear">
          <h3 id="sheet-gear" className={panelTitle}>{t("character.sheetEquipment")}</h3>
          {gear.length > 0 && <ul className="m-0 grid gap-0.75 pl-4.5 text-[15px] text-ink">{gear.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}</ul>}
          {sheet && <p className={`${prose}${gear.length ? " mt-2.5" : ""}`}><b>{t("character.sheetTreasure")}:</b> {sheet.gold} {locale === "es" ? "po" : "GP"}</p>}
        </section>}

        {build?.appearance && <section className={panel} aria-labelledby="sheet-story">
          <h3 id="sheet-story" className={panelTitle}>{t("character.sheetStory")}</h3>
          <p className={prose}>{build.appearance}</p>
        </section>}

        <section className={panel} aria-labelledby="sheet-notes">
          <h3 id="sheet-notes" className={panelTitle}>{t("character.notes")}</h3>
          {character.notes ? <p className={prose}>{character.notes}</p> : <p className={`${prose} text-muted`}>{t("character.noData")}</p>}
        </section>
      </div>
    </div>
  </article>;
}
