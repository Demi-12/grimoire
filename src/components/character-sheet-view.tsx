"use client";

import { type Character } from "@/lib/api-client";
import { attackList } from "@/lib/character-sheet";
import { featureList, sheetFor, signed, speciesTraits, startingItems } from "@/lib/character-view";
import { findClass, say, skillKeys, standardLanguages, type Feature } from "@/lib/dnd2024";
import { translate, type Locale } from "@/lib/i18n";
import { MAX_LEVEL } from "@/lib/levelup";
import { abilities, abilityModifier, proficiencyBonus } from "@/lib/rules";
import styles from "./character-sheet-view.module.css";

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
  return <dl className={styles.features}>{items.map((item, index) => <div key={`${item.name.en}-${index}`}>
    <dt>{say(item.name, locale)}</dt>{say(item.tip, locale) && <dd>{say(item.tip, locale)}</dd>}
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
  const subtitle = [character.species, character.className, character.background].filter(Boolean).join(" · ") || t("character.adventurer");
  const initial = character.name.slice(0, 1).toLocaleUpperCase(locale === "es" ? "es-ES" : "en-US");

  return <article className={styles.sheet} aria-labelledby="sheet-title">
    <div className={styles.top}>
      <button type="button" className="button button-quiet" onClick={onBack}>‹ {t("character.backToList")}</button>
      <div className={styles.actions}>
        {onExport && <button type="button" className="button button-quiet" onClick={onExport} title={t("character.printHint")}>{t("character.exportPdf")}</button>}
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
            const name = t(`ability.${key}`);
            // Full names ("Constitución") overflow the narrow cells, so show the three-letter short form.
            return <div className={styles.ability} key={key}><span><abbr title={name} aria-hidden="true">{name.slice(0, 3).toLocaleUpperCase(locale === "es" ? "es-ES" : "en-US")}</abbr><span className="sr-only">{name}</span></span><b>{score}</b><small>{signed(modifier)}</small></div>;
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
            <div className={styles.vital}><span>{t("character.armorClass")}</span><b>{sheet.armorClass}</b>{sheet.armorSource && <small>{say(sheet.armorSource, locale)}</small>}</div>
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

        {attacks.length > 0 && <section className={styles.panel} aria-labelledby="sheet-attacks">
          <h3 id="sheet-attacks">{t("character.sheetAttacks")}</h3>
          <ul className={styles.attacks}>{attacks.map((attack, index) => <li key={`${attack.dice}-${index}`}>
            <span>{say(attack.name, locale)}</span>
            <b title={t("character.sheetAttackBonus")}>{signed(attack.bonus)}</b>
            <span className={styles.muted}>{`${attack.dice}${attack.modifier ? signed(attack.modifier) : ""} ${say(attack.type, locale)}`}</span></li>)}</ul>
        </section>}

        {features.length > 0 && <section className={styles.panel} aria-labelledby="sheet-features">
          <h3 id="sheet-features">{t("character.sheetFeatures")}</h3>
          <FeatureList items={features} locale={locale} />
        </section>}

        {traits.length > 0 && <section className={styles.panel} aria-labelledby="sheet-traits">
          <h3 id="sheet-traits">{t("character.sheetSpeciesTraits")}</h3>
          <FeatureList items={traits} locale={locale} />
          {sheet?.speciesSpells && <p className={styles.text}><b>{t("character.speciesSpells")}:</b> {t("character.spellDc")} {sheet.speciesSpells.saveDc} · {t("character.spellAttack")} {signed(sheet.speciesSpells.attack)}</p>}
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
