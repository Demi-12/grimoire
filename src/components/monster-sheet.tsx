"use client";

import { Skeleton, SkeletonRegion, SkeletonText } from "./skeleton";
import { useEffect, useState } from "react";
import { translateAbility, translateTerms } from "@/lib/monster-i18n";
import { fetchMonster, srdLabel, type MonsterAction, type MonsterStatBlock } from "@/lib/monster-api";
import styles from "./monster-sheet.module.css";

type Locale = "en" | "es";
type Props = { monsterSlug?: string | null; locale?: Locale; /** Render this stat block directly (editor preview) instead of fetching one by slug. */ monster?: MonsterStatBlock };

const labels = {
  en: { source: "D&D 5e", loading: "Consulting the bestiary…", empty: "Choose a creature to reveal its stat block.", error: "The bestiary could not be opened.", retry: "Try again", noImage: "No illustration available", hp: "Hit Points", ac: "Armor Class", cr: "Challenge", abilities: "Ability Scores", traits: "Traits", actions: "Actions", reactions: "Reactions", legendary: "Legendary Actions", defenses: "Defenses", saves: "Saving Throws", senses: "Senses", languages: "Languages", prof: "Proficiency" },
  es: { source: "D&D 5e", loading: "Consultando el bestiario…", empty: "Elige una criatura para revelar su ficha.", error: "No se ha podido abrir el bestiario.", retry: "Reintentar", noImage: "Sin ilustración disponible", hp: "Puntos de golpe", ac: "Clase de armadura", cr: "Desafío", abilities: "Características", traits: "Rasgos", actions: "Acciones", reactions: "Reacciones", legendary: "Acciones legendarias", defenses: "Defensas", saves: "Tiradas de salvación", senses: "Sentidos", languages: "Idiomas", prof: "Competencia" },
} satisfies Record<Locale, Record<string, string>>;

const abilityNames = { en: ["STR", "DEX", "CON", "INT", "WIS", "CHA"], es: ["FUE", "DES", "CON", "INT", "SAB", "CAR"] };
const abilityKeys = ["strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma"] as const;
const modifier = (score: number) => `${score >= 10 ? "+" : ""}${Math.floor((score - 10) / 2)}`;
const textOf = (description?: string | string[]) => Array.isArray(description) ? description.join("\n") : description ?? "";

function traitList(title: string, items: MonsterAction[] | undefined) {
  if (!items?.length) return null;
  return <section className={styles.section}><h3 className={styles.sectionTitle}>{title}</h3>{items.map((item, index) => <article className={styles.trait} key={`${item.name ?? title}-${index}`}><strong>{item.name}</strong>{item.name && ". "}{textOf(item.desc) && <p>{textOf(item.desc)}</p>}</article>)}</section>;
}

const homebrewLabel = (locale: Locale, owner: string) => (locale === "es" ? `Homebrew · de ${owner}` : `Homebrew · by ${owner}`);

const IMAGE_HOST = "https://www.dnd5eapi.co";

function MonsterPortrait({ monster, label }: { monster: MonsterStatBlock; label: string }) {
  const [failed, setFailed] = useState(false);
  if (monster.image && !failed) {
    return <figure className={styles.portrait}><img src={`${IMAGE_HOST}${monster.image}`} alt={monster.name} loading="lazy" onError={() => setFailed(true)} /></figure>;
  }
  return <figure className={styles.portrait}><div className={styles.portraitFallback} role="img" aria-label={label}>
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3c-4.4 0-7 2.9-7 6.5 0 2 .8 3.4 2 4.4V17h2v-1.5h1V17h2v-1.5h1V17h2v-3.1c1.2-1 2-2.4 2-4.4C19 5.9 16.4 3 12 3z" /><circle cx="9.5" cy="10" r="1.2" /><circle cx="14.5" cy="10" r="1.2" /><path d="M9 20h6" /></svg>
    <span>{label}</span>
  </div></figure>;
}

function formatArmorClass(value: MonsterStatBlock["armor_class"]) {
  if (typeof value === "number") return String(value);
  if (!Array.isArray(value) || !value.length) return "—";
  return value.map((armor) => `${armor.value ?? "?"}${armor.desc ? ` (${armor.desc})` : ""}`).join(" / ");
}

export default function MonsterSheet({ monsterSlug, locale = "en", monster: given }: Props) {
  const t = labels[locale];
  const [fetched, setMonster] = useState<MonsterStatBlock | null>(null);
  const monster = given ?? fetched;
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (given || !monsterSlug) { setMonster(null); setError(""); return; }
    const controller = new AbortController();
    setMonster(null);
    setError("");
    fetchMonster(monsterSlug, controller.signal).then(setMonster).catch((cause: unknown) => {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : t.error);
    });
    return () => controller.abort();
  }, [monsterSlug, given, attempt, t.error]);

  if (!given && !monsterSlug) return <div className={styles.empty}>{t.empty}</div>;
  if (error && !given) return <div className={styles.error} role="alert">{t.error}<p>{error}</p><button type="button" onClick={() => setAttempt((n) => n + 1)}>{t.retry}</button></div>;
  if (!monster) return <SkeletonRegion label={t.loading} className={styles.loading}><Skeleton width="55%" height={30} /><SkeletonText lines={2} /><div className="skeleton-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)", margin: "14px 0" }}>{[0, 1, 2, 3, 4, 5].map((item) => <Skeleton key={item} height={44} />)}</div><SkeletonText lines={4} /></SkeletonRegion>;

  const speed = Object.entries(monster.speed ?? {}).filter(([, value]) => value).map(([kind, value]) => `${translateTerms("speed", kind, locale)} ${translateTerms("speed", String(value), locale)}`).join(", ");
  const ac = formatArmorClass(monster.armor_class);
  const saves = monster.proficiencies?.filter((item) => item.proficiency?.name?.toLowerCase().includes("saving throw"));
  const defenses = [
    ...(monster.damage_vulnerabilities?.length ? [`${locale === "es" ? "Vulnerabilidad" : "Vulnerabilities"}: ${translateTerms("damage", monster.damage_vulnerabilities.join(", "), locale)}`] : []),
    ...(monster.damage_resistances?.length ? [`${locale === "es" ? "Resistencias" : "Resistances"}: ${translateTerms("damage", monster.damage_resistances.join(", "), locale)}`] : []),
    ...(monster.damage_immunities?.length ? [`${locale === "es" ? "Inmunidades al daño" : "Damage Immunities"}: ${translateTerms("damage", monster.damage_immunities.join(", "), locale)}`] : []),
    ...(monster.condition_immunities?.length ? [`${locale === "es" ? "Inmunidades a estados" : "Condition Immunities"}: ${translateTerms("condition", monster.condition_immunities.map((item) => item.name).filter(Boolean).join(", "), locale)}`] : []),
  ];

  return <article className={styles.frame} aria-label={`${monster.name} stat block`}>
    <header className={styles.header}><p className={styles.eyebrow}>{monster.homebrew ? homebrewLabel(locale, monster.homebrew.ownerName) : `${t.source} · ${srdLabel(monster.edition)}`}</p><h2 className={styles.name}>{monster.name}</h2><p className={styles.kind}>{[translateTerms("size", monster.size, locale), translateTerms("type", monster.type, locale), translateTerms("alignment", monster.alignment, locale)].filter(Boolean).join(" · ")}</p></header>
    <MonsterPortrait monster={monster} label={t.noImage} />
    <div className={styles.quickStats}>
      <div><span>{t.ac}</span><strong>{ac}</strong></div>
      <div><span>{t.hp}</span><strong>{monster.hit_points ?? "—"}</strong>{monster.hit_dice && <small>({monster.hit_dice})</small>}</div>
      <div><span>{t.cr}</span><strong>{monster.challenge_rating ?? "—"}</strong>{monster.xp != null && <small>{monster.xp.toLocaleString(locale)} XP</small>}</div>
    </div>
    <section className={styles.section}><h3 className={styles.sectionTitle}>{t.abilities}</h3><div className={styles.abilities}>{abilityKeys.map((key, index) => { const score = monster[key]; return <div className={styles.ability} key={key}><span>{abilityNames[locale][index]}</span><b>{score ?? "—"}</b>{score != null && <small>{modifier(score)}</small>}</div>; })}</div></section>
    <div className={styles.facts}>
      {speed && <p><b>{locale === "es" ? "Velocidad" : "Speed"}</b> {speed}</p>}
      {!!saves?.length && <p><b>{t.saves}</b> {saves.map((item) => { const value = item.value ?? 0; return `${translateAbility(item.proficiency?.name?.replace(/^Saving Throw:\s*/i, "") ?? "", locale)} ${value >= 0 ? "+" : ""}${value}`; }).join(", ")}</p>}
      {!!defenses.length && <p><b>{t.defenses}</b> {defenses.join(" · ")}</p>}
      {monster.senses && <p><b>{t.senses}</b> {Object.entries(monster.senses).filter(([, value]) => value).map(([key, value]) => `${translateTerms("sense", key, locale).replaceAll("_", " ")} ${translateTerms("sense", String(value), locale)}`).join(", ")}</p>}
      {monster.languages && <p><b>{t.languages}</b> {translateTerms("language", monster.languages, locale)}</p>}
      {monster.proficiency_bonus != null && <p><b>{t.prof}</b> +{monster.proficiency_bonus}</p>}
    </div>
    {traitList(t.traits, monster.special_abilities)}
    {traitList(t.actions, monster.actions)}
    {traitList(t.reactions, monster.reactions)}
    {traitList(t.legendary, monster.legendary_actions)}
    {monster.homebrew ? <p className={styles.legal}>{locale === "es" ? "Contenido homebrew creado por los usuarios de este servidor; no forma parte del SRD ni está avalado por Wizards of the Coast." : "Homebrew content made by users of this server; it is not part of the SRD and is not endorsed by Wizards of the Coast."}</p> : <>
    <p className={styles.source}>{t.source} · {srdLabel(monster.edition)} · {monster.index ?? monsterSlug}</p>
    <p className={styles.legal}>
      {monster.edition === "2014"
        ? <>This work includes material from the <a href="https://dnd.wizards.com/resources/systems-reference-document" target="_blank" rel="noreferrer">System Reference Document 5.1 (“SRD 5.1”)</a> by Wizards of the Coast LLC. The SRD 5.1 is licensed under <a href="https://creativecommons.org/licenses/by/4.0/legalcode" target="_blank" rel="noreferrer">CC-BY-4.0</a>.</>
        : <>This work includes material from the <a href="https://www.dndbeyond.com/srd" target="_blank" rel="noreferrer">System Reference Document 5.2 (“SRD 5.2”)</a> by Wizards of the Coast LLC, available at D&amp;D Beyond. The SRD 5.2 is licensed under <a href="https://creativecommons.org/licenses/by/4.0/legalcode" target="_blank" rel="noreferrer">CC-BY-4.0</a>.</>}
    </p>
    </>}
  </article>;
}
