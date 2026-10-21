"use client";

import { type Character } from "@/lib/api-client";
import { sheetFor, signed, startingItems } from "@/lib/character-view";
import { findClass, findSpecies, say, skillKeys, standardLanguages } from "@/lib/dnd2024";
import { translate, type Locale } from "@/lib/i18n";
import { MAX_LEVEL, unlockedFeatures } from "@/lib/levelup";
import { featInfo } from "@/lib/levelup-data";
import { abilities, abilityModifier, proficiencyBonus } from "@/lib/rules";
import styles from "./character-sheet-view.module.css";

type Props = {
  character: Character;
  campaignName?: string;
  locale: Locale;
  onBack: () => void;
  onExport: () => void;
  /** Only passed when the viewer may change the character. */
  onEdit?: () => void;
  onLevelUp?: () => void;
};

/** Everything the app knows about a character, readable on screen (the PDF sheet is separate). */
export default function CharacterSheetView({ character, campaignName, locale, onBack, onExport, onEdit, onLevelUp }: Props) {
  const t = (key: string, values?: Record<string, string | number>) => translate(locale, key, values);
  const sheet = sheetFor(character);
  const build = character.build;
  const bonus = sheet?.proficiency ?? proficiencyBonus(character.level);
  const species = build ? findSpecies(build.speciesId) : undefined;
  const cls = build ? findClass(build.classId) : undefined;
  const features = build ? unlockedFeatures(build, character.level).map((feature) => say(feature, locale)) : [];
  const feats = (sheet?.feats ?? []).map((feat) => say(featInfo(feat).name, locale));
  const traits = species?.traits.map((trait) => say(trait, locale)) ?? [];
  const gear = build ? startingItems(build, locale) : [];
  const languages = build ? [t("character.common"), ...build.languages.map((index) => standardLanguages[index]).filter(Boolean).map((language) => say(language, locale))] : [];
  const subtitle = [character.species, character.className, character.background].filter(Boolean).join(" · ") || t("character.adventurer");
  const initial = character.name.slice(0, 1).toLocaleUpperCase(locale === "es" ? "es-ES" : "en-US");

  return <article className={styles.sheet} aria-labelledby="sheet-title">
    <div className={styles.top}>
      <button type="button" className="button button-quiet" onClick={onBack}>‹ {t("character.backToList")}</button>
      <div className={styles.actions}>
        <button type="button" className="button button-quiet" onClick={onExport} title={t("character.printHint")}>{t("character.exportPdf")}</button>
        {onLevelUp && build && character.level < MAX_LEVEL && <button type="button" className="button button-quiet" onClick={onLevelUp}>{t("character.levelUp")}</button>}
        {onEdit && <button type="button" className="button button-primary" onClick={onEdit}>{t("character.edit")}</button>}
      </div>
    </div>

    <header className={styles.banner}>
      <span className={styles.avatar} aria-hidden="true">{initial}</span>
      <div>
        <h2 id="sheet-title">{character.name}</h2>
        <p className={styles.sub}>{subtitle}</p>
        <div className={styles.chips}>
          <span className={styles.chip}>{t("character.levelPill", { level: character.level })}</span>
          {campaignName && <span className={styles.chip}>⚑ {campaignName}</span>}
          {!character.editable && <span className={styles.chip}>{t("character.ownedBy", { name: character.ownerName })}</span>}
        </div>
      </div>
    </header>

    {!sheet && <p className={styles.note} role="note">{t("character.quickNote")}</p>}

    <div className={styles.grid}>
      <div className={styles.col}>
        <section className={styles.panel} aria-labelledby="sheet-abilities">
          <h3 id="sheet-abilities">{t("character.scoresTitle")}</h3>
          <div className={styles.abilities}>{abilities.map(({ key }) => {
            const score = sheet?.scores[key] ?? character.scores[key];
            const modifier = abilityModifier(score);
            return <div className={styles.ability} key={key}><span>{t(`ability.${key}`)}</span><b>{score}</b><small>{signed(modifier)}</small></div>;
          })}</div>
        </section>

        {sheet && <section className={styles.panel} aria-labelledby="sheet-saves">
          <h3 id="sheet-saves">{t("character.sheetSavingThrows")}</h3>
          <ul className={styles.lines}>{abilities.map(({ key }) => <li key={key}>
            <i className={`${styles.dot} ${sheet.saves[key].proficient ? styles.dotOn : ""}`} aria-hidden="true" />
            <span>{t(`ability.${key}`)}{sheet.saves[key].proficient && <span className="sr-only"> ({t("character.legendProficient")})</span>}</span>
            <b>{signed(sheet.saves[key].bonus)}</b></li>)}</ul>
        </section>}

        {sheet && <section className={styles.panel} aria-labelledby="sheet-skills">
          <h3 id="sheet-skills">{t("character.sheetSkills")}</h3>
          <ul className={styles.lines}>{skillKeys.map((skill) => {
            const entry = sheet.skills[skill];
            return <li key={skill}>
              <i className={`${styles.dot} ${entry.expertise ? styles.dotExpert : entry.proficient ? styles.dotOn : ""}`} aria-hidden="true" />
              <span>{t(`skill.${skill}`)}{entry.expertise ? <span className="sr-only"> ({t("character.legendExpertise")})</span> : entry.proficient ? <span className="sr-only"> ({t("character.legendProficient")})</span> : null}</span>
              <b>{signed(entry.bonus)}</b></li>;
          })}</ul>
          <p className={styles.legend}>
            <span><i className={`${styles.dot} ${styles.dotOn}`} aria-hidden="true" />{t("character.legendProficient")}</span>
            <span><i className={`${styles.dot} ${styles.dotExpert}`} aria-hidden="true" />{t("character.legendExpertise")}</span>
          </p>
        </section>}
      </div>

      <div className={styles.col}>
        <section className={styles.panel} aria-labelledby="sheet-combat">
          <h3 id="sheet-combat">{t("character.combatTitle")}</h3>
          {sheet ? <div className={styles.vitals}>
            <div className={styles.vital}><span>{t("character.armorClass")}</span><b>{sheet.armorClass}</b>{sheet.armorNote && <small>{sheet.armorNote}</small>}</div>
            <div className={styles.vital}><span>{t("character.hitPoints")}</span><b>{sheet.hitPoints}</b><small>{sheet.hitDice}</small></div>
            <div className={styles.vital}><span>{t("character.initiative")}</span><b>{signed(sheet.initiative)}</b></div>
            <div className={styles.vital}><span>{t("character.speed")}</span><b>{sheet.speed}</b></div>
            <div className={styles.vital}><span>{t("character.proficiencyLabel")}</span><b>{signed(sheet.proficiency)}</b></div>
            <div className={styles.vital}><span>{t("character.passivePerception")}</span><b>{sheet.passivePerception}</b></div>
            {sheet.darkvision ? <div className={styles.vital}><span>{t("character.darkvision")}</span><b>{sheet.darkvision}</b></div> : null}
            {sheet.spellSaveDc ? <div className={styles.vital}><span>{t("character.spellDc")}</span><b>{sheet.spellSaveDc}</b></div> : null}
            {sheet.spellAttack !== undefined && sheet.spellSaveDc ? <div className={styles.vital}><span>{t("character.spellAttack")}</span><b>{signed(sheet.spellAttack)}</b></div> : null}
          </div> : <div className={styles.vitals}>
            <div className={styles.vital}><span>{t("character.proficiencyLabel")}</span><b>{signed(bonus)}</b></div>
          </div>}
        </section>

        {(features.length > 0 || feats.length > 0) && <section className={styles.panel} aria-labelledby="sheet-features">
          <h3 id="sheet-features">{t("character.sheetFeatures")}</h3>
          <ul className={styles.tags}>{[...features, ...feats].map((name, index) => <li key={`${name}-${index}`}>{name}</li>)}</ul>
        </section>}

        {traits.length > 0 && <section className={styles.panel} aria-labelledby="sheet-traits">
          <h3 id="sheet-traits">{t("character.sheetSpeciesTraits")}</h3>
          <ul className={styles.tags}>{traits.map((name, index) => <li key={`${name}-${index}`}>{name}</li>)}</ul>
        </section>}

        {cls && <section className={styles.panel} aria-labelledby="sheet-proficiencies">
          <h3 id="sheet-proficiencies">{t("character.sheetProficiencies")}</h3>
          <p className={styles.text}>{[say(cls.armor, locale), say(cls.weapons, locale), cls.tools ? say(cls.tools, locale) : ""].filter(Boolean).join(" · ")}</p>
          {languages.length > 0 && <p className={styles.text} style={{ marginTop: 8 }}><b>{t("character.languagesLabel")}:</b> {languages.join(", ")}</p>}
        </section>}

        {(gear.length > 0 || sheet) && <section className={styles.panel} aria-labelledby="sheet-gear">
          <h3 id="sheet-gear">{t("character.sheetEquipment")}</h3>
          {gear.length > 0 && <ul className={styles.items}>{gear.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}</ul>}
          {sheet && <p className={styles.text} style={gear.length ? { marginTop: 10 } : undefined}><b>{t("character.sheetTreasure")}:</b> {sheet.gold} {locale === "es" ? "po" : "GP"}</p>}
        </section>}

        {build?.appearance && <section className={styles.panel} aria-labelledby="sheet-story">
          <h3 id="sheet-story">{t("character.sheetStory")}</h3>
          <p className={styles.text}>{build.appearance}</p>
        </section>}

        <section className={styles.panel} aria-labelledby="sheet-notes">
          <h3 id="sheet-notes">{t("character.notes")}</h3>
          {character.notes ? <p className={styles.text}>{character.notes}</p> : <p className={`${styles.text} ${styles.muted}`}>{t("character.noData")}</p>}
        </section>
      </div>
    </div>
  </article>;
}
