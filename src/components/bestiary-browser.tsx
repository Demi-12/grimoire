"use client";

import { useEffect, useState } from "react";
import { fetchMonster, fetchMonsterCatalog, inferMonsterRoles, type MonsterListEntry } from "@/lib/monster-api";
import MonsterSheet from "@/components/monster-sheet";
import styles from "./bestiary-browser.module.css";

type Locale = "en" | "es";
type Props = { locale?: Locale; onAddCreature?: (creature: { id: string; name: string; xp: number; source: string; roleTags: ReturnType<typeof inferMonsterRoles>; monsterSlug: string }) => void };
type BrowserCopy = {
  title: string; subtitle: string; search: string; searchPlaceholder: string; rating: string; allRatings: string;
  loading: string; retry: string; errorTitle: string; count: (count: number) => string; noResults: string;
    select: string; selected: string; add: string; added: string; previous: string; next: string; page: (current: number, total: number) => string;
  ratingLabel: (rating: string) => string;
};
const PAGE_SIZE = 12;
const ratings = ["0", "0.125", "0.25", "0.5", ...Array.from({ length: 30 }, (_, index) => String(index + 1))];

const copy = {
  en: {
    title: "The Bestiary", subtitle: "Browse the creatures of the 2024 SRD and open their field notes. Names and stat block text are currently in English.",
    search: "Search creatures", searchPlaceholder: "Try “owlbear” or “dragon”…", rating: "Challenge rating", allRatings: "All ratings",
    loading: "The archivist is opening the bestiary…", retry: "Retry", errorTitle: "The bestiary is out of reach.",
    count: (count: number) => `${count} creatures`, noResults: "No creatures match those runes.", select: "Open stat block", selected: "Selected", add: "Add to encounter list", added: "Added to encounter list",
    previous: "Previous", next: "Next", page: (current: number, total: number) => `Page ${current} of ${total}`,
    ratingLabel: (rating: string) => rating === "0.125" ? "1/8" : rating === "0.25" ? "1/4" : rating === "0.5" ? "1/2" : rating,
  },
  es: {
    title: "El Bestiario", subtitle: "Explora las criaturas del SRD 2024. La interfaz está en español, pero los nombres y las fichas se ofrecen en inglés.",
    search: "Buscar criaturas", searchPlaceholder: "Busca «owlbear» o «dragon»…", rating: "Valor de desafío", allRatings: "Todos",
    loading: "El archivero está abriendo el bestiario…", retry: "Reintentar", errorTitle: "El bestiario no está disponible.",
    count: (count: number) => `${count} criaturas`, noResults: "Ninguna criatura coincide con esos símbolos.", select: "Abrir ficha", selected: "Elegido", add: "Añadir al catálogo de encuentros", added: "Añadido al catálogo de encuentros",
    previous: "Anterior", next: "Siguiente", page: (current: number, total: number) => `Página ${current} de ${total}`,
    ratingLabel: (rating: string) => rating === "0.125" ? "1/8" : rating === "0.25" ? "1/4" : rating === "0.5" ? "1/2" : rating,
  },
} satisfies Record<Locale, BrowserCopy>;

export default function BestiaryBrowser({ locale = "en", onAddCreature }: Props) {
  const t = copy[locale];
  const [rating, setRating] = useState("");
  const [query, setQuery] = useState("");
  const [catalog, setCatalog] = useState<MonsterListEntry[]>([]);
  const [catalogCount, setCatalogCount] = useState(0);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retryCount, setRetryCount] = useState(0);
  const [adding, setAdding] = useState(false);
  const [addedSlug, setAddedSlug] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    fetchMonsterCatalog({ challengeRating: rating, search: query, page, limit: PAGE_SIZE }, controller.signal).then((result) => {
      setCatalog(result.results);
      setCatalogCount(result.count);
    }).catch((cause: unknown) => {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Request failed");
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [rating, query, page, retryCount]);
  const pageCount = Math.max(1, Math.ceil(catalogCount / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const countText = t.count as (count: number) => string;
  const pageText = t.page as (current: number, total: number) => string;
  const ratingText = t.ratingLabel as (rating: string) => string;

  function changeQuery(value: string) { setQuery(value); setPage(1); }

  return <section className={styles.explorer} aria-labelledby="bestiary-heading">
    <header className={styles.header}>
      <p className={styles.kicker}>✦ &nbsp; D&amp;D 5e · 2024 SRD</p>
      <h2 id="bestiary-heading">{t.title}</h2>
      <p>{t.subtitle}</p>
    </header>

    <div className={styles.controls}>
      <label className={styles.searchField}>
        <span>{t.search}</span>
        <input type="search" value={query} onChange={(event) => changeQuery(event.target.value)} placeholder={t.searchPlaceholder} />
      </label>
      <label className={styles.ratingField}>
        <span>{t.rating}</span>
        <select value={rating} onChange={(event) => setRating(event.target.value)}>
          <option value="">{t.allRatings}</option>
          {ratings.map((value) => <option key={value} value={value}>{ratingText(value)}</option>)}
        </select>
      </label>
    </div>

    {loading ? <div className={styles.status} role="status">{t.loading}</div>
      : error ? <div className={styles.error} role="alert"><strong>{t.errorTitle}</strong><p>{error}</p><button type="button" onClick={() => setRetryCount((count) => count + 1)}>{t.retry}</button></div>
      : <>
        <div className={styles.resultsHeader}><span>{countText(catalogCount)}{rating ? ` · CR ${ratingText(rating)}` : ""}</span><small>SRD 5.2 · API</small></div>
        {catalog.length ? <div className={styles.list}>
          {catalog.map((creature) => {
            const active = selectedSlug === creature.index;
            return <button className={`${styles.creature} ${active ? styles.active : ""}`} type="button" key={creature.index} aria-pressed={active} onClick={() => setSelectedSlug(creature.index)}>
              <span className={styles.sigle}>✧</span><span className={styles.creatureName}>{creature.name}<small>{creature.index}</small></span><span className={styles.action}>{active ? t.selected : t.select} <b>›</b></span>
            </button>;
          })}
        </div> : <div className={styles.empty}>{t.noResults}</div>}
        {catalogCount > PAGE_SIZE && <nav className={styles.pagination} aria-label={locale === "es" ? "Paginación del bestiario" : "Bestiary pagination"}>
          <button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={currentPage <= 1}>‹ {t.previous}</button>
          <span>{pageText(currentPage, pageCount)}</span>
          <button type="button" onClick={() => setPage((current) => current + 1)} disabled={currentPage >= pageCount}>{t.next} ›</button>
        </nav>}
      </>}

    {selectedSlug && <div className={styles.sheet}>
      <MonsterSheet monsterSlug={selectedSlug} locale={locale} />
      {onAddCreature && <button type="button" className="button button-primary" disabled={adding || addedSlug === selectedSlug} onClick={async () => {
        setAdding(true);
        try {
          const monster = await fetchMonster(selectedSlug);
          if (typeof monster.xp === "number" && monster.xp > 0) {
            onAddCreature({ id: `srd-${selectedSlug}`, name: monster.name, xp: monster.xp, source: "D&D 2024 SRD", roleTags: inferMonsterRoles(monster), monsterSlug: selectedSlug });
            setAddedSlug(selectedSlug);
          }
        } finally { setAdding(false); }
      }}>{adding ? (locale === "es" ? "Añadiendo…" : "Adding…") : addedSlug === selectedSlug ? t.added : t.add}</button>}
    </div>}
  </section>;
}
