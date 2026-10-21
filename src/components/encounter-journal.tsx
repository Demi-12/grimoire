"use client";

import { Skeleton, SkeletonRegion, SkeletonText } from "./skeleton";
import { useCallback, useEffect, useState } from "react";
import { api, type Campaign, type SavedEncounter } from "@/lib/api-client";
import { creatureTypeKey, creatureTypeLabel, formatChallenge } from "@/lib/monster-api";
import styles from "./encounter-journal.module.css";

type Locale = "en" | "es";

const text = {
  en: {
    loading: "Loading the journal…", empty: "No encounters saved yet. Generate one in the encounter builder and save it to this campaign.",
    loadError: "The journal couldn't be loaded.", retry: "Retry", error: "That change couldn't be saved. Try again.",
    dmOnly: "Only the DMs of this campaign can see these encounters.",
    planned: "Planned", played: "Played", xp: "XP", budget: "budget", cr: "CR",
    difficulty: { low: "Low", moderate: "Moderate", high: "High" },
    notes: "Notes", saveNotes: "Save notes", markPlayed: "Mark as played", markPlanned: "Back to planned",
    remove: "Delete", confirmDelete: (title: string) => `Delete “${title}” from the journal?`,
    party: (levels: number[]) => `Party levels ${levels.join(", ")}`, by: (name: string) => `by ${name}`,
  },
  es: {
    loading: "Cargando el diario…", empty: "Aún no hay encuentros guardados. Genera uno en el generador de encuentros y guárdalo en esta campaña.",
    loadError: "No se pudo cargar el diario.", retry: "Reintentar", error: "No se pudo guardar el cambio. Inténtalo de nuevo.",
    dmOnly: "Solo los DMs de esta campaña ven estos encuentros.",
    planned: "Planificados", played: "Jugados", xp: "XP", budget: "presupuesto", cr: "CR",
    difficulty: { low: "Baja", moderate: "Moderada", high: "Alta" },
    notes: "Notas", saveNotes: "Guardar notas", markPlayed: "Marcar como jugado", markPlanned: "Volver a planificado",
    remove: "Borrar", confirmDelete: (title: string) => `¿Borrar «${title}» del diario?`,
    party: (levels: number[]) => `Niveles del grupo ${levels.join(", ")}`, by: (name: string) => `de ${name}`,
  },
};

/** DM-only journal of saved encounters for one campaign: planned first, then played. */
export default function EncounterJournal({ campaign, locale }: { campaign: Campaign; locale: Locale }) {
  const t = text[locale];
  const [items, setItems] = useState<SavedEncounter[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const campaignId = campaign.id;

  const load = useCallback(() => {
    setLoadFailed(false);
    setItems(null);
    api<{ encounters: SavedEncounter[] }>(`/api/campaigns/${campaignId}/encounters`)
      .then((data) => setItems(data.encounters))
      .catch(() => setLoadFailed(true));
  }, [campaignId]);
  useEffect(() => { load(); }, [load]);

  async function change(id: string, action: () => Promise<SavedEncounter | null>) {
    setBusyId(id);
    setError("");
    try {
      const updated = await action();
      setItems((current) => current && (updated ? current.map((item) => item.id === id ? updated : item) : current.filter((item) => item.id !== id)));
      if (updated) setDrafts((current) => { const { [id]: _drop, ...rest } = current; return rest; });
    } catch {
      setError(t.error);
    } finally {
      setBusyId("");
    }
  }

  const patch = (id: string, body: { notes?: string; status?: "planned" | "played" }) => change(id, async () =>
    (await api<{ encounter: SavedEncounter }>(`/api/campaigns/${campaignId}/encounters/${id}`, { method: "PATCH", body })).encounter);

  if (loadFailed) return <div className={styles.journal}><p className={styles.error} role="alert">{t.loadError} <button type="button" className={styles.btn} onClick={load}>{t.retry}</button></p></div>;
  if (!items) return <div className={styles.journal}><SkeletonRegion label={t.loading} className="skeleton-grid">{[0, 1].map((item) => <div key={item} className="skeleton-card"><Skeleton width="40%" height={16} /><SkeletonText lines={2} /></div>)}</SkeletonRegion></div>;

  const byDate = (a: SavedEncounter, b: SavedEncounter) => (a.status === "played" ? (b.playedAt ?? b.createdAt).localeCompare(a.playedAt ?? a.createdAt) : b.createdAt.localeCompare(a.createdAt));
  const groups = [
    { key: "planned" as const, label: t.planned, list: items.filter((item) => item.status === "planned").sort(byDate) },
    { key: "played" as const, label: t.played, list: items.filter((item) => item.status === "played").sort(byDate) },
  ].filter((group) => group.list.length);
  const numberLocale = locale === "es" ? "es-ES" : "en-US";

  return <div className={styles.journal}>
    <p className={styles.note}>{t.dmOnly}</p>
    {error && <p className={styles.error} role="alert">{error}</p>}
    {!items.length && <p className={styles.empty}>{t.empty}</p>}
    {groups.map((group) => <section key={group.key} aria-label={group.label}>
      <h4 className={styles.group}>{group.label} · {group.list.length}</h4>
      <ul className={styles.list}>{group.list.map((item) => {
        const busy = busyId === item.id;
        const draft = drafts[item.id] ?? item.notes;
        return <li key={item.id} className={`${styles.item} ${item.status === "played" ? styles.played : ""}`}>
          <div className={styles.top}>
            <div>
              <h5 className={styles.title}>{item.title}</h5>
              <p className={styles.meta}>{t.difficulty[item.difficulty]} · {item.totalXp.toLocaleString(numberLocale)} / {item.budget.toLocaleString(numberLocale)} {t.xp} · {t.party(item.partyLevels)} · {t.by(item.createdByName)}</p>
            </div>
          </div>
          <ul className={styles.lines}>{item.lines.map((line, index) => <li key={`${line.name}-${index}`}>
            <b>×{line.count}</b>
            <span>{line.name}<small>{[line.cr !== undefined ? `${t.cr} ${formatChallenge(line.cr)}` : "", line.type ? creatureTypeLabel(creatureTypeKey(line.type), locale) : "", `${line.xp.toLocaleString(numberLocale)} ${t.xp}`].filter(Boolean).map((part) => ` · ${part}`).join("")}</small></span>
          </li>)}</ul>
          <label className={styles.notesLabel} htmlFor={`journal-notes-${item.id}`}>{t.notes}</label>
          <textarea id={`journal-notes-${item.id}`} className={styles.notes} rows={2} maxLength={2000} value={draft}
            onChange={(event) => setDrafts((current) => ({ ...current, [item.id]: event.target.value }))} />
          <div className={styles.actions}>
            {draft !== item.notes && <button type="button" className={styles.btn} disabled={busy} onClick={() => void patch(item.id, { notes: draft })}>{t.saveNotes}</button>}
            <button type="button" className={`${styles.btn} ${item.status === "planned" ? styles.primary : ""}`} disabled={busy}
              onClick={() => void patch(item.id, { status: item.status === "planned" ? "played" : "planned" })}>
              {item.status === "planned" ? t.markPlayed : t.markPlanned}
            </button>
            <button type="button" className={`${styles.btn} ${styles.danger}`} disabled={busy}
              onClick={() => { if (window.confirm(t.confirmDelete(item.title))) void change(item.id, async () => { await api(`/api/campaigns/${campaignId}/encounters/${item.id}`, { method: "DELETE" }); return null; }); }}>
              {t.remove}
            </button>
          </div>
        </li>;
      })}</ul>
    </section>)}
  </div>;
}
