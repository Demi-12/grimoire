"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Character } from "@/lib/api-client";
import { attackList } from "@/lib/character-sheet";
import { featureList, sheetFor, signed, speciesTraits, characterIdentity } from "@/lib/character-view";
import { say, type Feature } from "@/lib/dnd2024";
import { translate } from "@/lib/i18n";
import { fetchMonsterCatalog, type MonsterListEntry } from "@/lib/monster-api";
import { abilities, abilityModifier } from "@/lib/rules";
import type { MapOp, MapToken } from "@/lib/battle-map";
import MonsterSheet from "./monster-sheet";
import { Spinner } from "./skeleton";
import { formatDistance, type Locale } from "./battle-map-combat";
import { bm as styles } from "./battle-map-styles";

const text = {
  en: {
    sheet: "Sheet", close: "Close the sheet", fullSheet: "Open the full sheet", loading: "Opening the sheet…",
    noCharacter: "This character's sheet couldn't be loaded.",
    noStatBlock: "This monster isn't linked to a bestiary creature, so there's no stat block to show.",
    link: "Link it to a bestiary creature", search: "Search the bestiary", searching: "Searching…", noResults: "No creature by that name.",
    pick: (name: string) => `Use ${name}`, unlink: "Use another creature",
    saves: "Saves", features: "Class features", traits: "Species traits", notes: "Notes", owner: (name: string) => `Player: ${name}`,
  },
  es: {
    sheet: "Ficha", close: "Cerrar la ficha", fullSheet: "Abrir la ficha completa", loading: "Abriendo la ficha…",
    noCharacter: "No se pudo cargar la ficha de este personaje.",
    noStatBlock: "Este monstruo no está enlazado a una criatura del bestiario, así que no hay ficha que mostrar.",
    link: "Enlazarlo a una criatura del bestiario", search: "Buscar en el bestiario", searching: "Buscando…", noResults: "Ninguna criatura con ese nombre.",
    pick: (name: string) => `Usar ${name}`, unlink: "Usar otra criatura",
    saves: "Salvaciones", features: "Rasgos de clase", traits: "Rasgos de especie", notes: "Notas", owner: (name: string) => `Jugador: ${name}`,
  },
};

/** The sheet of the token picked on the map: a hero's character or a monster's stat block, next to the board. */
export default function TokenSheet({ token, character, charactersLoaded, isDm, locale, send, onClose }: {
  token: MapToken; character?: Character; charactersLoaded: boolean; isDm: boolean; locale: Locale;
  send: (ops: MapOp[]) => Promise<void>; onClose: () => void;
}) {
  const t = text[locale];
  const [relinking, setRelinking] = useState(false);
  useEffect(() => setRelinking(false), [token.id]);
  let body;
  if (token.kind === "hero") {
    body = character ? <HeroSheet character={character} locale={locale} />
      : charactersLoaded ? <p className={styles.empty}>{t.noCharacter}</p> : <p className={styles.empty}><Spinner /> {t.loading}</p>;
  } else if (token.monsterSlug && !relinking) {
    body = <>
      <div className={styles.monsterSheet}><MonsterSheet monsterSlug={token.monsterSlug} locale={locale} compact /></div>
      {isDm && <button type="button" className={styles.smallButton} onClick={() => setRelinking(true)}>{t.unlink}</button>}
    </>;
  } else {
    body = <>
      {!token.monsterSlug && <p className={styles.empty}>{t.noStatBlock}</p>}
      {isDm && <BestiaryLink token={token} locale={locale} onPick={(slug) => { setRelinking(false); void send([{ type: "update", tokenId: token.id, monsterSlug: slug }]); }} />}
    </>;
  }
  return <section className={styles.sheet} aria-label={`${t.sheet}: ${token.label}`}>
    <div className={styles.sheetHead}>
      <h2>{t.sheet} · {token.label}</h2>
      <button type="button" className={styles.smallButton} aria-label={t.close} title={t.close} onClick={onClose}>×</button>
    </div>
    <div className={styles.sheetBody}>{body}</div>
  </section>;
}

/** Search the bestiary to give a monster typed in by hand its stat block. */
function BestiaryLink({ token, locale, onPick }: { token: MapToken; locale: Locale; onPick: (slug: string) => void }) {
  const t = text[locale];
  const [query, setQuery] = useState(() => token.label.replace(/\s*\d+$/, ""));
  const [results, setResults] = useState<MonsterListEntry[] | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const search = query.trim();
    if (search.length < 2) { setResults(null); return; }
    const controller = new AbortController();
    setBusy(true);
    const timer = setTimeout(() => {
      fetchMonsterCatalog({ search, limit: 8 }, controller.signal)
        .then((catalog) => setResults(catalog.results.filter((entry) => /^[a-z0-9-]{1,100}$/.test(entry.index))))
        .catch(() => { if (!controller.signal.aborted) setResults([]); })
        .finally(() => { if (!controller.signal.aborted) setBusy(false); });
    }, 300);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query]);
  return <div className={styles.sheetLink}>
    <label className={styles.grow}>{t.link}<input type="search" className={styles.field} value={query} placeholder={t.search} onChange={(event) => setQuery(event.target.value)} /></label>
    {busy ? <p className={styles.empty}><Spinner /> {t.searching}</p> : results && (results.length ? <ul className={styles.list}>
      {results.map((entry) => <li key={entry.index} className={styles.listItem()}>
        <span className={styles.itemName}>{entry.name}{entry.source && <small>{entry.source}</small>}</span>
        <button type="button" className={styles.smallButton} aria-label={t.pick(entry.name)} onClick={() => onPick(entry.index)}>✓</button>
      </li>)}
    </ul> : <p className={styles.empty}>{t.noResults}</p>)}
  </div>;
}

function Features({ title, items, locale }: { title: string; items: Feature[]; locale: Locale }) {
  if (!items.length) return null;
  return <details className={styles.sheetDetails}>
    <summary>{title} <small>({items.length})</small></summary>
    <dl>{items.map((item, index) => <div key={`${item.name.en}-${index}`}><dt>{say(item.name, locale)}</dt>{say(item.tip, locale) && <dd>{say(item.tip, locale)}</dd>}</div>)}</dl>
  </details>;
}

/** What the DM looks up mid-fight: defences, attacks and saves first, the rest folded away. */
function HeroSheet({ character, locale }: { character: Character; locale: Locale }) {
  const tr = (key: string, values?: Record<string, string | number>) => translate(locale, key, values);
  const t = text[locale];
  const sheet = sheetFor(character);
  const build = character.build;
  const attacks = build && sheet ? attackList(build, sheet) : [];
  const identity = characterIdentity(character, locale);
  const subtitle = [identity.species, identity.className, tr("character.levelPill", { level: character.level }).toLocaleLowerCase(locale)].filter(Boolean).join(" · ");
  const vitals: [string, string][] = sheet ? [
    [tr("character.acShort"), String(sheet.armorClass)],
    [tr("character.hpShort"), String(sheet.hitPoints)],
    [tr("character.initShort"), signed(sheet.initiative)],
    [tr("character.speedShort"), formatDistance(Math.round(sheet.speed / 5), locale)],
    [tr("character.passivePerception"), String(sheet.passivePerception)],
    ...(sheet.spellSaveDc ? [[tr("character.spellDc"), String(sheet.spellSaveDc)] as [string, string]] : []),
    ...(sheet.spellAttack !== undefined && sheet.spellSaveDc ? [[tr("character.spellAttack"), signed(sheet.spellAttack)] as [string, string]] : []),
  ] : [];
  return <div className={styles.heroSheet}>
    <p className={styles.heroSub}>{subtitle}<small>{t.owner(character.ownerName)}</small></p>
    {vitals.length > 0 && <dl className={styles.vitals}>{vitals.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>}
    <dl className={styles.scores}>{abilities.map(({ key }) => {
      const score = sheet?.scores[key] ?? character.scores[key];
      const name = tr(`ability.${key}`);
      return <div key={key}><dt><abbr title={name}>{name.slice(0, 3).toLocaleUpperCase(locale)}</abbr></dt><dd>{signed(abilityModifier(score))}<small>{score}</small></dd></div>;
    })}</dl>
    {attacks.length > 0 && <>
      <h3>{tr("character.sheetAttacks")}</h3>
      <ul className={styles.attacks}>{attacks.map((attack, index) => <li key={`${attack.dice}-${index}`}>
        <b>{say(attack.name, locale)}</b> <span>{signed(attack.bonus)}</span>
        <small>{`${attack.dice}${attack.modifier ? signed(attack.modifier) : ""} ${say(attack.type, locale)}`}</small>
      </li>)}</ul>
    </>}
    {sheet && <p className={styles.heroLine}><b>{t.saves}:</b> {abilities.map(({ key }) => `${tr(`ability.${key}`).slice(0, 3)} ${signed(sheet.saves[key].bonus)}${sheet.saves[key].proficient ? "•" : ""}`).join(" · ")}</p>}
    {build && <Features title={t.features} items={featureList(build, character.level)} locale={locale} />}
    {build && <Features title={t.traits} items={speciesTraits(build)} locale={locale} />}
    {character.notes && <p className={styles.heroLine}><b>{t.notes}:</b> {character.notes}</p>}
    <Link className={styles.sheetFull} href={`/characters/${encodeURIComponent(character.id)}`}>{t.fullSheet} →</Link>
  </div>;
}
