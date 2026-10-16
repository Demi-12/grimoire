"use client";

import { useEffect, useState } from "react";
import { fetchMonster, type MonsterAction, type MonsterStatBlock } from "@/lib/monster-api";
import styles from "./monster-sheet.module.css";

type Locale = "en" | "es";
type Props = { monsterSlug?: string | null; locale?: Locale };

const labels = {
  en: { source: "D&D 5e SRD · 2024", loading: "Consulting the bestiary…", empty: "Choose a creature to reveal its stat block.", error: "The bestiary could not be opened.", retry: "Try again", hp: "Hit Points", ac: "Armor Class", cr: "Challenge", abilities: "Ability Scores", traits: "Traits", actions: "Actions", reactions: "Reactions", legendary: "Legendary Actions", defenses: "Defenses", saves: "Saving Throws", senses: "Senses", languages: "Languages", prof: "Proficiency" },
  es: { source: "D&D 5e SRD · 2024", loading: "Consultando el bestiario…", empty: "Elige una criatura para revelar su ficha.", error: "No se ha podido abrir el bestiario.", retry: "Reintentar", hp: "Puntos de golpe", ac: "Clase de armadura", cr: "Desafío", abilities: "Características", traits: "Rasgos", actions: "Acciones", reactions: "Reacciones", legendary: "Acciones legendarias", defenses: "Defensas", saves: "Tiradas de salvación", senses: "Sentidos", languages: "Idiomas", prof: "Competencia" },
} satisfies Record<Locale, Record<string, string>>;

const abilityNames = { en: ["STR", "DEX", "CON", "INT", "WIS", "CHA"], es: ["FUE", "DES", "CON", "INT", "SAB", "CAR"] };
const abilityKeys = ["strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma"] as const;
const modifier = (score: number) => `${score >= 10 ? "+" : ""}${Math.floor((score - 10) / 2)}`;
const textOf = (description?: string | string[]) => Array.isArray(description) ? description.join("\n") : description ?? "";

function traitList(title: string, items: MonsterAction[] | undefined) {
  if (!items?.length) return null;
  return <section className={styles.section}><h3 className={styles.sectionTitle}>{title}</h3>{items.map((item, index) => <article className={styles.trait} key={`${item.name ?? title}-${index}`}><strong>{item.name}</strong>{item.name && ". "}{textOf(item.desc) && <p>{textOf(item.desc)}</p>}</article>)}</section>;
}

function formatArmorClass(value: MonsterStatBlock["armor_class"]) {
  if (typeof value === "number") return String(value);
  if (!Array.isArray(value) || !value.length) return "—";
  return value.map((armor) => `${armor.value ?? "?"}${armor.desc ? ` (${armor.desc})` : ""}`).join(" / ");
}

export default function MonsterSheet({ monsterSlug, locale = "en" }: Props) {
  const t = labels[locale];
  const [monster, setMonster] = useState<MonsterStatBlock | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!monsterSlug) { setMonster(null); setError(""); return; }
    const controller = new AbortController();
    setMonster(null);
    setError("");
    fetchMonster(monsterSlug, controller.signal).then(setMonster).catch((cause: unknown) => {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : t.error);
    });
    return () => controller.abort();
  }, [monsterSlug, attempt, t.error]);

  if (!monsterSlug) return <div className={styles.empty}>{t.empty}</div>;
  if (error) return <div className={styles.error} role="alert">{t.error}<p>{error}</p><button type="button" onClick={() => setAttempt((n) => n + 1)}>{t.retry}</button></div>;
  if (!monster) return <div className={styles.loading} role="status">{t.loading}</div>;

  const speed = Object.entries(monster.speed ?? {}).filter(([, value]) => value).map(([kind, value]) => `${kind} ${value}`).join(", ");
  const ac = formatArmorClass(monster.armor_class);
  const saves = monster.proficiencies?.filter((item) => item.proficiency?.name?.toLowerCase().includes("saving throw"));
  const defenses = [
    ...(monster.damage_vulnerabilities?.length ? [`${locale === "es" ? "Vulnerabilidad" : "Vulnerabilities"}: ${monster.damage_vulnerabilities.join(", ")}`] : []),
    ...(monster.damage_resistances?.length ? [`${locale === "es" ? "Resistencias" : "Resistances"}: ${monster.damage_resistances.join(", ")}`] : []),
    ...(monster.damage_immunities?.length ? [`${locale === "es" ? "Inmunidades al daño" : "Damage Immunities"}: ${monster.damage_immunities.join(", ")}`] : []),
    ...(monster.condition_immunities?.length ? [`${locale === "es" ? "Inmunidades a estados" : "Condition Immunities"}: ${monster.condition_immunities.map((item) => item.name).filter(Boolean).join(", ")}`] : []),
  ];

  return <article className={styles.frame} aria-label={`${monster.name} stat block`}>
    <header className={styles.header}><p className={styles.eyebrow}>{t.source}</p><h2 className={styles.name}>{monster.name}</h2><p className={styles.kind}>{[monster.size, monster.type, monster.alignment].filter(Boolean).join(" · ")}</p></header>
    <div className={styles.quickStats}>
      <div><span>{t.ac}</span><strong>{ac}</strong></div>
      <div><span>{t.hp}</span><strong>{monster.hit_points ?? "—"}</strong>{monster.hit_dice && <small>({monster.hit_dice})</small>}</div>
      <div><span>{t.cr}</span><strong>{monster.challenge_rating ?? "—"}</strong>{monster.xp != null && <small>{monster.xp.toLocaleString(locale)} XP</small>}</div>
    </div>
    <section className={styles.section}><h3 className={styles.sectionTitle}>{t.abilities}</h3><div className={styles.abilities}>{abilityKeys.map((key, index) => { const score = monster[key]; return <div className={styles.ability} key={key}><span>{abilityNames[locale][index]}</span><b>{score ?? "—"}</b>{score != null && <small>{modifier(score)}</small>}</div>; })}</div></section>
    <div className={styles.facts}>
      {speed && <p><b>{locale === "es" ? "Velocidad" : "Speed"}</b> {speed}</p>}
      {!!saves?.length && <p><b>{t.saves}</b> {saves.map((item) => { const value = item.value ?? 0; return `${item.proficiency?.name?.replace(/^Saving Throw:\s*/i, "") ?? ""} ${value >= 0 ? "+" : ""}${value}`; }).join(", ")}</p>}
      {!!defenses.length && <p><b>{t.defenses}</b> {defenses.join(" · ")}</p>}
      {monster.senses && <p><b>{t.senses}</b> {Object.entries(monster.senses).filter(([, value]) => value).map(([key, value]) => `${key.replaceAll("_", " ")} ${value}`).join(", ")}</p>}
      {monster.languages && <p><b>{t.languages}</b> {monster.languages}</p>}
      {monster.proficiency_bonus != null && <p><b>{t.prof}</b> +{monster.proficiency_bonus}</p>}
    </div>
    {traitList(t.traits, monster.special_abilities)}
    {traitList(t.actions, monster.actions)}
    {traitList(t.reactions, monster.reactions)}
    {traitList(t.legendary, monster.legendary_actions)}
    <p className={styles.source}>{t.source} · {monster.index ?? monsterSlug}</p>
    <p className={styles.legal}>
      This work includes material from the <a href="https://www.dndbeyond.com/srd" target="_blank" rel="noreferrer">System Reference Document 5.2 (“SRD 5.2”)</a> by Wizards of the Coast LLC, available at D&amp;D Beyond. The SRD 5.2 is licensed under <a href="https://creativecommons.org/licenses/by/4.0/legalcode" target="_blank" rel="noreferrer">CC-BY-4.0</a>.
    </p>
  </article>;
}
