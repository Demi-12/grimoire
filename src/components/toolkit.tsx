"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import CharacterBuilder from "@/components/character-builder";
import EncounterBuilder from "@/components/encounter-builder";
import CampaignManager from "@/components/campaign-manager";
import BestiaryBrowser from "@/components/bestiary-browser";
import AdminUsers from "@/components/admin-users";
import { AuthPanel } from "@/components/auth/auth-panel";
import { authClient } from "@/lib/auth-client";
import { api, ApiError, type Campaign, type Character, type CharacterDraft, type InvitePreview, type Me } from "@/lib/api-client";
import { LEGACY_CHARACTERS_LOCATION, storageLocation } from "@/lib/storage";
import { sampleCreatures, type Creature } from "@/lib/rules";
import { detectLocale, translate, type Locale } from "@/lib/i18n";

type View = "home" | "characters" | "campaigns" | "encounters" | "account" | "admin";
type Theme = "light" | "dark";

function readSaved<T>(key: string, fallback: T): T {
  try {
    const value = window.localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
}

function makeId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

type LocalImport = { characters: unknown[]; campaigns: unknown[] };

/** Characters and campaigns this browser saved before accounts were stored server-side. */
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
  return { characters: [...characters.values()], campaigns };
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

const importDoneKey = (accountId: string) => `grimoire.users.${accountId}.imported.v1`;

export default function Toolkit() {
  const authSession = authClient.useSession();
  const accountId = authSession.data?.user.id;
  const creatureStorageKey = storageLocation("creatures", accountId);
  const [me, setMe] = useState<Me | null>(null);
  const [meLoadedFor, setMeLoadedFor] = useState<string | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [localImport, setLocalImport] = useState<LocalImport | null>(null);
  const [importBusy, setImportBusy] = useState(false);
  const [importMessage, setImportMessage] = useState("");
  const [loadError, setLoadError] = useState("");
  const [pendingCount, setPendingCount] = useState(0);
  const [view, setView] = useState<View>("home");
  const [locale, setLocale] = useState<Locale>("en");
  const [theme, setTheme] = useState<Theme>("light");
  const [themeReady, setThemeReady] = useState(false);
  const [localeReady, setLocaleReady] = useState(false);
  const [dataLoadedFor, setDataLoadedFor] = useState("");
  const [characters, setCharacters] = useState<Character[]>([]);
  const [creatures, setCreatures] = useState<Creature[]>(sampleCreatures);
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
        if (user.status === "approved") {
          await reloadData();
          let done = false;
          try { done = window.localStorage.getItem(importDoneKey(user.id)) === "1"; } catch { done = true; }
          const local = done ? null : findLocalData(user.id);
          setLocalImport(local && (local.characters.length || local.campaigns.length) ? local : null);
          if (user.role === "admin") {
            api<{ users: { status: string }[] }>("/api/admin/users")
              .then((data) => { if (!cancelled) setPendingCount(data.users.filter((item) => item.status === "pending").length); })
              .catch(() => undefined);
          }
        }
      })
      .catch((cause) => {
        if (cancelled) return;
        if (cause instanceof ApiError && cause.status === 401) setMe(null);
        else setLoadError(cause instanceof Error ? cause.message : String(cause));
      })
      .finally(() => { if (!cancelled) setMeLoadedFor(accountId); });
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
    if (authSession.isPending || !accountId) return;
    setCreatures(readSaved(creatureStorageKey, sampleCreatures));
    setDataLoadedFor(creatureStorageKey);
  }, [authSession.isPending, accountId, creatureStorageKey]);
  useEffect(() => {
    if (dataLoadedFor === creatureStorageKey) {
      try {
        window.localStorage.setItem(creatureStorageKey, JSON.stringify(creatures));
      } catch {
        // The catalog still works for this session when storage is unavailable.
      }
    }
  }, [creatures, creatureStorageKey, dataLoadedFor]);
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
    if (!themeReady) return;
    document.documentElement.dataset.theme = theme;
    try {
      window.localStorage.setItem("grimoire.theme.v1", theme);
    } catch {
      // Keep the selected theme for the current session.
    }
  }, [theme, themeReady]);

  const loading = <main className="app-shell min-h-screen bg-paper text-ink"><p role="status" className="page-content">{locale === "es" ? "Abriendo el grimorio…" : "Opening the Grimoire…"}</p></main>;
  if (authSession.isPending || (accountId && meLoadedFor !== accountId)) return loading;

  const controls = <>
    <button type="button" className="theme-toggle ml-auto rounded-md border border-line px-2 py-1.5 text-xs text-ink" aria-label={t(theme === "dark" ? "theme.switchToLight" : "theme.switchToDark")} onClick={() => setTheme((current) => current === "dark" ? "light" : "dark")}>{theme === "dark" ? "☀" : "☾"}<span>{t(theme === "dark" ? "theme.light" : "theme.dark")}</span></button>
    <label className="inline-flex items-center gap-2 text-xs text-muted"><span className="sr-only">{t("common.language")}</span><select aria-label={t("common.language")} className="rounded-md border border-line bg-parchment px-2 py-1.5 text-ink focus-visible:ring-2 focus-visible:ring-forest" value={locale} onChange={(event) => setLocale(event.target.value as Locale)}><option value="en">{t("common.english")}</option><option value="es">{t("common.spanish")}</option></select></label>
  </>;

  // Everyone must sign in; new accounts wait for an admin before they see any shared data.
  if (!accountId || !me || me.status !== "approved") {
    const signOut = async () => { await authClient.signOut(); window.location.assign("/"); };
    return <main className="gate-shell min-h-screen bg-paper text-ink">
      <header className="gate-header"><span className="gate-brand">✳ GRIMOIRE</span>{controls}</header>
      {loadError ? <section className="gate-card" role="alert"><h1>{t("gate.errorTitle")}</h1><p>{t("gate.errorDescription")}</p>
        <button className="button button-primary" onClick={() => window.location.reload()}>{t("gate.retry")}</button></section>
      : !accountId || !me ? <><p className="gate-intro">{t("gate.intro")}</p><AuthPanel locale={locale} /></>
      : <section className="gate-card" aria-labelledby="gate-title">
        <p className="eyebrow"><span />{t(me.status === "blocked" ? "gate.blockedKicker" : "gate.pendingKicker")}</p>
        <h1 id="gate-title">{t(me.status === "blocked" ? "gate.blockedTitle" : "gate.pendingTitle", { name: me.name })}</h1>
        <p>{t(me.status === "blocked" ? "gate.blockedDescription" : "gate.pendingDescription")}</p>
        <div className="gate-actions">
          {me.status === "pending" && <button className="button button-primary" onClick={() => window.location.reload()}>{t("gate.check")}</button>}
          <button className="button button-quiet" onClick={() => void signOut()}>{t("gate.signOut")}</button>
        </div>
      </section>}
    </main>;
  }
  if (dataLoadedFor !== creatureStorageKey) return loading;

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
    try { window.localStorage.setItem(importDoneKey(currentUser.id), "1"); } catch { /* banner just shows again */ }
    setLocalImport(null);
  }

  async function runImport() {
    if (!localImport) return;
    setImportBusy(true);
    try {
      const { imported } = await api<{ imported: { characters: number; campaigns: number } }>("/api/import", { method: "POST", body: localImport });
      finishImport();
      setImportMessage(t("import.done", imported));
      await reloadData();
    } catch {
      setImportMessage(t("import.error"));
    } finally {
      setImportBusy(false);
    }
  }

  function addCreature(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!creatureName.trim() || creatureXp < 1) return;
    setCreatures((current) => [{ id: makeId(), name: creatureName.trim(), xp: creatureXp, source: "Catálogo propio" }, ...current]);
    setCreatureName("");
  }

  return <main className="app-shell min-h-screen bg-paper text-ink">
    <aside className="sidebar">
      <button className="brand" onClick={() => setView("home")}><span>✳</span><b>GRIMOIRE</b></button>
      <div className="sidebar-caption">{t("nav.workspace")}</div>
      <nav className="side-nav" aria-label={t("nav.aria")}>
        <button className={view === "home" ? "active" : ""} onClick={() => setView("home")}><span aria-hidden="true">⌂</span>{t("nav.home")}</button>
        <button className={view === "characters" ? "active" : ""} onClick={() => setView("characters")}><span aria-hidden="true">♙</span>{t("nav.characters")}<small>{ownCharacters.length}</small></button>
        <button className={view === "campaigns" ? "active" : ""} onClick={() => setView("campaigns")}><span aria-hidden="true">⚑</span>{t("nav.campaigns")}<small>{campaigns.length}</small></button>
        <button className={view === "encounters" ? "active" : ""} onClick={() => setView("encounters")}><span aria-hidden="true">⚔</span>{t("nav.encounters")}</button>
        <button className={view === "account" ? "active" : ""} onClick={() => setView("account")}><span aria-hidden="true">⚿</span>{t("nav.account")}</button>
        {me.role === "admin" && <button className={view === "admin" ? "active" : ""} onClick={() => setView("admin")}><span aria-hidden="true">♛</span>{t("nav.admin")}{pendingCount > 0 && <small className="nav-alert" aria-label={t("admin.pendingAria", { count: pendingCount })}>{pendingCount}</small>}</button>}
      </nav>
      <div className="sidebar-bottom"><span className="edition-dot" />{t("common.rulesLabel")}<p>{t("nav.signedInAs", { name: me.name, role: t(`role.${me.role}`) })}</p></div>
    </aside>

    <section className="workspace">
      <header className="workspace-header"><div className="mobile-brand">✳ GRIMOIRE</div><span className="breadcrumb">{t("header.campaign")} <i>/</i> {title.toLocaleUpperCase(locale === "es" ? "es-ES" : "en-US")}</span>
        {controls}
        <span className="edition-badge">{t("common.edition")}</span></header>
      {(invite || inviteError) && <div className="import-banner" role="status"><span aria-hidden="true">⚑</span>
        {invite ? <p><b>{t("invite.title", { campaign: invite.campaignName })}</b> {invite.alreadyMember ? t("invite.already", { owner: invite.ownerName }) : t("invite.description", { owner: invite.ownerName })}</p>
          : <p>{inviteError}</p>}
        <div>{invite && <button className="button button-primary" disabled={inviteBusy} onClick={() => void acceptInvite()}>{t(inviteBusy ? "common.saving" : "invite.accept")}</button>}
          <button className="button button-quiet" disabled={inviteBusy} onClick={invite ? declineInvite : () => setInviteError("")}>{t(invite ? "invite.decline" : "invite.dismiss")}</button></div></div>}
      {view === "home" && <div className="page-content">
        {localImport && <div className="import-banner" role="status"><span aria-hidden="true">✦</span><p><b>{t("import.title")}</b> {t("import.description", { characters: localImport.characters.length, campaigns: localImport.campaigns.length })}</p>
          <div><button className="button button-primary" disabled={importBusy} onClick={() => void runImport()}>{t(importBusy ? "common.saving" : "import.action")}</button><button className="button button-quiet" disabled={importBusy} onClick={finishImport}>{t("import.dismiss")}</button></div></div>}
        {importMessage && <p className="import-message" role="status">{importMessage}</p>}
        <header className="desk-head">
          <div><h1>{t("home.title")}</h1><p>{t("home.signedIn", { name: me.name })}</p></div>
          <div className="desk-actions">
            <button className="button button-quiet" onClick={() => setView("encounters")}>⚔ {t("home.generateEncounter")}</button>
            <button className="button button-primary" onClick={() => setView("characters")}>✦ {t("home.createCharacter")}</button>
          </div>
        </header>
        <section className="tool-grid" aria-label={t("home.toolbox")}>
          <button className="tool-tile" onClick={() => setView("characters")}><span className="tool-glyph" aria-hidden="true">♙</span><strong>{t("nav.characters")}</strong><b>{ownCharacters.length}</b><small>{t("home.tool.characters")}</small></button>
          <button className="tool-tile" onClick={() => setView("campaigns")}><span className="tool-glyph" aria-hidden="true">⚑</span><strong>{t("home.campaigns")}</strong><b>{campaigns.length}</b><small>{t("home.tool.campaigns")}</small></button>
          <button className="tool-tile" onClick={() => setView("encounters")}><span className="tool-glyph" aria-hidden="true">⚔</span><strong>{t("nav.encounters")}</strong><b>{creatures.length}</b><small>{t("home.tool.encounters")}</small></button>
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
      </div>}

      {view === "characters" && <div className="page-content">
        <div className="section-title page-title"><div><p className="eyebrow">{t("characters.kicker")}</p><h1>{t("characters.title")}</h1><p className="title-description">{t("characters.description")}</p></div></div>
        <CharacterBuilder locale={locale} characters={ownCharacters} campaigns={campaigns.filter((campaign) => campaign.myRole)} onSave={saveCharacter} onDelete={deleteCharacter} />
        <p className="local-data-note">{t("characters.localData")}</p>
      </div>}

      {view === "campaigns" && <div className="page-content">
        <CampaignManager me={me} campaigns={campaigns} characters={characters} locale={locale} onChanged={reloadData} />
      </div>}

      {view === "encounters" && <div className="page-content">
        <div className="section-title page-title"><div><p className="eyebrow">{t("encounters.kicker")}</p><h1>{t("encounters.title")}</h1><p className="title-description">{t("encounters.description")}</p></div><button className="button button-quiet" onClick={() => setShowCatalog((open) => !open)}>{showCatalog ? t("encounters.closeCatalog") : t("encounters.catalog", { count: creatures.length })}</button></div>
        <EncounterBuilder locale={locale} creatures={creatures} characters={characters} campaigns={campaigns} />
        <BestiaryBrowser locale={locale} onAddCreature={(creature) => setCreatures((current) => current.some((item) => item.id === creature.id) ? current : [creature, ...current])} />
        {showCatalog && <section className="catalog-panel"><div className="catalog-heading"><div><p className="eyebrow">{t("catalog.kicker")}</p><h2>{t("catalog.title")}</h2><p>{t("catalog.description")}</p></div></div>
          <form className="creature-form" onSubmit={addCreature}><label>{t("catalog.name")}<input required maxLength={60} value={creatureName} onChange={(event) => setCreatureName(event.target.value)} placeholder={t("catalog.namePlaceholder")} /></label><label>{t("catalog.xp")}<input type="number" min={1} max={100000} value={creatureXp} onChange={(event) => setCreatureXp(Number(event.target.value))} /></label><button className="button button-primary" type="submit">{t("catalog.add")}</button></form>
          <div className="catalog-list">{creatures.map((creature) => <div className="catalog-row" key={creature.id}><span aria-hidden="true">✦</span><b>{creature.source === "Ejemplo editable" ? t(`creature.sample.${creature.xp}.name`) : creature.name}</b><small>{creature.source === "Ejemplo editable" ? t("creature.sample.source") : creature.source === "Catálogo propio" ? t("catalog.customSource") : creature.source}</small><strong>{creature.xp.toLocaleString(locale === "es" ? "es-ES" : "en-US")} XP</strong>{creature.source === "Catálogo propio" && <button className="small-action danger-action" onClick={() => setCreatures((current) => current.filter((item) => item.id !== creature.id))}>{t("catalog.remove")}</button>}</div>)}</div>
        </section>}
      </div>}

      {view === "account" && <div className="page-content">
        <div className="section-title page-title"><div><p className="eyebrow">{locale === "es" ? "SELLO DE IDENTIDAD" : "IDENTITY SEAL"}</p><h1>{t("nav.account")}</h1><p className="title-description">{locale === "es" ? "Protege tu acceso al grimorio." : "Secure your access to the Grimoire."}</p></div></div>
        <AuthPanel locale={locale} />
      </div>}

      {view === "admin" && me.role === "admin" && <div className="page-content">
        <div className="section-title page-title"><div><p className="eyebrow">{t("admin.kicker")}</p><h1>{t("nav.admin")}</h1><p className="title-description">{t("admin.description")}</p></div></div>
        <AdminUsers me={me} locale={locale} onPendingCount={setPendingCount} />
      </div>}
      <footer className="app-footer"><span>{t("footer.brand")}</span><span>{t("footer.rules")}</span></footer>
    </section>
  </main>;
}
