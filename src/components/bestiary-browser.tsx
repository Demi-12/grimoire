"use client";

import { Skeleton, SkeletonRegion, Spinner } from "./skeleton";
import { useEffect, useState } from "react";
import { fetchMonster, fetchMonsterCatalog, formatChallenge, inferMonsterRoles, sourceLabel, type MonsterListEntry, type SourceSummary } from "@/lib/monster-api";
import HomebrewPanel from "@/components/homebrew-panel";
import MonsterSheet from "@/components/monster-sheet";
import type { Campaign, CatalogCreature, Me } from "@/lib/api-client";

const fieldLabel = "grid gap-1.5";
const fieldCaption = "font-label text-xs font-bold tracking-[.12em] text-muted uppercase";
const list = "grid grid-cols-2 gap-2 max-[600px]:grid-cols-1";
const notice = "rounded-card border border-dashed border-control-line px-4 py-5 text-center text-sm text-muted italic";

type Locale = "en" | "es";
type Props = { locale?: Locale; onAddCreature?: (creature: { id: string; name: string; xp: number; source: string; roleTags: ReturnType<typeof inferMonsterRoles>; monsterSlug: string }) => void };
type BrowserCopy = {
  title: string; subtitle: string; search: string; searchPlaceholder: string; rating: string; allRatings: string; book: string; allBooks: string;
  loading: string; retry: string; errorTitle: string; errorBody: string; count: (count: number) => string; noResults: string;
    select: string; selected: string; add: string; added: string; previous: string; next: string; page: (current: number, total: number) => string;
  ratingLabel: (rating: string) => string;
};
const PAGE_SIZE = 12;
/** Wait this long after the last keystroke before asking the server, so typing "owlbear" is one request, not seven. */
const SEARCH_DEBOUNCE_MS = 250;
const ratings = ["0", "0.125", "0.25", "0.5", ...Array.from({ length: 30 }, (_, index) => String(index + 1))];

const copy = {
  en: {
    title: "The Bestiary", subtitle: "Thousands of creatures from every openly licensed 5e book (the SRD 5.2 and 5.1, Tome of Beasts, Creature Codex, the Level Up Monstrous Menagerie and more), served by Open5e. Names and stat block text are in English.",
    search: "Search creatures", searchPlaceholder: "Try “owlbear” or “dragon”…", rating: "Challenge rating", allRatings: "All ratings", book: "Book", allBooks: "All books",
    loading: "The archivist is opening the bestiary…", retry: "Retry", errorTitle: "The bestiary is out of reach.", errorBody: "Open5e, which serves the creatures, may not be answering right now. Try again in a moment.",
    count: (count: number) => `${count} creatures`, noResults: "No creatures match those runes.", select: "Open stat block", selected: "Selected", add: "Add to encounter list", added: "Added to encounter list",
    previous: "Previous", next: "Next", page: (current: number, total: number) => `Page ${current} of ${total}`,
    ratingLabel: (rating: string) => rating === "0.125" ? "1/8" : rating === "0.25" ? "1/4" : rating === "0.5" ? "1/2" : rating,
  },
  es: {
    title: "El Bestiario", subtitle: "Miles de criaturas de todos los libros de 5e con licencia libre (SRD 5.2 y 5.1, Tome of Beasts, Creature Codex, el Monstrous Menagerie de Level Up y más), servidas por Open5e. Los términos de reglas se traducen, pero los nombres y los textos de rasgos y acciones llegan solo en inglés.",
    search: "Buscar criaturas", searchPlaceholder: "Busca «owlbear» o «dragon»…", rating: "Valor de desafío", allRatings: "Todos", book: "Libro", allBooks: "Todos los libros",
    loading: "El archivero está abriendo el bestiario…", retry: "Reintentar", errorTitle: "El bestiario no está disponible.", errorBody: "Puede que Open5e, que sirve las criaturas, no responda ahora mismo. Vuelve a intentarlo en un momento.",
    count: (count: number) => `${count} criaturas`, noResults: "Ninguna criatura coincide con esos símbolos.", select: "Abrir ficha", selected: "Elegido", add: "Añadir al catálogo de encuentros", added: "Añadido al catálogo de encuentros",
    previous: "Anterior", next: "Siguiente", page: (current: number, total: number) => `Página ${current} de ${total}`,
    ratingLabel: (rating: string) => rating === "0.125" ? "1/8" : rating === "0.25" ? "1/4" : rating === "0.5" ? "1/2" : rating,
  },
} satisfies Record<Locale, BrowserCopy>;

function SrdBestiary({ locale = "en", onAddCreature }: Props) {
  const t = copy[locale];
  const [rating, setRating] = useState("");
  const [book, setBook] = useState("");
  const [sources, setSources] = useState<SourceSummary[]>([]);
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
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
    const timer = setTimeout(() => setSearch(query), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    fetchMonsterCatalog({ challengeRating: rating, source: book, search, page, limit: PAGE_SIZE }, controller.signal).then((result) => {
      setCatalog(result.results);
      setCatalogCount(result.count);
      setSources(result.sources);
    }).catch((cause: unknown) => {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Request failed");
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [rating, book, search, page, retryCount]);
  const pageCount = Math.max(1, Math.ceil(catalogCount / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const countText = t.count as (count: number) => string;
  const pageText = t.page as (current: number, total: number) => string;
  const ratingText = t.ratingLabel as (rating: string) => string;

  function changeQuery(value: string) { setQuery(value); setPage(1); }

  return <section aria-labelledby="bestiary-heading">
    <h2 id="bestiary-heading" className="sr-only">{t.title}</h2>
    <p className="mt-0 mb-4 max-w-[75ch] text-sm leading-normal text-muted">{t.subtitle}</p>

    <div className="panel grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)] items-end gap-3 p-4 max-[760px]:grid-cols-2 max-[760px]:[&>:first-child]:col-span-2 max-[600px]:grid-cols-1 max-[600px]:[&>:first-child]:col-span-1">
      <label className={fieldLabel}>
        <span className={fieldCaption}>{t.search}</span>
        <input type="search" className="field w-full" value={query} onChange={(event) => changeQuery(event.target.value)} placeholder={t.searchPlaceholder} />
      </label>
      <label className={fieldLabel}>
        <span className={fieldCaption}>{t.rating}</span>
        <select className="field w-full" value={rating} onChange={(event) => { setRating(event.target.value); setPage(1); }}>
          <option value="">{t.allRatings}</option>
          {ratings.map((value) => <option key={value} value={value}>{ratingText(value)}</option>)}
        </select>
      </label>
      <label className={fieldLabel}>
        <span className={fieldCaption}>{t.book}</span>
        <select className="field w-full" value={book} onChange={(event) => { setBook(event.target.value); setPage(1); }}>
          <option value="">{t.allBooks}</option>
          {sources.map((source) => <option key={source.key} value={source.key}>{source.name} ({source.count})</option>)}
        </select>
      </label>
    </div>

    {loading ? <SkeletonRegion label={t.loading as string}><div className={list}>{Array.from({ length: 8 }, (_, index) => <div key={index} className="skeleton-row"><Skeleton width={24} height={24} className="skeleton-circle" /><div className="skeleton-grow"><Skeleton width="65%" height={14} /><Skeleton width="35%" height={9} style={{ marginTop: 6 }} /></div></div>)}</div></SkeletonRegion>
      : error ? <div className={`${notice} mt-4`} role="alert"><strong className="text-danger not-italic">{t.errorTitle}</strong><p className="mt-1.5 mb-3">{t.errorBody}</p><button type="button" className="button button-quiet button-sm" onClick={() => setRetryCount((count) => count + 1)}>{t.retry}</button></div>
      : <>
        <div className="mt-4 mb-2 flex items-center justify-between gap-3 font-label text-xs font-bold tracking-[.09em] text-muted uppercase"><span>{countText(catalogCount)}{rating ? ` · CR ${ratingText(rating)}` : ""}</span><small className="font-normal">{sources.find((source) => source.key === book)?.name ?? "Open5e"}</small></div>
        {catalog.length ? <div className={list}>
          {catalog.map((creature) => {
            const active = selectedSlug === creature.index;
            return <button className="choice flex items-center gap-2.5 px-3 py-2.5" type="button" key={creature.index} aria-pressed={active} onClick={() => setSelectedSlug(creature.index)}>
              <span className="w-6 flex-none text-center text-xl text-gilt-text" aria-hidden="true">✧</span>
              <span className="block min-w-0 truncate font-body text-sm font-bold">{creature.name}<small className="mt-0.5 block truncate font-label text-xs font-normal text-muted">{[creature.cr !== undefined ? `CR ${formatChallenge(creature.cr)}` : "", creature.source].filter(Boolean).join(" · ")}</small></span>
              <span className="ml-auto flex-none text-xs whitespace-nowrap text-accent">{active ? t.selected : t.select} <b className="ml-1 text-[15px]">›</b></span>
            </button>;
          })}
        </div> : <div className={notice}>{t.noResults}</div>}
        {catalogCount > PAGE_SIZE && <nav className="mt-3.5 flex items-center justify-center gap-3.5 font-label text-xs text-muted max-[600px]:gap-2" aria-label={locale === "es" ? "Paginación del bestiario" : "Bestiary pagination"}>
          <button type="button" className="button button-quiet button-sm" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={currentPage <= 1}>‹ {t.previous}</button>
          <span>{pageText(currentPage, pageCount)}</span>
          <button type="button" className="button button-quiet button-sm" onClick={() => setPage((current) => current + 1)} disabled={currentPage >= pageCount}>{t.next} ›</button>
        </nav>}
      </>}

    {selectedSlug && <div className="mt-6 flex scroll-mt-5 flex-col items-start gap-3">
      <MonsterSheet monsterSlug={selectedSlug} locale={locale} />
      {onAddCreature && <button type="button" className="button button-primary" disabled={adding || addedSlug === selectedSlug} onClick={async () => {
        setAdding(true);
        try {
          const monster = await fetchMonster(selectedSlug);
          if (typeof monster.xp === "number" && monster.xp > 0) {
            onAddCreature({ id: `srd-${selectedSlug}`, name: monster.name, xp: monster.xp, source: sourceLabel(monster.source), roleTags: inferMonsterRoles(monster), monsterSlug: selectedSlug });
            setAddedSlug(selectedSlug);
          }
        } finally { setAdding(false); }
      }}>{adding ? <><Spinner />{locale === "es" ? "Añadiendo…" : "Adding…"}</> : addedSlug === selectedSlug ? t.added : t.add}</button>}
    </div>}
  </section>;
}

type HomebrewProps = {
  me: Pick<Me, "id" | "name" | "role">;
  campaigns: Campaign[];
  onAddCreature: (creature: Omit<CatalogCreature, "id">) => void;
};

const tabLabels = { en: { srd: "Open5e bestiary", homebrew: "Homebrew", label: "Bestiary source" }, es: { srd: "Bestiario Open5e", homebrew: "Homebrew", label: "Origen del bestiario" } };

/** The SRD bestiary, plus a Homebrew tab when the caller can supply the signed-in user. */
export default function BestiaryBrowser(props: Props & { homebrew?: HomebrewProps }) {
  const { homebrew, ...srdProps } = props;
  const [tab, setTab] = useState<"srd" | "homebrew">("srd");
  const labels = tabLabels[props.locale ?? "en"];
  if (!homebrew) return <SrdBestiary {...srdProps} />;
  return <>
    <div className="tabs" role="group" aria-label={labels.label}>
      <button type="button" aria-pressed={tab === "srd"} onClick={() => setTab("srd")}>{labels.srd}</button>
      <button type="button" aria-pressed={tab === "homebrew"} onClick={() => setTab("homebrew")}>{labels.homebrew}</button>
    </div>
    {tab === "srd" ? <SrdBestiary {...srdProps} /> : <HomebrewPanel locale={props.locale ?? "en"} me={homebrew.me} campaigns={homebrew.campaigns} onAddCreature={homebrew.onAddCreature} />}
  </>;
}
