"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import HomebrewEditor from "@/components/homebrew-editor";
import MonsterSheet from "@/components/monster-sheet";
import { Skeleton, SkeletonRegion } from "@/components/skeleton";
import { api, ApiError, type Campaign, type CatalogCreature, type HomebrewMonster, type Me } from "@/lib/api-client";
import { homebrewSlug } from "@/lib/homebrew";
import { useConfirm, useToast } from "./feedback";
import styles from "./homebrew.module.css";

type Locale = "en" | "es";
type Props = {
  locale: Locale;
  me: Pick<Me, "id" | "name" | "role">;
  campaigns: Campaign[];
  /** Adds a monster to the encounter generator's catalog (the same hook the SRD bestiary uses). */
  onAddCreature?: (creature: Omit<CatalogCreature, "id">) => void;
};

const copy = {
  en: {
    title: "Homebrew monsters", intro: "Build your own monsters with a full stat block. They are private until you share them with a campaign or publish them to everyone on this server.",
    create: "New monster", search: "Search homebrew", scopes: { all: "All", mine: "Mine", shared: "Shared with me" }, scopesLabel: "Show",
    empty: "No homebrew monsters here yet.", emptyMine: "You have not made any yet.", loading: "Opening the homebrew shelf…", loadError: "Could not load the homebrew monsters.", retry: "Retry",
    by: (name: string) => `by ${name}`, cr: "CR", visibility: { private: "Private", campaign: "Campaign", instance: "Server" }, locked: "Locked",
    edit: "Edit", remove: "Delete", confirmRemove: (name: string) => `Delete “${name}” for good?`,
    removeBody: "Everyone you shared it with loses it too. This can't be undone.", removed: (name: string) => `“${name}” was deleted.`,
    saved: (name: string) => `“${name}” saved.`, lockedDone: (name: string) => `“${name}” is locked and private.`, unlockedDone: (name: string) => `“${name}” is unlocked.`,
    add: "Add to encounter list", adding: "Adding…", added: "Added to encounter list",
    lock: "Lock and unpublish", unlock: "Unlock", moderation: "Moderation",
    lockedNote: "An admin locked this monster; it stays private until they unlock it.",
    actionError: "That did not work.",
  },
  es: {
    title: "Monstruos homebrew", intro: "Crea tus propios monstruos con una ficha completa. Son privados hasta que los compartes con una campaña o los publicas para todos en este servidor.",
    create: "Nuevo monstruo", search: "Buscar homebrew", scopes: { all: "Todos", mine: "Míos", shared: "Compartidos conmigo" }, scopesLabel: "Mostrar",
    empty: "Aún no hay monstruos homebrew aquí.", emptyMine: "Todavía no has creado ninguno.", loading: "Abriendo la estantería homebrew…", loadError: "No se han podido cargar los monstruos homebrew.", retry: "Reintentar",
    by: (name: string) => `de ${name}`, cr: "VD", visibility: { private: "Privado", campaign: "Campaña", instance: "Servidor" }, locked: "Bloqueado",
    edit: "Editar", remove: "Borrar", confirmRemove: (name: string) => `¿Borrar «${name}» para siempre?`,
    removeBody: "Quien lo tuviera compartido también lo pierde. No se puede deshacer.", removed: (name: string) => `«${name}» se ha borrado.`,
    saved: (name: string) => `«${name}» guardado.`, lockedDone: (name: string) => `«${name}» está bloqueado y es privado.`, unlockedDone: (name: string) => `«${name}» está desbloqueado.`,
    add: "Añadir al catálogo de encuentros", adding: "Añadiendo…", added: "Añadido al catálogo de encuentros",
    lock: "Bloquear y retirar", unlock: "Desbloquear", moderation: "Moderación",
    lockedNote: "Un admin ha bloqueado este monstruo; sigue privado hasta que lo desbloquee.",
    actionError: "No se ha podido completar.",
  },
} as const;

type Scope = "all" | "mine" | "shared";
const ratingLabel = (value: number) => (value === 0.125 ? "1/8" : value === 0.25 ? "1/4" : value === 0.5 ? "1/2" : String(value));

export default function HomebrewPanel({ locale, me, campaigns, onAddCreature }: Props) {
  const t = copy[locale];
  const [monsters, setMonsters] = useState<HomebrewMonster[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [scope, setScope] = useState<Scope>("all");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ monster: HomebrewMonster | null } | null>(null);
  const [busy, setBusy] = useState(false);
  const confirm = useConfirm();
  const toast = useToast();
  const [addedId, setAddedId] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoadError(false);
    api<{ monsters: HomebrewMonster[] }>("/api/homebrew")
      .then((data) => { if (!cancelled) setMonsters(data.monsters); })
      .catch(() => { if (!cancelled) setLoadError(true); });
    return () => { cancelled = true; };
  }, [attempt]);

  const visible = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase(locale);
    return (monsters ?? []).filter((monster) =>
      (scope === "all" || (scope === "mine" ? monster.mine : !monster.mine))
      && (!needle || `${monster.name} ${monster.type} ${monster.ownerName}`.toLocaleLowerCase(locale).includes(needle)));
  }, [monsters, scope, query, locale]);
  const selected = monsters?.find((monster) => monster.id === selectedId) ?? null;

  const replace = useCallback((monster: HomebrewMonster) =>
    setMonsters((current) => (current ?? []).some((item) => item.id === monster.id)
      ? (current ?? []).map((item) => (item.id === monster.id ? monster : item))
      : [monster, ...(current ?? [])]), []);

  async function run(work: () => Promise<void>, success: string) {
    setBusy(true);
    try { await work(); toast.success(success); } catch (cause) { toast.error(cause instanceof ApiError ? cause.message : t.actionError); } finally { setBusy(false); }
  }

  const remove = async (monster: HomebrewMonster) => {
    if (!await confirm({ title: t.confirmRemove(monster.name), message: t.removeBody, confirmLabel: t.remove, tone: "danger" })) return;
    await run(async () => {
      await api(`/api/homebrew/${monster.id}`, { method: "DELETE" });
      setMonsters((current) => (current ?? []).filter((item) => item.id !== monster.id));
      setSelectedId(null);
    }, t.removed(monster.name));
  };
  const setLocked = (monster: HomebrewMonster, locked: boolean) => void run(async () => {
    const { monster: updated } = await api<{ monster: HomebrewMonster }>(`/api/homebrew/${monster.id}`, { method: "PATCH", body: { locked } });
    // Locking makes the monster private, so it leaves everyone else's list (an admin keeps seeing it to unlock it).
    replace(updated);
  }, locked ? t.lockedDone(monster.name) : t.unlockedDone(monster.name));
  const addToEncounters = (monster: HomebrewMonster) => {
    if (!onAddCreature) return;
    onAddCreature({ name: monster.name, xp: monster.xp, source: "Homebrew", monsterSlug: homebrewSlug(monster.id), cr: monster.cr, type: monster.type || undefined, roleTags: monster.roleTags });
    setAddedId(monster.id);
  };

  if (editing) {
    return <section className={styles.panel} aria-labelledby="homebrew-heading">
      <h2 id="homebrew-heading" className="sr-only">{t.title}</h2>
      <HomebrewEditor locale={locale} campaigns={campaigns} initial={editing.monster} ownerName={me.name}
        onCancel={() => setEditing(null)}
        onSaved={(monster) => { replace(monster); setSelectedId(monster.id); setEditing(null); setAddedId(""); toast.success(t.saved(monster.name)); }} />
    </section>;
  }

  return <section className={styles.panel} aria-labelledby="homebrew-heading">
    <div className={styles.head}>
      <div><h2 id="homebrew-heading" style={{ margin: 0 }}>{t.title}</h2><p>{t.intro}</p></div>
      <button type="button" className="button button-primary" onClick={() => setEditing({ monster: null })}>✦ {t.create}</button>
    </div>

    <div className={styles.toolbar}>
      <label className={styles.search}>{t.search}<input type="search" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
      <div className={styles.scopes} role="group" aria-label={t.scopesLabel}>
        {(Object.keys(t.scopes) as Scope[]).map((key) => <button type="button" key={key} aria-pressed={scope === key} onClick={() => setScope(key)}>{t.scopes[key]}</button>)}
      </div>
    </div>

    {loadError ? <div className={styles.error} role="alert">{t.loadError} <button type="button" className="button button-quiet" onClick={() => setAttempt((n) => n + 1)}>{t.retry}</button></div>
      : monsters === null ? <SkeletonRegion label={t.loading}><div className={styles.list}>{[0, 1, 2].map((item) => <Skeleton key={item} height={52} />)}</div></SkeletonRegion>
      : visible.length === 0 ? <div className={styles.empty}>{scope === "mine" && !monsters.some((m) => m.mine) ? t.emptyMine : t.empty}</div>
      : <div className={styles.list}>{visible.map((monster) => <button type="button" key={monster.id} className={styles.row} aria-pressed={selectedId === monster.id} onClick={() => setSelectedId(monster.id)}>
        <span><span className={styles.rowName}>{monster.name}</span>
          <span className={styles.rowMeta}><span>{t.cr} {ratingLabel(monster.cr)}</span>{monster.type && <span>{monster.type}</span>}{!monster.mine && <span>{t.by(monster.ownerName)}</span>}</span></span>
        <span className={styles.badges}>
          <span className={styles.badge}>{t.visibility[monster.visibility]}</span>
          {monster.locked && <span className={`${styles.badge} ${styles.badgeWarn}`}>{t.locked}</span>}
        </span>
      </button>)}</div>}

    {selected && <div className={styles.detail}>
      {selected.locked && <p className={styles.notice} role="status">{t.lockedNote}</p>}
      <MonsterSheet monsterSlug={homebrewSlug(selected.id)} locale={locale} />
      <div className={styles.actions}>
        {onAddCreature && <button type="button" className="button button-primary" disabled={addedId === selected.id} onClick={() => addToEncounters(selected)}>{addedId === selected.id ? t.added : t.add}</button>}
        {selected.mine && <button type="button" className="button button-quiet" disabled={busy} onClick={() => setEditing({ monster: selected })}>{t.edit}</button>}
        {(selected.mine || (me.role === "admin" && selected.visibility !== "private")) && <button type="button" className="button button-quiet" disabled={busy} onClick={() => void remove(selected)}>{t.remove}</button>}
        {me.role === "admin" && !selected.mine && (selected.locked
          ? <button type="button" className="button button-quiet" disabled={busy} onClick={() => setLocked(selected, false)}>{t.unlock}</button>
          : <button type="button" className="button button-quiet" disabled={busy} onClick={() => setLocked(selected, true)}>{t.lock}</button>)}
      </div>
    </div>}
  </section>;
}
