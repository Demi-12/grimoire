"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import CharacterBuilder from "@/components/character-builder";
import EncounterBuilder from "@/components/encounter-builder";
import CampaignManager from "@/components/campaign-manager";
import BestiaryBrowser from "@/components/bestiary-browser";
import AdminUsers from "@/components/admin-users";
import { AuthPanel } from "@/components/auth/auth-panel";
import { authClient } from "@/lib/auth-client";
import { api, ApiError, type Campaign, type Character, type CatalogCreature, type CharacterDraft, type InvitePreview, type Me } from "@/lib/api-client";
import { LEGACY_CHARACTERS_LOCATION, storageLocation } from "@/lib/storage";
import { sampleCreatures, type Creature } from "@/lib/rules";
import { usePathname, useRouter } from "next/navigation";
import { detectLocale, translate, type Locale } from "@/lib/i18n";
import { Skeleton, SkeletonRegion, Spinner } from "./skeleton";

type View = "home" | "characters" | "campaigns" | "encounters" | "account" | "admin";

/** Each view has its own URL (see src/app/(app)); Toolkit stays mounted in the shared layout. */
const viewPaths: Record<View, string> = { home: "/", characters: "/characters", campaigns: "/campaigns", encounters: "/encounters", account: "/account", admin: "/admin" };
function viewFromPath(pathname: string): View {
  const normalized = pathname.replace(/\/+$/, "") || "/";
  return (Object.keys(viewPaths) as View[]).find((candidate) => viewPaths[candidate] === normalized) ?? "home";
}
type Theme = "light" | "dark";

function readSaved<T>(key: string, fallback: T): T {
  try {
    const value = window.localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
}

type LocalImport = { characters: unknown[]; campaigns: unknown[]; creatures: unknown[] };

/** Characters, campaigns and own-catalog creatures this browser saved before accounts were stored server-side. */
function findLocalData(accountId: string): LocalImport {
  const characters = new Map<string, unknown>();
  for (const key of [storageLocation("characters", accountId), storageLocation("characters"), LEGACY_CHARACTERS_LOCATION]) {
    const saved = readSaved<unknown>(key, []);
    for (const item of Array.isArray(saved) ? saved : []) {
      if (item && typeof item === "object" && typeof (item as { id?: unknown }).id === "string") characters.set((item as { id: string }).id, item);
    }
  }
  const campaigns = [storageLocation("campaigns", accountId), storageLocation("campaigns")].flatMap((key) => {
    const saved = readSaved<unknown>(key, []);
    return Array.isArray(saved) ? saved : [];
  });
  const creatures = new Map<string, unknown>();
  for (const key of [storageLocation("creatures", accountId), storageLocation("creatures")]) {
    const saved = readSaved<unknown>(key, []);
    for (const item of Array.isArray(saved) ? saved : []) {
      // Only the user's own entries; samples and bestiary picks are not worth copying.
      if (item && typeof item === "object" && (item as { source?: unknown }).source === "Catálogo propio") {
        const id = (item as { id?: unknown }).id;
        creatures.set(typeof id === "string" ? id : `anon-${creatures.size}`, item);
      }
    }
  }
  return { characters: [...characters.values()], campaigns, creatures: [...creatures.values()] };
}

const inviteKey = "grimoire.invite.v1";

/** Invite token from `?invite=` (kept in sessionStorage so it survives sign-up and approval). */
function takePendingInvite(): string | null {
  try {
    const url = new URL(window.location.href);
    const fromUrl = url.searchParams.get("invite");
    if (fromUrl) {
      window.sessionStorage.setItem(inviteKey, fromUrl);
      url.searchParams.delete("invite");
      window.history.replaceState(null, "", url.pathname + url.search + url.hash);
    }
    return window.sessionStorage.getItem(inviteKey);
  } catch {
    return null;
  }
}

function clearPendingInvite() {
  try { window.sessionStorage.removeItem(inviteKey); } catch { /* nothing stored */ }
}

function toCreature(item: CatalogCreature): Creature {
  return { id: item.id, name: item.name, xp: item.xp, source: item.source, roleTags: item.roleTags as Creature["roleTags"], monsterSlug: item.monsterSlug };
}

export default function Toolkit({ googleEnabled = false }: { googleEnabled?: boolean }) {
  const authSession = authClient.useSession();
  const accountId = authSession.data?.user.id;
  const [me, setMe] = useState<Me | null>(null);
  const [meLoadedFor, setMeLoadedFor] = useState<string | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [localImport, setLocalImport] = useState<LocalImport | null>(null);
  const [importBusy, setImportBusy] = useState(false);
  const [importMessage, setImportMessage] = useState("");
  const [loadError, setLoadError] = useState("");
  const router = useRouter();
  const view = viewFromPath(usePathname());
  const setView = (next: View) => { if (next !== view) router.push(viewPaths[next]); };
  const [locale, setLocale] = useState<Locale>("en");
  const [theme, setTheme] = useState<Theme>("light");
  const [themeReady, setThemeReady] = useState(false);
  const [localeReady, setLocaleReady] = useState(false);
  const [dataLoadedFor, setDataLoadedFor] = useState("");
  const [characters, setCharacters] = useState<Character[]>([]);
  const [ownCreatures, setOwnCreatures] = useState<Creature[]>([]);
  const [catalogError, setCatalogError] = useState("");
  // Samples are only a starting point for an empty catalog; they are never stored.
  const creatures = ownCreatures.length ? ownCreatures : sampleCreatures;
  const [creatureName, setCreatureName] = useState("");
  const [creatureXp, setCreatureXp] = useState(100);
  const [showCatalog, setShowCatalog] = useState(false);
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [invite, setInvite] = useState<InvitePreview | null>(null);
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteError, setInviteError] = useState("");

  const t = (key: string, values?: Record<string, string | number>) => translate(locale, key, values);

  useEffect(() => {
    let savedLocale: string | null = null;
    try {
      savedLocale = window.localStorage.getItem("grimoire.locale.v1");
    } catch {
      // Browser storage can be disabled; browser language detection still works.
    }
    setLocale(savedLocale === "es" || savedLocale === "en" ? savedLocale : detectLocale(window.navigator.language));
    let savedTheme: string | null = null;
    try {
      savedTheme = window.localStorage.getItem("grimoire.theme.v1");
    } catch {
      // The system preference still works when browser storage is disabled.
    }
    setTheme(savedTheme === "light" || savedTheme === "dark"
      ? savedTheme
      : window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    setThemeReady(true);
    setLocaleReady(true);
  }, []);
  useEffect(() => { setInviteToken(takePendingInvite()); }, []);
  const reloadData = useCallback(async () => {
    const [characterData, campaignData] = await Promise.all([
      api<{ characters: Character[] }>("/api/characters"),
      api<{ campaigns: Campaign[] }>("/api/campaigns"),
    ]);
    setCharacters(characterData.characters);
    setCampaigns(campaignData.campaigns);
  }, []);

  useEffect(() => {
    if (authSession.isPending) return;
    if (!accountId) { setMe(null); setMeLoadedFor(""); return; }
    let cancelled = false;
    setLoadError("");
    api<{ user: Me }>("/api/me")
      .then(async ({ user }) => {
        if (cancelled) return;
        setMe(user);
        if (user.preferences?.locale) setLocale(user.preferences.locale);
        if (user.preferences?.theme) setTheme(user.preferences.theme);
        if (user.status === "approved") {
          await reloadData();
          try {
            const data = await api<{ creatures: CatalogCreature[] }>("/api/creatures");
            if (!cancelled) setOwnCreatures(data.creatures.map(toCreature));
          } catch {
            if (!cancelled) setCatalogError("load");
          }
          const done = user.preferences?.legacyImported ?? true;
          const local = done ? null : findLocalData(user.id);
          setLocalImport(local && (local.characters.length || local.campaigns.length || local.creatures.length) ? local : null);
        }
      })
      .catch((cause) => {
        if (cancelled) return;
        if (cause instanceof ApiError && cause.status === 401) setMe(null);
        else setLoadError(cause instanceof Error ? cause.message : String(cause));
      })
      .finally(() => { if (!cancelled) { setMeLoadedFor(accountId); setDataLoadedFor(accountId); } });
    return () => { cancelled = true; };
  }, [authSession.isPending, accountId, reloadData]);

  useEffect(() => {
    if (!inviteToken || me?.status !== "approved") return;
    let cancelled = false;
    setInviteError("");
    api<{ invite: InvitePreview }>(`/api/invites/${encodeURIComponent(inviteToken)}`)
      .then((data) => { if (!cancelled) setInvite(data.invite); })
      .catch(() => { if (!cancelled) { setInvite(null); setInviteError(t("invite.invalid")); clearPendingInvite(); setInviteToken(null); } });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inviteToken, me?.status]);

  useEffect(() => {
    if (localeReady) {
      try {
        window.localStorage.setItem("grimoire.locale.v1", locale);
      } catch {
        // Keep the current selection for this session if storage is unavailable.
      }
    }
  }, [locale, localeReady]);
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  useEffect(() => {
    // Next re-applies the static metadata title whenever a navigation settles, so keep ours in place.
    const wanted = `${translate(locale, `nav.${view}`)} | Grimoire`;
    const apply = () => { if (document.title !== wanted) document.title = wanted; };
    apply();
    const observer = new MutationObserver(apply);
    observer.observe(document.head, { subtree: true, childList: true, characterData: true });
    return () => observer.disconnect();
  }, [locale, view]);
  useEffect(() => {
    if (view === "admin" && me && me.role !== "admin") router.replace("/");
  }, [view, me, router]);
  useEffect(() => {
    if (!themeReady) return;
    document.documentElement.dataset.theme = theme;
    try {
      window.localStorage.setItem("grimoire.theme.v1", theme);
    } catch {
      // Keep the selected theme for the current session.
    }
  }, [theme, themeReady]);

  const loading = <main className="app-shell min-h-screen bg-paper text-ink" aria-busy="true">
    <aside className="sidebar" aria-hidden="true"><div className="skeleton-shell-nav">{[0, 1, 2, 3, 4].map((item) => <Skeleton key={item} height={34} />)}</div></aside>
    <section className="workspace">
      <SkeletonRegion label={locale === "es" ? "Abriendo el grimorio…" : "Opening the Grimoire…"} className="page-content">
        <div className="skeleton-grid">
          <Skeleton width="38%" height={38} /><Skeleton width="55%" height={14} />
          <div className="tool-grid">{[0, 1, 2, 3].map((item) => <div key={item} className="skeleton-card"><Skeleton width={28} height={28} className="skeleton-circle" /><Skeleton width="60%" height={14} /><Skeleton width="30%" height={26} /></div>)}</div>
          {[0, 1, 2].map((item) => <div key={item} className="skeleton-row"><Skeleton width={36} height={36} className="skeleton-circle" /><div className="skeleton-grow"><Skeleton width="45%" height={14} /></div></div>)}
        </div>
      </SkeletonRegion>
    </section>
  </main>;
  if (authSession.isPending || (accountId && meLoadedFor !== accountId)) return loading;

  function savePreference(preference: { locale: Locale } | { theme: Theme }) {
    if (accountId) api("/api/me", { method: "PATCH", body: preference }).catch(() => undefined);
  }
  function changeLocale(next: Locale) { setLocale(next); savePreference({ locale: next }); }
  function changeTheme(next: Theme) { setTheme(next); savePreference({ theme: next }); }

  const controls = <div className="header-controls">
    <button type="button" className="header-control theme-toggle" aria-label={t(theme === "dark" ? "theme.switchToLight" : "theme.switchToDark")} onClick={() => changeTheme(theme === "dark" ? "light" : "dark")}><span className="theme-glyph" aria-hidden="true">{theme === "dark" ? <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg> : <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" /></svg>}</span><span className="theme-label">{t(theme === "dark" ? "theme.light" : "theme.dark")}</span></button>
    <label className="header-select"><span className="sr-only">{t("common.language")}</span><select aria-label={t("common.language")} className="header-control" value={locale} onChange={(event) => changeLocale(event.target.value as Locale)}><option value="en">{t("common.english")}</option><option value="es">{t("common.spanish")}</option></select></label>
  </div>;

  // Everyone must sign in; blocked accounts only see a notice.
  if (!accountId || !me || me.status !== "approved") {
    const signOut = async () => { await authClient.signOut(); window.location.assign("/"); };
    return <main className="gate-shell min-h-screen bg-paper text-ink">
      <header className="gate-header"><span className="gate-brand">✳︎ GRIMOIRE</span>{controls}</header>
      {loadError ? <section className="gate-card" role="alert"><h1>{t("gate.errorTitle")}</h1><p>{t("gate.errorDescription")}</p>
        <button className="button button-primary" onClick={() => window.location.reload()}>{t("gate.retry")}</button></section>
      : !accountId || !me ? <><p className="gate-intro">{t("gate.intro")}</p><AuthPanel locale={locale} googleEnabled={googleEnabled} /></>
      : <section className="gate-card" aria-labelledby="gate-title">
        <p className="eyebrow"><span />{t("gate.blockedKicker")}</p>
        <h1 id="gate-title">{t("gate.blockedTitle")}</h1>
        <p>{t("gate.blockedDescription")}</p>
        <div className="gate-actions">
          <button className="button button-quiet" onClick={() => void signOut()}>{t("gate.signOut")}</button>
        </div>
      </section>}
    </main>;
  }
  if (dataLoadedFor !== accountId) return loading;

  const signOut = async () => { await authClient.signOut(); window.location.assign("/"); };

  const currentUser = me;
  const ownCharacters = characters.filter((character) => character.editable);
  const title = t(`nav.${view}`);

  async function saveCharacter(draft: CharacterDraft, id?: string) {
    await api(id ? `/api/characters/${id}` : "/api/characters", { method: id ? "PUT" : "POST", body: draft });
    await reloadData();
  }

  async function deleteCharacter(id: string) {
    await api(`/api/characters/${id}`, { method: "DELETE" });
    await reloadData();
  }

  async function acceptInvite() {
    if (!inviteToken) return;
    setInviteBusy(true);
    setInviteError("");
    try {
      await api(`/api/invites/${encodeURIComponent(inviteToken)}`, { method: "POST" });
      clearPendingInvite();
      setInviteToken(null);
      setInvite(null);
      await reloadData();
      setView("campaigns");
    } catch {
      setInviteError(t("invite.error"));
    } finally {
      setInviteBusy(false);
    }
  }

  function declineInvite() {
    clearPendingInvite();
    setInviteToken(null);
    setInvite(null);
  }

  function finishImport() {
    api("/api/me", { method: "PATCH", body: { legacyImported: true } }).catch(() => undefined);
    setLocalImport(null);
  }

  async function runImport() {
    if (!localImport) return;
    setImportBusy(true);
    try {
      const { imported } = await api<{ imported: { characters: number; campaigns: number; creatures?: number } }>("/api/import", { method: "POST", body: localImport });
      finishImport();
      setImportMessage(t("import.done", { characters: imported.characters, campaigns: imported.campaigns, creatures: imported.creatures ?? 0 }));
      await reloadData();
      await loadCreatures();
    } catch {
      setImportMessage(t("import.error"));
    } finally {
      setImportBusy(false);
    }
  }

  async function loadCreatures() {
    try {
      const data = await api<{ creatures: CatalogCreature[] }>("/api/creatures");
      setOwnCreatures(data.creatures.map(toCreature));
    } catch { /* keep the current list */ }
  }

  /** Saves a creature server-side (deduplicated by monsterSlug there) and merges the stored copy into the list. */
  async function saveCreature(input: Omit<CatalogCreature, "id">): Promise<boolean> {
    setCatalogError("");
    try {
      const { creature } = await api<{ creature: CatalogCreature }>("/api/creatures", { method: "POST", body: input });
      setOwnCreatures((current) => [toCreature(creature), ...current.filter((item) => item.id !== creature.id)]);
      return true;
    } catch {
      setCatalogError("save");
      return false;
    }
  }

  async function removeCreature(id: string) {
    setCatalogError("");
    try {
      await api(`/api/creatures/${encodeURIComponent(id)}`, { method: "DELETE" });
      setOwnCreatures((current) => current.filter((item) => item.id !== id));
    } catch {
      setCatalogError("remove");
    }
  }

  async function addCreature(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!creatureName.trim() || creatureXp < 1) return;
    if (await saveCreature({ name: creatureName.trim(), xp: creatureXp, source: "Catálogo propio" })) setCreatureName("");
  }

  return <div className="app-shell min-h-screen bg-paper text-ink">
    <a className="skip-link" href="#main">{t("nav.skip")}</a>
    <aside className="sidebar">
      <button className="brand" onClick={() => setView("home")}><span>✳︎</span><b>GRIMOIRE</b></button>
      <div className="sidebar-caption">{t("nav.workspace")}</div>
      <nav className="side-nav" aria-label={t("nav.aria")}>
        <button className={view === "home" ? "active" : ""} aria-current={view === "home" ? "page" : undefined} onClick={() => setView("home")}><span aria-hidden="true">⌂</span>{t("nav.home")}</button>
        <button className={view === "characters" ? "active" : ""} aria-current={view === "characters" ? "page" : undefined} onClick={() => setView("characters")}><span aria-hidden="true">♙</span>{t("nav.characters")}<small>{ownCharacters.length}</small></button>
        <button className={view === "campaigns" ? "active" : ""} aria-current={view === "campaigns" ? "page" : undefined} onClick={() => setView("campaigns")}><span aria-hidden="true">⚑</span>{t("nav.campaigns")}<small>{campaigns.length}</small></button>
        <button className={view === "encounters" ? "active" : ""} aria-current={view === "encounters" ? "page" : undefined} onClick={() => setView("encounters")}><span aria-hidden="true">⚔︎</span>{t("nav.encounters")}</button>
        <button className={view === "account" ? "active" : ""} aria-current={view === "account" ? "page" : undefined} onClick={() => setView("account")}><span aria-hidden="true">⚿</span>{t("nav.account")}</button>
        {me.role === "admin" && <button className={`nav-admin${view === "admin" ? " active" : ""}`} aria-current={view === "admin" ? "page" : undefined} onClick={() => setView("admin")}><span aria-hidden="true">♛</span>{t("nav.admin")}</button>}
      </nav>
      <div className="sidebar-bottom"><span className="edition-dot" />{t("common.rulesLabel")}<p>{t(me.role === "admin" ? "nav.signedInAsAdmin" : "nav.signedInAs", { name: me.name })}</p><button type="button" className="sidebar-signout" onClick={() => void signOut()}>{t("gate.signOut")}</button></div>
    </aside>

    <section className="workspace">
      <header className="workspace-header"><div className="mobile-brand">✳︎ GRIMOIRE</div><span className="breadcrumb">{t("header.campaign")} <i>/</i> {title.toLocaleUpperCase(locale === "es" ? "es-ES" : "en-US")}</span>
        {controls}
        {me.role === "admin" && <button type="button" className={`header-admin${view === "admin" ? " active" : ""}`} aria-label={t("nav.admin")} onClick={() => setView("admin")}><span aria-hidden="true">♛</span></button>}
        <button type="button" className="header-signout" aria-label={t("gate.signOut")} title={t("gate.signOut")} onClick={() => void signOut()}><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h4M16 8l4 4-4 4M20 12H9" /></svg></button>
        <span className="edition-badge">{t("common.edition")}</span></header>
      {(invite || inviteError) && <div className="import-banner" role="status"><span aria-hidden="true">⚑</span>
        {invite ? <p><b>{t("invite.title", { campaign: invite.campaignName })}</b> {invite.alreadyMember ? t("invite.already", { owner: invite.ownerName }) : t("invite.description", { owner: invite.ownerName })}</p>
          : <p>{inviteError}</p>}
        <div>{invite && <button className="button button-primary" disabled={inviteBusy} onClick={() => void acceptInvite()}>{inviteBusy && <Spinner />}{t(inviteBusy ? "common.saving" : "invite.accept")}</button>}
          <button className="button button-quiet" disabled={inviteBusy} onClick={invite ? declineInvite : () => setInviteError("")}>{t(invite ? "invite.decline" : "invite.dismiss")}</button></div></div>}
      {view === "home" && <main className="page-content" id="main" tabIndex={-1}>
        {localImport && <div className="import-banner" role="status"><span aria-hidden="true">✦</span><p><b>{t("import.title")}</b> {t("import.description", { characters: localImport.characters.length, campaigns: localImport.campaigns.length, creatures: localImport.creatures.length })}</p>
          <div><button className="button button-primary" disabled={importBusy} onClick={() => void runImport()}>{importBusy && <Spinner />}{t(importBusy ? "common.saving" : "import.action")}</button><button className="button button-quiet" disabled={importBusy} onClick={finishImport}>{t("import.dismiss")}</button></div></div>}
        {importMessage && <p className="import-message" role="status">{importMessage}</p>}
        <header className="desk-head">
          <div><h1>{t("home.title")}</h1><p>{t("home.signedIn", { name: me.name })}</p></div>
          <div className="desk-actions">
            <button className="button button-quiet" onClick={() => setView("encounters")}>⚔︎ {t("home.generateEncounter")}</button>
            <button className="button button-primary" onClick={() => setView("characters")}>✦ {t("home.createCharacter")}</button>
          </div>
        </header>
        <section className="tool-grid" aria-label={t("home.toolbox")}>
          <button className="tool-tile" onClick={() => setView("characters")}><span className="tool-glyph" aria-hidden="true">♙</span><strong>{t("nav.characters")}</strong><b>{ownCharacters.length}</b><small>{t("home.tool.characters")}</small></button>
          <button className="tool-tile" onClick={() => setView("campaigns")}><span className="tool-glyph" aria-hidden="true">⚑</span><strong>{t("home.campaigns")}</strong><b>{campaigns.length}</b><small>{t("home.tool.campaigns")}</small></button>
          <button className="tool-tile" onClick={() => setView("encounters")}><span className="tool-glyph" aria-hidden="true">⚔︎</span><strong>{t("nav.encounters")}</strong><b>{creatures.length}</b><small>{t("home.tool.encounters")}</small></button>
          <button className="tool-tile" onClick={() => setView("account")}><span className="tool-glyph" aria-hidden="true">⚿</span><strong>{t("nav.account")}</strong><b className="tool-status">✓</b><small>{t("home.tool.accountOn")}</small></button>
        </section>
        <section className="desk-panel">
          <div className="desk-panel-head"><h2>{t("home.recent")}</h2>{ownCharacters.length > 4 && <button className="small-action" onClick={() => setView("characters")}>{t("home.seeAll", { count: ownCharacters.length })}</button>}</div>
          {ownCharacters.length ? <ul className="roster">{ownCharacters.slice(0, 4).map((character) => <li key={character.id}>
            <button onClick={() => setView("characters")}><span className="roster-mark">{character.name.slice(0, 1).toLocaleUpperCase(locale === "es" ? "es-ES" : "en-US")}</span>
              <span className="roster-name">{character.name}<small>{[character.className, character.species].filter(Boolean).join(" · ") || t("character.adventurer")}</small></span>
              <span className="roster-level">{t("character.levelPill", { level: character.level })}</span></button>
          </li>)}</ul> : <p className="desk-empty">{t("home.noCharacters")} <button className="small-action" onClick={() => setView("characters")}>{t("home.createCharacter")}</button></p>}
        </section>
        <p className="local-data-note">◈ {t("home.privacyDescription")}</p>
      </main>}

      {view === "characters" && <main className="page-content" id="main" tabIndex={-1}>
        <div className="section-title page-title"><div><p className="eyebrow">{t("characters.kicker")}</p><h1>{t("characters.title")}</h1><p className="title-description">{t("characters.description")}</p></div></div>
        <CharacterBuilder locale={locale} characters={ownCharacters} campaigns={campaigns.filter((campaign) => campaign.myRole)} onSave={saveCharacter} onDelete={deleteCharacter} />
        <p className="local-data-note">{t("characters.localData")}</p>
      </main>}

      {view === "campaigns" && <main className="page-content" id="main" tabIndex={-1}>
        <CampaignManager me={me} campaigns={campaigns} characters={characters} locale={locale} onChanged={reloadData} />
      </main>}

      {view === "encounters" && <main className="page-content" id="main" tabIndex={-1}>
        <div className="section-title page-title"><div><p className="eyebrow">{t("encounters.kicker")}</p><h1>{t("encounters.title")}</h1><p className="title-description">{t("encounters.description")}</p></div><button className="button button-quiet" onClick={() => setShowCatalog((open) => !open)}>{showCatalog ? t("encounters.closeCatalog") : t("encounters.catalog", { count: creatures.length })}</button></div>
        <EncounterBuilder locale={locale} creatures={creatures} characters={characters} campaigns={campaigns} />
        <BestiaryBrowser locale={locale} onAddCreature={(creature) => { void saveCreature({ name: creature.name, xp: creature.xp, source: creature.source, monsterSlug: creature.monsterSlug, roleTags: creature.roleTags }); }} />
        {catalogError && <p className="import-message" role="alert">{t(`catalog.error.${catalogError}`)}</p>}
        {showCatalog && <section className="catalog-panel"><div className="catalog-heading"><div><p className="eyebrow">{t("catalog.kicker")}</p><h2>{t("catalog.title")}</h2><p>{t("catalog.description")}</p></div></div>
          <form className="creature-form" onSubmit={addCreature}><label>{t("catalog.name")}<input required maxLength={60} value={creatureName} onChange={(event) => setCreatureName(event.target.value)} placeholder={t("catalog.namePlaceholder")} /></label><label>{t("catalog.xp")}<input type="number" min={1} max={100000} value={creatureXp} onChange={(event) => setCreatureXp(Number(event.target.value))} /></label><button className="button button-primary" type="submit">{t("catalog.add")}</button></form>
          <div className="catalog-list">{creatures.map((creature) => <div className="catalog-row" key={creature.id}><span aria-hidden="true">✦</span><b>{creature.source === "Ejemplo editable" ? t(`creature.sample.${creature.xp}.name`) : creature.name}</b><small>{creature.source === "Ejemplo editable" ? t("creature.sample.source") : creature.source === "Catálogo propio" ? t("catalog.customSource") : creature.source}</small><strong>{creature.xp.toLocaleString(locale === "es" ? "es-ES" : "en-US")} XP</strong>{creature.source === "Catálogo propio" && <button className="small-action danger-action" onClick={() => void removeCreature(creature.id)}>{t("catalog.remove")}</button>}</div>)}</div>
        </section>}
      </main>}

      {view === "account" && <main className="page-content" id="main" tabIndex={-1}>
        <div className="section-title page-title"><div><p className="eyebrow">{locale === "es" ? "SELLO DE IDENTIDAD" : "IDENTITY SEAL"}</p><h1>{t("nav.account")}</h1><p className="title-description">{locale === "es" ? "Protege tu acceso al grimorio." : "Secure your access to the Grimoire."}</p></div></div>
        <AuthPanel locale={locale} googleEnabled={googleEnabled} />
      </main>}

      {view === "admin" && me.role === "admin" && <main className="page-content" id="main" tabIndex={-1}>
        <div className="section-title page-title"><div><p className="eyebrow">{t("admin.kicker")}</p><h1>{t("nav.admin")}</h1><p className="title-description">{t("admin.description")}</p></div></div>
        <AdminUsers me={me} locale={locale} />
      </main>}
      <footer className="app-footer"><span>{t("footer.brand")}</span><span>{t("footer.rules")}</span></footer>
    </section>
  </div>;
}
