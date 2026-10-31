"use client";

import { useMemo, useState, type ReactNode } from "react";
import { abilities, abilityModifier, type AbilityKey } from "@/lib/rules";
import { translate, type Locale } from "@/lib/i18n";
import { findClass, findSpecies, magicInitiateLists, say, skillKeys, type MagicInitiateList, type SkillKey } from "@/lib/dnd2024";
import { deriveSheet, finalScores, type CharacterBuild, type FeatPick, type LevelUpChoice } from "@/lib/character-sheet";
import {
  asiFeatOptions, averageHitDie, applyLevelUp, expertiseFor, expertiseOptions, levelGains, levelUpIssues, levelUpSteps, MAX_LEVEL,
  chosenSubclassId, subclassLabel, subclassProgression, type LevelStep, type SubclassPick,
} from "@/lib/levelup";
import { epicBoons, featInfo, fightingStyles, type Feature, type LevelFeatId, type FightingStyleId } from "@/lib/levelup-data";
import styles from "./character-wizard.module.css";
import { findSubclass, subclassesFor } from "@/lib/subclasses";
import own from "./level-up.module.css";

export interface LevelUpResult { level: number; build: CharacterBuild }

type Props = {
  locale: Locale;
  name: string;
  /** Level the character has now; the guide takes them to the next one. */
  level: number;
  build: CharacterBuild;
  onSave: (result: LevelUpResult) => void;
  onCancel: () => void;
};

const copy = {
  en: {
    kicker: "Level up", title: (name: string, level: number) => `${name} reaches level ${level}`, close: "Close level up", back: "Back", next: "Continue",
    confirm: "Confirm level up", cancel: "Cancel", stepOf: (current: number, total: number) => `Step ${current} of ${total}`,
    steps: { overview: "What's new", hp: "Hit points", subclass: "Subclass", asi: "Improvement", boon: "Epic Boon", fightingStyle: "Fighting Style", expertise: "Expertise", review: "Review" } as Record<string, string>,
    reassure: "Nothing is saved until the last step, and you can go back at any time. If you're unsure, the options marked “Recommended” are safe picks for a new player.",
    newFeatures: "New abilities", noFeatures: "This level has no brand-new class feature. You still get more Hit Points, and the choices on the next steps.",
    proficiency: "Proficiency Bonus", proficiencyHelp: "Added to attacks, saves and skills you're trained in. It grows at levels 5, 9, 13 and 17.",
    numbers: "Numbers that grew", spellsTitle: "Your magic grows", cantrips: "Cantrips known", prepared: "Prepared spells", slots: "Spell slots", pact: (count: number, level: number) => `${count} slots of level ${level} (they recharge on a Short Rest)`,
    spellHint: "Choose your new spells with your Dungeon Master or from your class list. Grimoire doesn't track the spell list yet, so note them in your sheet's notes.",
    spellbookHint: "Wizards also copy two new spells into their spellbook every level.", subclassFeaturesTitle: "From your subclass",
    choicesAhead: "Coming up, you'll choose:", aheadNames: { subclass: "your subclass", asi: "an Ability Score Improvement or a feat", boon: "an Epic Boon", fightingStyle: "a Fighting Style", expertise: "Expertise skills" } as Record<string, string>,
    hpIntro: "Hit Points (HP) measure how much punishment you can take. Each level adds a bit more, plus your Constitution modifier. You can take the fixed average or roll your Hit Die.",
    hpAverage: "Take the average", hpAverageHelp: "A fixed number, no luck involved.", hpRoll: "Roll the die", hpRollHelp: "Could be higher or lower than average. At the table, roll a real die if you prefer.",
    recommended: "Recommended", rollFor: "Roll for me", rollLabel: (die: number) => `Result of your d${die}`, hpGain: (gain: number) => `You gain +${gain} HP this level (your Constitution modifier is included).`,
    subclassIntro: "At level 3 every class picks a subclass: a specialty that gives your character a unique style and extra abilities as they level. You can't change it later, so read the options.",
    subclassSrd: "Free SRD", subclassBook: "Player's Handbook", subclassAt: (level: number) => `What you get at level ${level}`, level: "level",
    asiIntro: "Your hero improves! Choose one: raise your ability scores, or take a feat (a special talent). Scores can't go above 20.",
    asiScores: "Raise ability scores", asiScoresHelp: "Simple and always useful.", asiFeat: "Take a feat", asiFeatHelp: "A special talent instead of a score increase.",
    plus2: "+2 to one score", plus1: "+1 to two scores", pickOne: "Pick one ability.", pickTwo: "Pick two different abilities.", recommendedAbility: "★ Good for your class", capped: "Already at the maximum",
    featPick: "Choose a feat", featBlocked: "You can't take this one right now", pickFeatAbility: "Choose the ability that gets +1", pickFeatSkills: "Choose 3 new skills", pickList: "Choose a spell list", unavailable: "unavailable",
    boonIntro: "At level 19 heroes receive an Epic Boon: a powerful gift that goes beyond normal limits. It also adds +1 to an ability score (up to 30).", boonAbility: "Choose the ability that gets +1",
    styleIntro: "A Fighting Style is a specialty with your weapons or armor. It's a permanent bonus, so pick the one that matches how you like to fight.", styleHint: "Not sure? Defense is simple and works for everyone wearing armor.",
    expertiseIntro: (count: number) => `Expertise doubles your Proficiency Bonus on a skill you already know. Choose ${count} of your skills.`, expertiseNone: "You don't have a skill left to improve.",
    reviewIntro: "Here is everything that will change. If it looks right, confirm and your sheet is updated.", rows: {
      level: "Level", hp: "Hit Points", proficiency: "Proficiency Bonus", ac: "Armor Class", scores: "Ability scores", subclass: "Subclass", feat: "Feat", style: "Fighting Style", expertise: "Expertise",
    } as Record<string, string>,
    issues: {
      hp: "Enter the number you rolled (1 to your die size).", subclass: "Choose a subclass.", asi: "Finish your improvement or feat.", boon: "Choose an Epic Boon and the ability that gets +1.",
      fightingStyle: "Choose a Fighting Style.", expertise: "Choose the skills to improve.",
    } as Record<string, string>,
    maxLevel: "This character is already at the maximum level.",
  },
  es: {
    kicker: "Subir de nivel", title: (name: string, level: number) => `${name} llega al nivel ${level}`, close: "Cerrar subida de nivel", back: "Atrás", next: "Continuar",
    confirm: "Confirmar subida de nivel", cancel: "Cancelar", stepOf: (current: number, total: number) => `Paso ${current} de ${total}`,
    steps: { overview: "Novedades", hp: "Puntos de golpe", subclass: "Subclase", asi: "Mejora", boon: "Don épico", fightingStyle: "Estilo de combate", expertise: "Pericia", review: "Revisión" } as Record<string, string>,
    reassure: "No se guarda nada hasta el último paso y puedes volver atrás cuando quieras. Si dudas, las opciones marcadas como «Recomendado» son una apuesta segura para quien empieza.",
    newFeatures: "Nuevas habilidades", noFeatures: "Este nivel no trae una habilidad de clase nueva. Aun así ganas más puntos de golpe y tomas las decisiones de los siguientes pasos.",
    proficiency: "Bonificador por competencia", proficiencyHelp: "Se suma a ataques, salvaciones y habilidades en las que eres competente. Sube en los niveles 5, 9, 13 y 17.",
    numbers: "Números que crecen", spellsTitle: "Tu magia crece", cantrips: "Trucos conocidos", prepared: "Conjuros preparados", slots: "Espacios de conjuro", pact: (count: number, level: number) => `${count} espacios de nivel ${level} (se recuperan con un descanso corto)`,
    spellHint: "Elige tus conjuros nuevos con tu Director de Juego o desde la lista de tu clase. Grimoire aún no guarda la lista de conjuros; anótalos en las notas de la ficha.",
    spellbookHint: "Los magos además copian dos conjuros nuevos a su libro de conjuros cada nivel.", subclassFeaturesTitle: "De tu subclase",
    choicesAhead: "A continuación elegirás:", aheadNames: { subclass: "tu subclase", asi: "una mejora de característica o una dote", boon: "un don épico", fightingStyle: "un estilo de combate", expertise: "habilidades con pericia" } as Record<string, string>,
    hpIntro: "Los puntos de golpe (PG) miden cuánto castigo aguantas. Cada nivel suma un poco más, además de tu modificador de Constitución. Puedes tomar el promedio fijo o tirar tu dado de golpe.",
    hpAverage: "Tomar el promedio", hpAverageHelp: "Un número fijo, sin azar.", hpRoll: "Tirar el dado", hpRollHelp: "Puede salir más o menos que el promedio. En la mesa, tira un dado real si prefieres.",
    recommended: "Recomendado", rollFor: "Tirar por mí", rollLabel: (die: number) => `Resultado de tu d${die}`, hpGain: (gain: number) => `Ganas +${gain} PG este nivel (ya incluye tu modificador de Constitución).`,
    subclassIntro: "En el nivel 3 toda clase elige una subclase: una especialidad que da a tu personaje un estilo único y habilidades extra al subir. No se puede cambiar después, así que lee las opciones.",
    subclassSrd: "SRD gratuito", subclassBook: "Manual del Jugador", subclassAt: (level: number) => `Lo que obtienes en el nivel ${level}`, level: "nivel",
    asiIntro: "¡Tu héroe mejora! Elige una opción: subir tus características o tomar una dote (un talento especial). Las características no pueden pasar de 20.",
    asiScores: "Subir características", asiScoresHelp: "Sencillo y siempre útil.", asiFeat: "Tomar una dote", asiFeatHelp: "Un talento especial en vez de subir características.",
    plus2: "+2 a una característica", plus1: "+1 a dos características", pickOne: "Elige una característica.", pickTwo: "Elige dos características distintas.", recommendedAbility: "★ Buena para tu clase", capped: "Ya está al máximo",
    featPick: "Elige una dote", featBlocked: "No puedes tomar esta ahora mismo", pickFeatAbility: "Elige la característica que recibe +1", pickFeatSkills: "Elige 3 habilidades nuevas", pickList: "Elige una lista de conjuros", unavailable: "no disponible",
    boonIntro: "En el nivel 19 los héroes reciben un don épico: un regalo poderoso que supera los límites normales. También suma +1 a una característica (hasta 30).", boonAbility: "Elige la característica que recibe +1",
    styleIntro: "Un estilo de combate es una especialidad con tus armas o armadura. Es un bonificador permanente, así que elige el que encaje con tu forma de luchar.", styleHint: "¿No sabes cuál? Defensa es sencillo y sirve a cualquiera que lleve armadura.",
    expertiseIntro: (count: number) => `La pericia duplica tu bonificador por competencia en una habilidad que ya conoces. Elige ${count} de tus habilidades.`, expertiseNone: "No te queda ninguna habilidad por mejorar.",
    reviewIntro: "Esto es todo lo que va a cambiar. Si te parece bien, confirma y tu ficha se actualizará.", rows: {
      level: "Nivel", hp: "Puntos de golpe", proficiency: "Bonificador por competencia", ac: "Clase de armadura", scores: "Características", subclass: "Subclase", feat: "Dote", style: "Estilo de combate", expertise: "Pericia",
    } as Record<string, string>,
    issues: {
      hp: "Escribe el resultado de tu tirada (de 1 al tamaño de tu dado).", subclass: "Elige una subclase.", asi: "Termina tu mejora o tu dote.", boon: "Elige un don épico y la característica que recibe +1.",
      fightingStyle: "Elige un estilo de combate.", expertise: "Elige las habilidades a mejorar.",
    } as Record<string, string>,
    maxLevel: "Este personaje ya está en el nivel máximo.",
  },
};

const signed = (value: number) => `${value >= 0 ? "+" : "−"}${Math.abs(value)}`;

function Choice({ selected, onClick, children, disabled }: { selected: boolean; onClick: () => void; children: ReactNode; disabled?: boolean }) {
  return <button type="button" className={`${styles.choice} ${selected ? styles.selected : ""}`} aria-pressed={selected} onClick={onClick} disabled={disabled}>{children}</button>;
}

function FeatureList({ items, locale }: { items: Feature[]; locale: Locale }) {
  return <ul className={own.features}>{items.map((feature) => <li key={feature.name.en}><b>{say(feature.name, locale)}</b><span>{say(feature.tip, locale)}</span></li>)}</ul>;
}

export default function LevelUp({ locale, name, level, build, onSave, onCancel }: Props) {
  const c = copy[locale];
  const next = level + 1;
  const cls = findClass(build.classId)!;
  const species = findSpecies(build.speciesId);
  const steps = useMemo(() => levelUpSteps(build, next), [build, next]);
  const flow: ("overview" | LevelStep | "review")[] = ["overview", ...steps, "review"];
  const [position, setPosition] = useState(0);

  const [hpMode, setHpMode] = useState<"average" | "roll">("average");
  const [rollText, setRollText] = useState("");
  const [subclass, setSubclass] = useState<SubclassPick>("");
  const [asiKind, setAsiKind] = useState<"scores" | "feat">("scores");
  const [spread, setSpread] = useState<"plus2" | "plus1">("plus2");
  const [picks, setPicks] = useState<AbilityKey[]>([]);
  const [featId, setFeatId] = useState<LevelFeatId | null>(null);
  const [featAbility, setFeatAbility] = useState<AbilityKey | null>(null);
  const [featSkills, setFeatSkills] = useState<SkillKey[]>([]);
  const [featList, setFeatList] = useState<MagicInitiateList | null>(null);
  const [style, setStyle] = useState<FightingStyleId | null>(null);
  const [expertise, setExpertise] = useState<SkillKey[]>([]);

  const before = useMemo(() => deriveSheet(build, level), [build, level]);
  const scoresBefore = useMemo(() => finalScores(build, level), [build, level]);
  const isBoon = steps.includes("boon");
  const hasAsi = steps.includes("asi");
  const feat: FeatPick | undefined = featId ? {
    id: featId, ...(featAbility ? { ability: featAbility } : {}), ...(featId === "skilled" ? { skills: featSkills } : {}), ...(featId === "magicInitiate" && featList ? { list: featList } : {}),
  } : undefined;
  const asi = asiKind === "scores" && picks.length ? Object.fromEntries(picks.map((key) => [key, spread === "plus2" ? 2 : 1])) as LevelUpChoice["asi"] : undefined;
  const choice: LevelUpChoice = {
    level: next,
    ...(hpMode === "roll" ? { hp: rollText === "" ? Number.NaN : Number(rollText) } : {}),
    ...(hasAsi ? (asiKind === "scores" ? { asi } : { feat }) : {}),
    ...(isBoon ? { feat } : {}),
    ...(style ? { fightingStyle: style } : {}),
    ...(steps.includes("expertise") ? { expertise } : {}),
  };
  const pick: SubclassPick | null = subclass || null;
  const issues = levelUpIssues(build, next, choice, pick);
  const result = issues.length === 0 ? applyLevelUp(build, next, choice, pick) : null;
  const after = useMemo(() => result ? deriveSheet(result, next) : null, [result, next]);

  const gains = levelGains(build.classId, next, steps.includes("subclass") ? pick : chosenSubclassId(build));
  const pickedSubclass = findSubclass(build.classId, pick);
  const current = flow[position];
  const blocked = current !== "overview" && current !== "review" && issues.includes(current);
  const last = position === flow.length - 1;
  const conModifier = abilityModifier(scoresBefore.con);
  const hpGain = Math.max(1, (choice.hp ?? averageHitDie(cls.hitDie)) + conModifier) + (species?.hpPerLevel ?? 0);
  const abilityName = (key: AbilityKey) => translate(locale, `ability.${key}`);
  const slotText = (slots: number[]) => slots.map((count, index) => `${locale === "es" ? "Nv" : "Lv"} ${index + 1}: ${count}`).join(" · ");

  function toggleAbility(key: AbilityKey) {
    const limit = spread === "plus2" ? 1 : 2;
    setPicks((currentPicks) => currentPicks.includes(key) ? currentPicks.filter((item) => item !== key) : [...currentPicks, key].slice(-limit));
  }
  function chooseFeat(id: LevelFeatId) {
    setFeatId(id); setFeatSkills([]); setFeatList(null);
    const options = featInfo(id).abilities;
    setFeatAbility(options?.length === 1 ? options[0] : null);
  }
  function chooseKind(kind: "scores" | "feat") { setAsiKind(kind); setFeatId(null); setFeatAbility(null); setPicks([]); }

  const abilityChooser = (options: AbilityKey[], cap: number, selected: AbilityKey | null, onPick: (key: AbilityKey) => void) =>
    <div className={own.abilityPick}>{options.map((key) => {
      const full = scoresBefore[key] >= cap;
      return <Choice key={key} selected={selected === key} disabled={full} onClick={() => onPick(key)}>
        <strong>{abilityName(key)}</strong><small>{scoresBefore[key]} → {Math.min(cap, scoresBefore[key] + 1)}</small>{full && <em>{c.capped}</em>}</Choice>;
    })}</div>;

  const reviewRows: [string, ReactNode][] = [];
  if (result && after && before) {
    reviewRows.push([c.rows.level, `${level} → ${next}`]);
    reviewRows.push([c.rows.hp, `${before.hitPoints} → ${after.hitPoints} (+${after.hitPoints - before.hitPoints})`]);
    if (after.proficiency !== before.proficiency) reviewRows.push([c.rows.proficiency, `${signed(before.proficiency)} → ${signed(after.proficiency)}`]);
    if (after.armorClass !== before.armorClass) reviewRows.push([c.rows.ac, `${before.armorClass} → ${after.armorClass}`]);
    const changed = abilities.filter(({ key }) => after.scores[key] !== before.scores[key]).map(({ key }) => `${abilityName(key)} ${before.scores[key]} → ${after.scores[key]}`);
    if (changed.length) reviewRows.push([c.rows.scores, changed.join(" · ")]);
    if (steps.includes("subclass")) reviewRows.push([c.rows.subclass, subclassLabel(result, next, locale)]);
    const taken = isBoon || (hasAsi && asiKind === "feat") ? result.levelUps?.find((entry) => entry.level === next)?.feat : undefined;
    if (taken) reviewRows.push([c.rows.feat, say(featInfo(taken.id).name, locale)]);
    if (choice.fightingStyle && steps.includes("fightingStyle")) reviewRows.push([c.rows.style, say(featInfo(choice.fightingStyle).name, locale)]);
    if (steps.includes("expertise") && expertise.length) reviewRows.push([c.rows.expertise, expertise.map((skill) => translate(locale, `skill.${skill}`)).join(" · ")]);
  }

  return <section className={styles.wizard} aria-labelledby="levelup-title">
    <header className={styles.head}>
      <div><p className={styles.kicker}>{c.kicker} · {c.stepOf(position + 1, flow.length)}</p><h2 id="levelup-title">{c.title(name || "—", next)}</h2></div>
      <button type="button" className={styles.close} onClick={onCancel} aria-label={c.close}>×</button>
    </header>
    <ol className={own.progress} aria-label={c.stepOf(position + 1, flow.length)}>{flow.map((step, index) =>
      <li key={step} className={`${index === position ? own.current : ""} ${index < position ? own.done : ""}`} aria-current={index === position ? "step" : undefined}><span>{index < position ? "✓" : index + 1}</span>{c.steps[step]}</li>)}</ol>

    <div className={styles.body}>
      {current === "overview" && <>
        <p className={styles.intro}>{c.reassure}</p>
        <div className={own.cards}>
          <article className={own.card}><h3>{c.proficiency}</h3>{gains.proficiency
            ? <p className={own.big}>{signed(gains.proficiency.from)} → <b>{signed(gains.proficiency.to)}</b></p>
            : <p className={own.big}>{before ? signed(before.proficiency) : ""}</p>}<p>{c.proficiencyHelp}</p></article>
          {gains.scaling.length > 0 && <article className={own.card}><h3>{c.numbers}</h3><ul className={own.changes}>{gains.scaling.map((change) =>
            <li key={change.label.en}><span>{say(change.label, locale)}</span><b>{change.from ? `${change.from} → ` : ""}{change.to}</b></li>)}</ul></article>}
          {gains.spells && <article className={own.card}><h3>{c.spellsTitle}</h3><ul className={own.changes}>
            {gains.spells.after.cantrips > 0 && <li><span>{c.cantrips}</span><b>{gains.spells.before && gains.spells.before.cantrips !== gains.spells.after.cantrips ? `${gains.spells.before.cantrips} → ` : ""}{gains.spells.after.cantrips}</b></li>}
            <li><span>{c.prepared}</span><b>{gains.spells.before && gains.spells.before.prepared !== gains.spells.after.prepared ? `${gains.spells.before.prepared} → ` : ""}{gains.spells.after.prepared}</b></li>
            <li><span>{c.slots}</span><b>{gains.spells.after.pact ? c.pact(gains.spells.after.pact.count, gains.spells.after.pact.level) : slotText(gains.spells.after.slots)}</b></li>
          </ul><p>{c.spellHint}{build.classId === "wizard" ? ` ${c.spellbookHint}` : ""}</p></article>}
        </div>
        <h3 className={own.heading}>{c.newFeatures}</h3>
        {gains.features.length ? <FeatureList items={gains.features} locale={locale} /> : <p className={styles.note}>{c.noFeatures}</p>}
        {steps.some((step) => step !== "hp") && <p className={own.ahead}>{c.choicesAhead} {steps.filter((step) => step !== "hp").map((step) => c.aheadNames[step]).join(", ")}.</p>}
      </>}

      {current === "hp" && <>
        <p className={styles.intro}>{c.hpIntro}</p>
        <div className={styles.cardGrid}>
          <Choice selected={hpMode === "average"} onClick={() => setHpMode("average")}>
            <strong>{c.hpAverage} · +{Math.max(1, averageHitDie(cls.hitDie) + conModifier) + (species?.hpPerLevel ?? 0)}</strong><small>{c.recommended.toUpperCase()}</small><em>{c.hpAverageHelp}</em></Choice>
          <Choice selected={hpMode === "roll"} onClick={() => setHpMode("roll")}>
            <strong>{c.hpRoll} · d{cls.hitDie}</strong><em>{c.hpRollHelp}</em></Choice>
        </div>
        {hpMode === "roll" && <div className={styles.inline}>
          <label className={styles.field}>{c.rollLabel(cls.hitDie)}<input type="number" min={1} max={cls.hitDie} value={rollText} onChange={(event) => setRollText(event.target.value)} /></label>
          <button type="button" className="button button-quiet" onClick={() => setRollText(String(1 + Math.floor(Math.random() * cls.hitDie)))}>🎲 {c.rollFor}</button>
        </div>}
        {!issues.includes("hp") && <p className={own.callout}>{c.hpGain(hpGain)}</p>}
      </>}

      {current === "subclass" && <>
        <p className={styles.intro}>{c.subclassIntro}</p>
        <div className={styles.cardGrid}>
          {subclassesFor(build.classId).map((entry) => {
            return <Choice key={entry.id} selected={subclass === entry.id} onClick={() => setSubclass(entry.id)}><strong>{say(entry.name, locale)}</strong>
              <small>{(entry.srd ? c.subclassSrd : c.subclassBook).toUpperCase()}</small><em>{say(entry.pitch, locale)}</em></Choice>;
          })}
        </div>
        {pickedSubclass && <div className={styles.detail}><h3>{say(pickedSubclass.name, locale)}</h3><p className={styles.note}>{c.subclassAt(next)}</p>
          <FeatureList items={subclassProgression(build.classId, pickedSubclass.id)[next] ?? []} locale={locale} /></div>}
      </>}

      {current === "asi" && <>
        <p className={styles.intro}>{c.asiIntro}</p>
        <div className={styles.cardGrid}>
          <Choice selected={asiKind === "scores"} onClick={() => chooseKind("scores")}><strong>{c.asiScores}</strong><small>{c.recommended.toUpperCase()}</small><em>{c.asiScoresHelp}</em></Choice>
          <Choice selected={asiKind === "feat"} onClick={() => chooseKind("feat")}><strong>{c.asiFeat}</strong><em>{c.asiFeatHelp}</em></Choice>
        </div>
        {asiKind === "scores" && <>
          <div className={own.tabs}>
            <Choice selected={spread === "plus2"} onClick={() => { setSpread("plus2"); setPicks([]); }}><strong>{c.plus2}</strong></Choice>
            <Choice selected={spread === "plus1"} onClick={() => { setSpread("plus1"); setPicks([]); }}><strong>{c.plus1}</strong></Choice>
          </div>
          <p className={styles.note}>{spread === "plus2" ? c.pickOne : c.pickTwo}</p>
          <div className={own.abilityPick}>{abilities.map(({ key }) => {
            const amount = spread === "plus2" ? 2 : 1;
            const full = scoresBefore[key] + amount > 20;
            const chosen = picks.includes(key);
            return <Choice key={key} selected={chosen} disabled={full} onClick={() => toggleAbility(key)}>
              <strong>{abilityName(key)}</strong><small>{scoresBefore[key]} → {Math.min(20, scoresBefore[key] + (chosen ? amount : 0))}{chosen ? "" : ` (+${amount})`}</small>
              {cls.primary.includes(key) && <em>{c.recommendedAbility}</em>}{full && <em>{c.capped}</em>}</Choice>;
          })}</div>
        </>}
        {asiKind === "feat" && <>
          <h3 className={own.heading}>{c.featPick}</h3>
          <div className={styles.cardGrid}>{asiFeatOptions(build, next).map(({ id, blocked: unavailable }) => <Choice key={id} selected={featId === id} disabled={unavailable} onClick={() => chooseFeat(id)}>
            <strong>{say(featInfo(id).name, locale)}</strong><em>{say(featInfo(id).summary, locale)}</em>{unavailable && <small>{c.featBlocked}</small>}</Choice>)}</div>
          {featId && featInfo(featId).abilities && <><h3 className={own.heading}>{c.pickFeatAbility}</h3>{abilityChooser(featInfo(featId).abilities!, 20, featAbility, setFeatAbility)}</>}
          {featId === "magicInitiate" && <><h3 className={own.heading}>{c.pickList}</h3><div className={styles.cardGrid}>{(Object.keys(magicInitiateLists) as MagicInitiateList[]).map((list) =>
            <Choice key={list} selected={featList === list} onClick={() => setFeatList(list)}><strong>{say(magicInitiateLists[list], locale)}</strong></Choice>)}</div></>}
          {featId === "skilled" && <><h3 className={own.heading}>{c.pickFeatSkills}</h3><SkillChecks options={skillKeys.filter((skill) => !before?.skills[skill].proficient)} chosen={featSkills} limit={3} onChange={setFeatSkills} locale={locale} /></>}
        </>}
      </>}

      {current === "boon" && <>
        <p className={styles.intro}>{c.boonIntro}</p>
        <div className={styles.cardGrid}>{epicBoons.map((id) => <Choice key={id} selected={featId === id} onClick={() => chooseFeat(id)}>
          <strong>{say(featInfo(id).name, locale)}</strong><em>{say(featInfo(id).summary, locale)}</em></Choice>)}</div>
        {featId && <><h3 className={own.heading}>{c.boonAbility}</h3>{abilityChooser(featInfo(featId).abilities ?? [], 30, featAbility, setFeatAbility)}</>}
      </>}

      {current === "fightingStyle" && <>
        <p className={styles.intro}>{c.styleIntro}</p>
        <div className={styles.cardGrid}>{fightingStyles.map((id) => <Choice key={id} selected={style === id} onClick={() => setStyle(id)}>
          <strong>{say(featInfo(id).name, locale)}</strong>{id === "defense" && <small>{c.recommended.toUpperCase()}</small>}<em>{say(featInfo(id).summary, locale)}</em></Choice>)}</div>
        <p className={styles.note}>{c.styleHint}</p>
      </>}

      {current === "expertise" && (() => {
        const grant = expertiseFor(build, next);
        const options = expertiseOptions(build, next);
        const limit = Math.min(grant?.count ?? 0, options.length);
        return <>
          <p className={styles.intro}>{c.expertiseIntro(grant?.count ?? 0)}</p>
          {options.length ? <SkillChecks options={options} chosen={expertise} limit={limit} onChange={setExpertise} locale={locale} /> : <p className={styles.note}>{c.expertiseNone}</p>}
        </>;
      })()}

      {current === "review" && <>
        <p className={styles.intro}>{c.reviewIntro}</p>
        <dl className={own.review}>{reviewRows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
        {(gains.features.length > 0 || gains.subclassFeatures.length > 0) && <>
          <h3 className={own.heading}>{c.newFeatures}</h3>
          <FeatureList items={[...gains.features, ...gains.subclassFeatures]} locale={locale} />
        </>}
      </>}
    </div>

    <footer className={styles.foot}>
      <span className={styles.issues} role="status">{blocked ? c.issues[current] : ""}</span>
      <button type="button" className="button button-quiet" onClick={position ? () => setPosition(position - 1) : onCancel}>{position ? `‹ ${c.back}` : c.cancel}</button>
      {last
        ? <button type="button" className="button button-primary" disabled={!result} onClick={() => result && onSave({ level: next, build: result })}>✦ {c.confirm}</button>
        : <button type="button" className="button button-primary" disabled={blocked} onClick={() => setPosition(position + 1)}>{c.next} ›</button>}
    </footer>
  </section>;
}

function SkillChecks({ options, chosen, limit, onChange, locale }: { options: SkillKey[]; chosen: SkillKey[]; limit: number; onChange: (next: SkillKey[]) => void; locale: Locale }) {
  return <div className={styles.skillGrid}>{options.map((skill) => {
    const isChosen = chosen.includes(skill);
    return <label key={skill} className={`${styles.skill} ${isChosen ? styles.skillOn : ""}`}>
      <input type="checkbox" checked={isChosen} disabled={!isChosen && chosen.length >= limit}
        onChange={(event) => onChange(event.target.checked ? [...chosen, skill] : chosen.filter((item) => item !== skill))} />
      <span>{translate(locale, `skill.${skill}`)}</span>
    </label>;
  })}</div>;
}

export const levelUpAvailable = (level: number) => level < MAX_LEVEL;
