"use client";

import { useMemo, useState, type ReactNode } from "react";
import { abilities, abilityModifier, type AbilityKey, type AbilityScores } from "@/lib/rules";
import { translate, type Locale } from "@/lib/i18n";
import {
  alignments, backgrounds, classes, findBackground, findClass, findSpecies, magicInitiateLists, originFeats,
  POINT_BUY_BUDGET, pointBuyCost, say, skillKeys, skills, species, STANDARD_ARRAY, standardLanguages,
  type BackgroundId, type ClassId, type FeatId, type MagicInitiateList, type SkillKey, type SpeciesId,
} from "@/lib/dnd2024";
import {
  backgroundBonuses, characterFeats, deriveSheet, finalScores, pointBuySpent, roll4d6DropLowest, stepIssues,
  validBaseScores, type AbilityMethod, type CharacterBuild,
} from "@/lib/character-sheet";
import { featInfo } from "@/lib/levelup-data";
import { subclassLabel, unlockedFeatures } from "@/lib/levelup";
import { findBookSubclass, subclassesFor } from "@/lib/subclasses";
import styles from "./character-wizard.module.css";

export interface WizardResult {
  name: string;
  level: number;
  notes: string;
  build: CharacterBuild;
}

type Props = {
  locale: Locale;
  initial?: { name: string; level: number; notes: string; build: CharacterBuild };
  /** Quick sheet: every step on one page, picking with selects; saves the same build as the guided creator. */
  quick?: boolean;
  onSave: (result: WizardResult) => void;
  onCancel: () => void;
};

const copy = {
  en: {
    kicker: "Character creation, 2024 rules", create: "Forge a new adventurer", edit: "Revise your adventurer",
    steps: ["Class", "Background", "Species", "Abilities", "Proficiencies", "Equipment", "Details", "Summary"],
    back: "Back", next: "Continue", save: "Save character", cancel: "Cancel", close: "Close creator", quickCreate: "Quick sheet",
    stepOf: (current: number, total: number) => `Step ${current} of ${total}`,
    classIntro: "Your class is the heart of your adventurer: it sets your Hit Points, proficiencies and core features.",
    level: "Starting level", hitDie: "Hit Die", primary: "Primary ability", saves: "Saving throws", armor: "Armor training",
    weapons: "Weapons", tools: "Tools", features: "Level 1 features", skillsPick: (n: number) => `Choose ${n} skills`,
    anySkill: "any skill", subclass: "Subclass (level 3)", noSubclass: "None / another (write it in the notes)", srdTag: "SRD", bookTag: "Player's Handbook",
    subclassNote: "Only the SRD subclass has its abilities on the sheet; for the others, use your book.",
    spellcasting: "Spellcasting", cantrips: "Cantrips", prepared: "Prepared spells", masteries: (n: number) => `Weapon Mastery with ${n} kinds of weapons`,
    backgroundIntro: "Your background tells where you came from. In the 2024 rules it grants the ability score increases, an Origin feat, two skills and a tool.",
    abilitiesLabel: "Ability increases", feat: "Origin feat", skills: "Skill proficiencies", tool: "Tool proficiency",
    speciesIntro: "Your species grants traits such as size, speed and senses. It no longer changes your ability scores.",
    size: "Size", speed: "Speed", darkvision: "Darkvision", traits: "Traits", ft: "ft.",
    chooseSkill: (n: number) => n === 1 ? "Choose 1 skill" : `Choose ${n} skills`, chooseFeat: "Versatile: choose an Origin feat",
    spellList: "Spell list", abilitiesIntro: "Generate your six scores, then apply your background's increases (maximum 20).",
    methods: { standard: "Standard array", pointBuy: "Point buy", rolled: "Roll 4d6" } as Record<AbilityMethod, string>,
    methodHelp: { standard: "Assign 15, 14, 13, 12, 10 and 8.", pointBuy: `Spend up to ${POINT_BUY_BUDGET} points; scores from 8 to 15.`, rolled: "Roll 4d6 six times, dropping the lowest die each time." } as Record<AbilityMethod, string>,
    suggest: "Suggest for my class", roll: "Roll the dice", reroll: "Roll again", points: (spent: number) => `${spent} / ${POINT_BUY_BUDGET} points`,
    bonusMode: "Background increase", plus2plus1: "+2 and +1", plus1x3: "+1 to all three", plusTwo: "+2 to", plusOne: "+1 to",
    base: "Base", bonus: "Bonus", final: "Final", mod: "Mod",
    profIntro: "Pick the skills your class trains. Skills you already have from your background or species are marked.",
    already: "already proficient", skilled: "Skilled feat: choose 3 skills", expertise: (n: number) => `Expertise: choose ${n} proficient skills`,
    equipmentIntro: "Take the starting kit or the gold to buy your own gear.", classKit: "Class equipment", backgroundKit: "Background equipment",
    option: (id: string) => `Option ${id}`, totalGold: "Starting gold",
    detailsIntro: "Name your character and decide who they are.", name: "Name", namePlaceholder: "Iria Valen", alignment: "Alignment",
    languages: "Languages", languagesHelp: "You know Common and two more standard languages.", appearance: "Appearance and personality", notes: "Notes",
    summaryIntro: "Review the sheet. Everything here is calculated from your choices.",
    ac: "Armor Class", hp: "Hit Points", initiative: "Initiative", proficiency: "Proficiency", passive: "Passive Perception", spellDc: "Spell save DC", spellAtk: "Spell attack",
    issues: {
      lineage: "Choose a lineage or ancestry.", speciesSkills: "Choose the species skill.", speciesFeat: "Choose the Origin feat.",
      scores: "Assign valid scores for the chosen method.", bonuses: "Apply the background increases.", classSkills: "Choose all class skills.",
      featSkills: "Choose 3 skills for Skilled.", expertise: "Choose your Expertise skills.", languages: "Choose two languages.", name: "Give your character a name.",
    } as Record<string, string>,
    srd: "Rules data from the 2024 Player's Handbook and the System Reference Document 5.2 (CC-BY-4.0).",
  },
  es: {
    kicker: "Creación de personaje, reglas 2024", create: "Forja un nuevo aventurero", edit: "Revisa tu aventurero",
    steps: ["Clase", "Trasfondo", "Especie", "Características", "Competencias", "Equipo", "Detalles", "Resumen"],
    back: "Atrás", next: "Continuar", save: "Guardar personaje", cancel: "Cancelar", close: "Cerrar creador", quickCreate: "Edición rápida",
    stepOf: (current: number, total: number) => `Paso ${current} de ${total}`,
    classIntro: "La clase es el corazón de tu aventurero: define sus puntos de golpe, competencias y rasgos principales.",
    level: "Nivel inicial", hitDie: "Dado de golpe", primary: "Característica principal", saves: "Tiradas de salvación", armor: "Entrenamiento con armaduras",
    weapons: "Armas", tools: "Herramientas", features: "Rasgos de nivel 1", skillsPick: (n: number) => `Elige ${n} habilidades`,
    anySkill: "cualquier habilidad", subclass: "Subclase (nivel 3)", noSubclass: "Ninguna / otra (anótala en las notas)", srdTag: "SRD", bookTag: "Manual del Jugador",
    subclassNote: "Solo la subclase del SRD tiene sus rasgos en la ficha; para las demás, usa tu libro.",
    spellcasting: "Lanzamiento de conjuros", cantrips: "Trucos", prepared: "Conjuros preparados", masteries: (n: number) => `Maestría con ${n} tipos de armas`,
    backgroundIntro: "El trasfondo cuenta de dónde vienes. En las reglas de 2024 otorga los aumentos de característica, una dote de origen, dos habilidades y una herramienta.",
    abilitiesLabel: "Aumentos de característica", feat: "Dote de origen", skills: "Competencias en habilidades", tool: "Competencia con herramienta",
    speciesIntro: "La especie otorga rasgos como tamaño, velocidad y sentidos. Ya no modifica tus características.",
    size: "Tamaño", speed: "Velocidad", darkvision: "Visión en la oscuridad", traits: "Rasgos", ft: "pies",
    chooseSkill: (n: number) => n === 1 ? "Elige 1 habilidad" : `Elige ${n} habilidades`, chooseFeat: "Versátil: elige una dote de origen",
    spellList: "Lista de conjuros", abilitiesIntro: "Genera tus seis puntuaciones y aplica los aumentos del trasfondo (máximo 20).",
    methods: { standard: "Matriz estándar", pointBuy: "Compra por puntos", rolled: "Tirar 4d6" } as Record<AbilityMethod, string>,
    methodHelp: { standard: "Asigna 15, 14, 13, 12, 10 y 8.", pointBuy: `Gasta hasta ${POINT_BUY_BUDGET} puntos; puntuaciones de 8 a 15.`, rolled: "Tira 4d6 seis veces y descarta el dado más bajo cada vez." } as Record<AbilityMethod, string>,
    suggest: "Sugerir para mi clase", roll: "Tirar los dados", reroll: "Volver a tirar", points: (spent: number) => `${spent} / ${POINT_BUY_BUDGET} puntos`,
    bonusMode: "Aumento del trasfondo", plus2plus1: "+2 y +1", plus1x3: "+1 a las tres", plusTwo: "+2 a", plusOne: "+1 a",
    base: "Base", bonus: "Bono", final: "Final", mod: "Mod",
    profIntro: "Elige las habilidades que entrena tu clase. Las que ya tienes por trasfondo o especie aparecen marcadas.",
    already: "ya competente", skilled: "Dote Habilidoso: elige 3 habilidades", expertise: (n: number) => `Pericia: elige ${n} habilidades en las que seas competente`,
    equipmentIntro: "Quédate con el equipo inicial o con el oro para comprar el tuyo.", classKit: "Equipo de clase", backgroundKit: "Equipo de trasfondo",
    option: (id: string) => `Opción ${id}`, totalGold: "Oro inicial",
    detailsIntro: "Dale nombre a tu personaje y decide quién es.", name: "Nombre", namePlaceholder: "Iria Valen", alignment: "Alineamiento",
    languages: "Idiomas", languagesHelp: "Conoces el común y dos idiomas estándar más.", appearance: "Apariencia y personalidad", notes: "Notas",
    summaryIntro: "Revisa la ficha. Todo se calcula a partir de tus elecciones.",
    ac: "Clase de armadura", hp: "Puntos de golpe", initiative: "Iniciativa", proficiency: "Competencia", passive: "Percepción pasiva", spellDc: "CD de conjuros", spellAtk: "Ataque de conjuro",
    issues: {
      lineage: "Elige un linaje o ascendencia.", speciesSkills: "Elige la habilidad de la especie.", speciesFeat: "Elige la dote de origen.",
      scores: "Asigna puntuaciones válidas para el método elegido.", bonuses: "Aplica los aumentos del trasfondo.", classSkills: "Elige todas las habilidades de clase.",
      featSkills: "Elige 3 habilidades para Habilidoso.", expertise: "Elige tus habilidades de Pericia.", languages: "Elige dos idiomas.", name: "Ponle nombre a tu personaje.",
    } as Record<string, string>,
    srd: "Datos de reglas del Manual del Jugador 2024 y del System Reference Document 5.2 (CC-BY-4.0).",
  },
};

const signed = (value: number) => `${value >= 0 ? "+" : "−"}${Math.abs(value)}`;

/** Ability scores that put the class's primary abilities first, then Constitution. */
function suggestedAssignment(values: readonly number[], classId: ClassId): AbilityScores {
  const cls = findClass(classId);
  const order: AbilityKey[] = [...(cls?.primary ?? [])];
  for (const key of ["con", "dex", "wis", "str", "int", "cha"] as AbilityKey[]) if (!order.includes(key)) order.push(key);
  const sorted = [...values].sort((a, b) => b - a);
  return Object.fromEntries(order.map((key, index) => [key, sorted[index]])) as AbilityScores;
}

export function newBuild(): CharacterBuild {
  return {
    version: 1, classId: "fighter", useSubclass: true, backgroundId: "soldier", speciesId: "human",
    abilityMethod: "standard", baseScores: suggestedAssignment(STANDARD_ARRAY, "fighter"), bonusMode: "plus2plus1",
    bonusAbilities: ["str", "con"], classSkills: [], speciesSkills: [], featSkills: [], expertise: [], languages: [],
    classEquipment: "A", backgroundEquipment: "A", alignment: 4, appearance: "",
  };
}

function Choice({ selected, onClick, children, disabled, title }: { selected: boolean; onClick: () => void; children: ReactNode; disabled?: boolean; title?: string }) {
  return <button type="button" className={`${styles.choice} ${selected ? styles.selected : ""}`} aria-pressed={selected} onClick={onClick} disabled={disabled} title={title}>{children}</button>;
}

function SkillPicker({ options, chosen, limit, locked, onChange, locale, lockedLabel }: {
  options: SkillKey[]; chosen: SkillKey[]; limit: number; locked: Set<SkillKey>; onChange: (next: SkillKey[]) => void; locale: Locale; lockedLabel: string;
}) {
  return <div className={styles.skillGrid}>{options.map((skill) => {
    const isLocked = locked.has(skill);
    const isChosen = chosen.includes(skill);
    const full = chosen.length >= limit && !isChosen;
    return <label key={skill} className={`${styles.skill} ${isChosen ? styles.skillOn : ""} ${isLocked ? styles.skillLocked : ""}`}>
      <input type="checkbox" checked={isChosen || isLocked} disabled={isLocked || full}
        onChange={(event) => onChange(event.target.checked ? [...chosen, skill] : chosen.filter((item) => item !== skill))} />
      <span>{translate(locale, `skill.${skill}`)}<small>{translate(locale, `ability.${skills[skill]}`).slice(0, 3)}{isLocked ? ` · ${lockedLabel}` : ""}</small></span>
    </label>;
  })}</div>;
}

export default function CharacterWizard({ locale, initial, quick = false, onSave, onCancel }: Props) {
  const c = copy[locale];
  const [step, setStep] = useState(0);
  const [build, setBuild] = useState<CharacterBuild>(initial?.build ?? newBuild());
  const [name, setName] = useState(initial?.name ?? "");
  const [level, setLevel] = useState(initial?.level ?? 1);
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const update = (patch: Partial<CharacterBuild>) => setBuild((current) => ({ ...current, ...patch }));

  const cls = findClass(build.classId)!;
  const bg = findBackground(build.backgroundId)!;
  const sp = findSpecies(build.speciesId)!;
  const sheet = useMemo(() => deriveSheet(build, level), [build, level]);
  const feats = characterFeats(build);
  const bgSkills = new Set<SkillKey>(bg.skills);
  const beforeClass = new Set<SkillKey>([...bg.skills, ...build.speciesSkills]);
  const show = (target: number) => quick || step === target;
  const issues = quick
    ? [...new Set([...c.steps.flatMap((_, index) => stepIssues(build, index)), ...(name.trim() ? [] : ["name"])])]
    : [...stepIssues(build, step), ...(step === 6 && !name.trim() ? ["name"] : [])];
  const heading = (target: number) => quick && <h3 className={styles.sectionTitle}>{c.steps[target]}</h3>;
  const selectFor = (items: { id: string; name: { en: string; es: string } }[], value: string, onPick: (id: never) => void) =>
    <label className={styles.field}><select value={value} aria-label={c.steps[0]} onChange={(event) => (onPick as (id: string) => void)(event.target.value)}>
      {items.map((item) => <option key={item.id} value={item.id}>{say(item.name, locale)}</option>)}</select></label>;
  const last = c.steps.length - 1;

  function chooseClass(classId: ClassId) {
    update({ classId, classSkills: [], expertise: [], classEquipment: "A", subclassId: undefined, ...(build.subclassId ? { useSubclass: true } : {}),
      ...(build.abilityMethod === "standard" ? { baseScores: suggestedAssignment(STANDARD_ARRAY, classId) } : {}) });
  }
  function chooseBackground(backgroundId: BackgroundId) {
    const next = findBackground(backgroundId)!;
    const preferred = next.abilities.filter((key) => cls.primary.includes(key));
    const rest = next.abilities.filter((key) => !preferred.includes(key));
    const ordered = [...preferred, ...rest];
    update({ backgroundId, bonusAbilities: build.bonusMode === "plus2plus1" ? [ordered[0], ordered[1]] : [...next.abilities], backgroundEquipment: "A",
      classSkills: build.classSkills.filter((skill) => !next.skills.includes(skill)),
      speciesSkills: build.speciesSkills.filter((skill) => !next.skills.includes(skill)) });
  }
  function chooseSpecies(speciesId: SpeciesId) {
    update({ speciesId, lineageId: undefined, speciesSkills: [], speciesFeat: undefined });
  }
  /** Swap-based assignment keeps a fixed pool of values (standard array or rolls). */
  function assign(key: AbilityKey, value: number) {
    const current = build.baseScores[key];
    const other = abilities.find(({ key: candidate }) => candidate !== key && build.baseScores[candidate] === value)?.key;
    update({ baseScores: { ...build.baseScores, [key]: value, ...(other ? { [other]: current } : {}) } });
  }
  function setMethod(method: AbilityMethod) {
    if (method === "standard") update({ abilityMethod: method, baseScores: suggestedAssignment(STANDARD_ARRAY, build.classId) });
    else if (method === "pointBuy") update({ abilityMethod: method, baseScores: { str: 8, dex: 8, con: 8, int: 8, wis: 8, cha: 8 } });
    else rollScores();
  }
  function rollScores() {
    const pool = Array.from({ length: 6 }, () => roll4d6DropLowest());
    update({ abilityMethod: "rolled", rolledPool: pool, baseScores: suggestedAssignment(pool, build.classId) });
  }
  function go(target: number) {
    if (target === 4) {
      // Drop class choices that became duplicates after changing background or species.
      update({ classSkills: build.classSkills.filter((skill) => !beforeClass.has(skill)) });
    }
    setStep(target);
  }
  function finish() {
    // The stepper allows jumping ahead, so check every step before saving.
    const incomplete = c.steps.findIndex((_, index) => stepIssues(build, index).length > 0 || (index === 6 && !name.trim()));
    if (incomplete >= 0) { setStep(incomplete); return; }
    // Level-ups above the chosen level no longer apply.
    onSave({ name: name.trim(), level, notes: notes.trim(), build: { ...build, levelUps: build.levelUps?.filter((entry) => entry.level <= level) } });
  }

  const pool = build.abilityMethod === "standard" ? [...STANDARD_ARRAY] : build.rolledPool ?? [];
  const bonuses = backgroundBonuses(build);
  const scores = finalScores(build);
  const classOptions = cls.skillOptions.length ? cls.skillOptions : skillKeys;
  const proficientForExpertise = [...new Set([...bg.skills, ...build.speciesSkills, ...build.classSkills, ...(feats.includes("skilled") ? build.featSkills : [])])];

  return <section className={styles.wizard} aria-labelledby="wizard-title">
    <header className={styles.head}>
      <div><p className={styles.kicker}>✦ {c.kicker}</p><h2 id="wizard-title">{quick ? c.quickCreate : initial ? c.edit : c.create}</h2></div>
      <button type="button" className={styles.close} onClick={onCancel} aria-label={c.close}>×</button>
    </header>

    {!quick && <nav className={styles.steps} aria-label={c.stepOf(step + 1, c.steps.length)}>
      {c.steps.map((label, index) => <button type="button" key={label} className={`${styles.step} ${index === step ? styles.current : ""} ${index < step ? styles.done : ""}`}
        aria-current={index === step ? "step" : undefined} onClick={() => go(index)}>
        <span>{index < step ? "✓" : ["I", "II", "III", "IV", "V", "VI", "VII", "VIII"][index]}</span>{label}
      </button>)}
    </nav>}

    <div className={styles.body}>
      {show(0) && <>
        {heading(0)}
        <p className={styles.intro}>{c.classIntro}</p>
        {quick ? selectFor(classes, build.classId, chooseClass) : <div className={styles.cardGrid}>{classes.map((item) => <Choice key={item.id} selected={item.id === build.classId} onClick={() => chooseClass(item.id)}>
          <strong>{say(item.name, locale)}</strong><small>d{item.hitDie} · {item.primary.map((key) => translate(locale, `ability.${key}`)).join(" / ")}</small><em>{say(item.summary, locale)}</em>
        </Choice>)}</div>}
        <div className={styles.detail}>
          <h3>{say(cls.name, locale)}</h3>
          <dl className={styles.facts}>
            <div><dt>{c.hitDie}</dt><dd>d{cls.hitDie}</dd></div>
            <div><dt>{c.primary}</dt><dd>{cls.primary.map((key) => translate(locale, `ability.${key}`)).join(" / ")}</dd></div>
            <div><dt>{c.saves}</dt><dd>{cls.saves.map((key) => translate(locale, `ability.${key}`)).join(", ")}</dd></div>
            <div><dt>{c.armor}</dt><dd>{say(cls.armor, locale)}</dd></div>
            <div><dt>{c.weapons}</dt><dd>{say(cls.weapons, locale)}</dd></div>
            {cls.tools && <div><dt>{c.tools}</dt><dd>{say(cls.tools, locale)}</dd></div>}
            <div><dt>{c.skillsPick(cls.skillCount)}</dt><dd>{cls.skillOptions.length ? cls.skillOptions.map((skill) => translate(locale, `skill.${skill}`)).join(", ") : c.anySkill}</dd></div>
            <div><dt>{c.features}</dt><dd>{cls.features.map((feature) => say(feature, locale)).join(" · ")}{cls.weaponMasteries ? ` — ${c.masteries(cls.weaponMasteries)}` : ""}</dd></div>
            {cls.spellcasting && <div><dt>{c.spellcasting}</dt><dd>{translate(locale, `ability.${cls.spellcasting.ability}`)} · {c.cantrips} {cls.spellcasting.cantrips} · {c.prepared} {cls.spellcasting.prepared} · {say(cls.spellcasting.slots, locale)}</dd></div>}
          </dl>
          <div className={styles.inline}>
            <label className={styles.field}>{c.level}<input type="number" min={1} max={20} value={level} onChange={(event) => setLevel(Math.min(20, Math.max(1, Math.floor(Number(event.target.value) || 1))))} /></label>
            {level >= 3 && <label className={styles.field}>{c.subclass}<select
              value={build.useSubclass ? "srd" : findBookSubclass(build.classId, build.subclassId)?.id ?? ""}
              onChange={(event) => {
                const value = event.target.value;
                update({ useSubclass: value === "srd", subclassId: value && value !== "srd" ? value : undefined, ...(value ? { customSubclass: undefined } : {}) });
              }}>
              {subclassesFor(build.classId).map((entry) => <option key={entry.id} value={entry.srd ? "srd" : entry.id}>{say(entry.name, locale)} ({entry.srd ? c.srdTag : c.bookTag})</option>)}
              <option value="">{c.noSubclass}</option>
            </select></label>}
          </div>
          {level >= 3 && <p className={styles.note}>{c.subclassNote}</p>}
        </div>
      </>}

      {show(1) && <>
        {heading(1)}
        <p className={styles.intro}>{c.backgroundIntro}</p>
        {quick ? selectFor(backgrounds, build.backgroundId, chooseBackground) : <div className={styles.cardGrid}>{backgrounds.map((item) => <Choice key={item.id} selected={item.id === build.backgroundId} onClick={() => chooseBackground(item.id)}>
          <strong>{say(item.name, locale)}</strong><small>{item.abilities.map((key) => translate(locale, `ability.${key}`).slice(0, 3)).join(" · ")}</small><em>{say(item.summary, locale)}</em>
        </Choice>)}</div>}
        <div className={styles.detail}>
          <h3>{say(bg.name, locale)}</h3>
          <dl className={styles.facts}>
            <div><dt>{c.abilitiesLabel}</dt><dd>{bg.abilities.map((key) => translate(locale, `ability.${key}`)).join(", ")}</dd></div>
            <div><dt>{c.feat}</dt><dd>{say(originFeats[bg.feat].name, locale)}{bg.featList ? ` (${say(magicInitiateLists[bg.featList], locale)})` : ""} — {say(originFeats[bg.feat].summary, locale)}</dd></div>
            <div><dt>{c.skills}</dt><dd>{bg.skills.map((skill) => translate(locale, `skill.${skill}`)).join(", ")}</dd></div>
            <div><dt>{c.tool}</dt><dd>{say(bg.tool, locale)}</dd></div>
          </dl>
        </div>
      </>}

      {show(2) && <>
        {heading(2)}
        <p className={styles.intro}>{c.speciesIntro}</p>
        {quick ? selectFor(species, build.speciesId, chooseSpecies) : <div className={styles.cardGrid}>{species.map((item) => <Choice key={item.id} selected={item.id === build.speciesId} onClick={() => chooseSpecies(item.id)}>
          <strong>{say(item.name, locale)}</strong><small>{say(item.size, locale)} · {item.speed} {c.ft}{item.darkvision ? ` · ◐ ${item.darkvision}` : ""}</small><em>{item.traits.map((trait) => say(trait, locale)).join(" · ")}</em>
        </Choice>)}</div>}
        <div className={styles.detail}>
          <h3>{say(sp.name, locale)}</h3>
          <dl className={styles.facts}>
            <div><dt>{c.size}</dt><dd>{say(sp.size, locale)}</dd></div>
            <div><dt>{c.speed}</dt><dd>{sp.speed} {c.ft}</dd></div>
            {sp.darkvision && <div><dt>{c.darkvision}</dt><dd>{sp.darkvision} {c.ft}</dd></div>}
            <div><dt>{c.traits}</dt><dd>{sp.traits.map((trait) => say(trait, locale)).join(" · ")}</dd></div>
          </dl>
          {sp.lineages && <fieldset className={styles.group}><legend>{say(sp.lineageLabel, locale)}</legend><div className={styles.pills}>
            {sp.lineages.map((lineage) => <Choice key={lineage.id} selected={lineage.id === build.lineageId} onClick={() => update({ lineageId: lineage.id })}>
              <strong>{say(lineage.name, locale)}</strong>{lineage.detail && <small>{say(lineage.detail, locale)}</small>}
            </Choice>)}
          </div></fieldset>}
          {sp.skillChoice && <fieldset className={styles.group}><legend>{c.chooseSkill(sp.skillChoice.count)}</legend>
            <SkillPicker locale={locale} lockedLabel={c.already} options={sp.skillChoice.options.length ? sp.skillChoice.options : skillKeys} chosen={build.speciesSkills}
              limit={sp.skillChoice.count} locked={bgSkills} onChange={(speciesSkills) => update({ speciesSkills, classSkills: build.classSkills.filter((skill) => !speciesSkills.includes(skill)) })} />
          </fieldset>}
          {sp.originFeat && <fieldset className={styles.group}><legend>{c.chooseFeat}</legend><div className={styles.pills}>
            {(Object.keys(originFeats) as FeatId[]).map((feat) => <Choice key={feat} selected={build.speciesFeat === feat} onClick={() => update({ speciesFeat: feat, featSkills: [] })}>
              <strong>{say(originFeats[feat].name, locale)}</strong><small>{say(originFeats[feat].summary, locale)}</small>
            </Choice>)}
          </div>
            {build.speciesFeat === "magicInitiate" && <label className={styles.field}>{c.spellList}<select value={build.magicInitiateList ?? "wizard"} onChange={(event) => update({ magicInitiateList: event.target.value as MagicInitiateList })}>
              {(Object.keys(magicInitiateLists) as MagicInitiateList[]).map((list) => <option key={list} value={list}>{say(magicInitiateLists[list], locale)}</option>)}
            </select></label>}
          </fieldset>}
        </div>
      </>}

      {show(3) && <>
        {heading(3)}
        <p className={styles.intro}>{c.abilitiesIntro}</p>
        <div className={styles.tabs} role="radiogroup">{(["standard", "pointBuy", "rolled"] as AbilityMethod[]).map((method) =>
          <Choice key={method} selected={build.abilityMethod === method} onClick={() => setMethod(method)}><strong>{c.methods[method]}</strong><small>{c.methodHelp[method]}</small></Choice>)}</div>
        <div className={styles.toolbar}>
          {build.abilityMethod !== "pointBuy" && pool.length === 6 && <button type="button" className={styles.link} onClick={() => update({ baseScores: suggestedAssignment(pool, build.classId) })}>✧ {c.suggest}</button>}
          {build.abilityMethod === "rolled" && <button type="button" className={styles.link} onClick={rollScores}>⚄︎ {c.reroll}</button>}
          {build.abilityMethod === "rolled" && pool.length === 6 && <span className={styles.pool}>{pool.join(" · ")}</span>}
          {build.abilityMethod === "pointBuy" && <span className={`${styles.pool} ${pointBuySpent(build.baseScores) > POINT_BUY_BUDGET ? styles.bad : ""}`}>{c.points(pointBuySpent(build.baseScores))}</span>}
        </div>
        <div className={styles.abilityTable}>
          <div className={styles.abilityHead}><span /><span>{c.base}</span><span>{c.bonus}</span><span>{c.final}</span><span>{c.mod}</span></div>
          {abilities.map(({ key }) => <div className={styles.abilityRow} key={key}>
            <b>{translate(locale, `ability.${key}`)}{cls.primary.includes(key) && <i title={c.primary}> ★︎</i>}</b>
            <span>{build.abilityMethod === "pointBuy"
              ? <span className={styles.stepper}>
                <button type="button" onClick={() => update({ baseScores: { ...build.baseScores, [key]: build.baseScores[key] - 1 } })} disabled={build.baseScores[key] <= 8} aria-label="−">−</button>
                <output>{build.baseScores[key]}</output>
                <button type="button" onClick={() => update({ baseScores: { ...build.baseScores, [key]: build.baseScores[key] + 1 } })}
                  disabled={build.baseScores[key] >= 15 || pointBuySpent({ ...build.baseScores, [key]: build.baseScores[key] + 1 }) > POINT_BUY_BUDGET} aria-label="+">+</button>
                <small>{pointBuyCost[build.baseScores[key]]}</small>
              </span>
              : <select value={build.baseScores[key]} onChange={(event) => assign(key, Number(event.target.value))} aria-label={translate(locale, `ability.${key}`)}>
                {[...new Set(pool)].sort((a, b) => b - a).map((value) => <option key={value} value={value}>{value}</option>)}
              </select>}</span>
            <span className={styles.bonusCell}>{bonuses[key] ? `+${bonuses[key]}` : "—"}</span>
            <strong>{scores[key]}</strong>
            <span className={styles.mod}>{signed(abilityModifier(scores[key]))}</span>
          </div>)}
        </div>
        <fieldset className={styles.group}><legend>{c.bonusMode} · {say(bg.name, locale)}</legend>
          <div className={styles.inline}>
            <label className={styles.check}><input type="radio" name="bonus-mode" checked={build.bonusMode === "plus2plus1"} onChange={() => update({ bonusMode: "plus2plus1", bonusAbilities: [bg.abilities[0], bg.abilities[1]] })} />{c.plus2plus1}</label>
            <label className={styles.check}><input type="radio" name="bonus-mode" checked={build.bonusMode === "plus1x3"} onChange={() => update({ bonusMode: "plus1x3", bonusAbilities: [...bg.abilities] })} />{c.plus1x3}</label>
          </div>
          {build.bonusMode === "plus2plus1" && <div className={styles.inline}>
            {[0, 1].map((slot) => <label className={styles.field} key={slot}>{slot === 0 ? c.plusTwo : c.plusOne}
              <select value={build.bonusAbilities[slot] ?? ""} onChange={(event) => {
                const next = [...build.bonusAbilities] as AbilityKey[];
                next[slot] = event.target.value as AbilityKey;
                if (next[0] === next[1]) next[1 - slot] = bg.abilities.find((key) => key !== next[slot])!;
                update({ bonusAbilities: next });
              }}>{bg.abilities.map((key) => <option key={key} value={key}>{translate(locale, `ability.${key}`)}</option>)}</select>
            </label>)}
          </div>}
        </fieldset>
        {!validBaseScores(build) && <p className={styles.warning} role="alert">{c.issues.scores}</p>}
      </>}

      {show(4) && <>
        {heading(4)}
        <p className={styles.intro}>{c.profIntro}</p>
        <fieldset className={styles.group}><legend>{say(cls.name, locale)} · {c.skillsPick(cls.skillCount)}</legend>
          <SkillPicker locale={locale} lockedLabel={c.already} options={classOptions} chosen={build.classSkills} limit={cls.skillCount}
            locked={beforeClass} onChange={(classSkills) => update({ classSkills, featSkills: build.featSkills.filter((skill) => !classSkills.includes(skill)), expertise: build.expertise.filter((skill) => proficientForExpertise.includes(skill) || classSkills.includes(skill)) })} />
        </fieldset>
        {feats.includes("skilled") && <fieldset className={styles.group}><legend>{c.skilled}</legend>
          <SkillPicker locale={locale} lockedLabel={c.already} options={skillKeys} chosen={build.featSkills} limit={3}
            locked={new Set([...beforeClass, ...build.classSkills])} onChange={(featSkills) => update({ featSkills })} />
        </fieldset>}
        {cls.expertiseAtLevel1 && <fieldset className={styles.group}><legend>{c.expertise(cls.expertiseAtLevel1)}</legend>
          <SkillPicker locale={locale} lockedLabel="" options={proficientForExpertise} chosen={build.expertise} limit={cls.expertiseAtLevel1}
            locked={new Set()} onChange={(expertise) => update({ expertise })} />
        </fieldset>}
      </>}

      {show(5) && <>
        {heading(5)}
        <p className={styles.intro}>{c.equipmentIntro}</p>
        {[{ title: `${c.classKit} · ${say(cls.name, locale)}`, options: cls.equipment, value: build.classEquipment, set: (id: string) => update({ classEquipment: id as CharacterBuild["classEquipment"] }) },
          { title: `${c.backgroundKit} · ${say(bg.name, locale)}`, options: bg.equipment, value: build.backgroundEquipment, set: (id: string) => update({ backgroundEquipment: id as CharacterBuild["backgroundEquipment"] }) },
        ].map((group) => <fieldset className={styles.group} key={group.title}><legend>{group.title}</legend><div className={styles.kitGrid}>
          {group.options.map((option) => <Choice key={option.id} selected={group.value === option.id} onClick={() => group.set(option.id)}>
            <strong>{c.option(option.id)}</strong><ul>{option.items.map((item) => <li key={item.en}>{say(item, locale)}</li>)}</ul>
          </Choice>)}
        </div></fieldset>)}
        <p className={styles.gold}>{c.totalGold}: <b>{sheet?.gold ?? 0} {locale === "es" ? "po" : "GP"}</b></p>
      </>}

      {show(6) && <>
        {heading(6)}
        <p className={styles.intro}>{c.detailsIntro}</p>
        <div className={styles.formGrid}>
          <label className={styles.field}>{c.name}<input autoFocus required maxLength={50} value={name} onChange={(event) => setName(event.target.value)} placeholder={c.namePlaceholder} /></label>
          <label className={styles.field}>{c.alignment}<select value={build.alignment} onChange={(event) => update({ alignment: Number(event.target.value) })}>
            {alignments.map((item, index) => <option key={item.en} value={index}>{say(item, locale)}</option>)}</select></label>
        </div>
        <fieldset className={styles.group}><legend>{c.languages}</legend><p className={styles.note}>{c.languagesHelp}</p><div className={styles.skillGrid}>
          {standardLanguages.map((language, index) => {
            const chosen = build.languages.includes(index);
            return <label key={language.en} className={`${styles.skill} ${chosen ? styles.skillOn : ""}`}>
              <input type="checkbox" checked={chosen} disabled={!chosen && build.languages.length >= 2}
                onChange={(event) => update({ languages: event.target.checked ? [...build.languages, index] : build.languages.filter((item) => item !== index) })} />
              <span>{say(language, locale)}</span>
            </label>;
          })}
        </div></fieldset>
        <label className={styles.field}>{c.appearance}<textarea rows={3} maxLength={600} value={build.appearance} onChange={(event) => update({ appearance: event.target.value })} /></label>
        <label className={styles.field}>{c.notes}<textarea rows={3} maxLength={500} value={notes} onChange={(event) => setNotes(event.target.value)} /></label>
      </>}

      {show(7) && sheet && <>
        <p className={styles.intro}>{c.summaryIntro}</p>
        <article className={styles.summary}>
          <header><h3>{name || "—"}</h3><p>{[say(sp.lineages?.find((item) => item.id === build.lineageId)?.name, locale), say(sp.name, locale), say(cls.name, locale), `${locale === "es" ? "nivel" : "level"} ${sheet.level}`].filter(Boolean).join(" · ")}</p>
            <p>{say(bg.name, locale)} · {say(alignments[build.alignment], locale)}{subclassLabel(build, level, locale) ? ` · ${subclassLabel(build, level, locale)}` : ""}</p></header>
          <div className={styles.vitals}>
            {[[c.ac, sheet.armorClass], [c.hp, sheet.hitPoints], [c.initiative, signed(sheet.initiative)], [c.speed, `${sheet.speed} ${c.ft}`], [c.proficiency, signed(sheet.proficiency)], [c.passive, sheet.passivePerception]].map(([label, value]) =>
              <div key={String(label)}><span>{label}</span><b>{value}</b></div>)}
          </div>
          <div className={styles.abilityStrip}>{abilities.map(({ key }) => <div key={key}>
            <span>{translate(locale, `ability.${key}`).slice(0, 3).toLocaleUpperCase(locale === "es" ? "es-ES" : "en-US")}</span><b>{signed(abilityModifier(sheet.scores[key]))}</b><small>{sheet.scores[key]}</small>
            <em className={sheet.saves[key].proficient ? styles.prof : ""}>{c.saves.split(" ")[0]} {signed(sheet.saves[key].bonus)}</em>
          </div>)}</div>
          <div className={styles.twoCol}>
            <section><h4>{c.skills}</h4><ul className={styles.skillList}>{skillKeys.map((skill) => <li key={skill} className={sheet.skills[skill].proficient ? styles.prof : ""}>
              <i>{sheet.skills[skill].expertise ? "◆" : sheet.skills[skill].proficient ? "●" : "○"}</i>{translate(locale, `skill.${skill}`)}<b>{signed(sheet.skills[skill].bonus)}</b></li>)}</ul></section>
            <section>
              <h4>{c.features}</h4><p>{unlockedFeatures(build, level).map((feature) => say(feature, locale)).join(" · ")}</p>
              <h4>{c.traits}</h4><p>{sp.traits.map((trait) => say(trait, locale)).join(" · ")}{sheet.darkvision ? ` · ${c.darkvision} ${sheet.darkvision} ${c.ft}` : ""}</p>
              <h4>{c.feat}</h4><p>{sheet.feats.map((feat) => say(featInfo(feat).name, locale)).join(" · ")}</p>
              {cls.spellcasting && <><h4>{c.spellcasting}</h4><p>{c.spellDc} {sheet.spellSaveDc} · {c.spellAtk} {signed(sheet.spellAttack ?? 0)} · {say(cls.spellcasting.slots, locale)}</p></>}
              <h4>{c.languages}</h4><p>{[locale === "es" ? "Común" : "Common", ...build.languages.map((index) => say(standardLanguages[index], locale))].join(", ")}</p>
              <h4>{c.totalGold}</h4><p>{sheet.gold} {locale === "es" ? "po" : "GP"} · {c.hitDie} {sheet.hitDice}</p>
            </section>
          </div>
        </article>
      </>}
    </div>

    <footer className={styles.foot}>
      <span className={styles.issues} role="status">{issues.map((issue) => c.issues[issue]).filter(Boolean).join(" ")}</span>
      <button type="button" className="button button-quiet" onClick={!quick && step ? () => go(step - 1) : onCancel}>{!quick && step ? `‹ ${c.back}` : c.cancel}</button>
      {!quick && step < last
        ? <button type="button" className="button button-primary" onClick={() => go(step + 1)} disabled={issues.length > 0}>{c.next} ›</button>
        : <button type="button" className="button button-primary" onClick={finish} disabled={quick && issues.length > 0}>✦ {c.save}</button>}
    </footer>
    <p className={styles.srd}>{c.srd}</p>
  </section>;
}

/** Display names stored alongside the build so older views keep working. */
export function describeBuild(build: CharacterBuild, locale: Locale, level = 20) {
  const sp = findSpecies(build.speciesId);
  const lineage = sp?.lineages?.find((item) => item.id === build.lineageId);
  const subclass = subclassLabel(build, level, locale);
  return {
    className: `${say(findClass(build.classId)?.name, locale)}${subclass ? ` (${subclass})` : ""}`,
    species: [say(lineage?.name, locale), say(sp?.name, locale)].filter(Boolean).join(" · "),
    background: say(findBackground(build.backgroundId)?.name, locale),
    scores: finalScores(build, level),
  };
}
