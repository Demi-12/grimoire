"use client";

import { useEffect, useState, type FormEvent } from "react";
import CharacterBuilder from "@/components/character-builder";
import EncounterBuilder from "@/components/encounter-builder";
import CampaignManager from "@/components/campaign-manager";
import BestiaryBrowser from "@/components/bestiary-browser";
import { AuthPanel } from "@/components/auth/auth-panel";
import { authClient } from "@/lib/auth-client";
import { isGuestLocation, LEGACY_CHARACTERS_LOCATION, storageLocation } from "@/lib/storage";
import { sampleCreatures, type Creature } from "@/lib/rules";
import { detectLocale, translate, type Locale } from "@/lib/i18n";

type View = "home" | "characters" | "encounters" | "account";
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

export default function Toolkit() {
  const authSession = authClient.useSession();
  const accountId = authSession.data?.user.id;
  const characterStorageKey = storageLocation("characters", accountId);
  const creatureStorageKey = storageLocation("creatures", accountId);
  const campaignStorageKey = storageLocation("campaigns", accountId);
  const [view, setView] = useState<View>("home");
  const [locale, setLocale] = useState<Locale>("en");
  const [theme, setTheme] = useState<Theme>("light");
  const [themeReady, setThemeReady] = useState(false);
  const [localeReady, setLocaleReady] = useState(false);
  const [dataLoadedFor, setDataLoadedFor] = useState("");
  const [characters, setCharacters] = useState<{ id: string; name: string; level: number; className?: string; species?: string }[]>([]);
  const [campaignCount, setCampaignCount] = useState(0);
  const [creatures, setCreatures] = useState<Creature[]>(sampleCreatures);
  const [creatureName, setCreatureName] = useState("");
  const [creatureXp, setCreatureXp] = useState(100);
  const [showCatalog, setShowCatalog] = useState(false);

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
  useEffect(() => {
    if (authSession.isPending) return;
    setCharacters(readSaved(characterStorageKey, isGuestLocation(characterStorageKey, "characters") ? readSaved(LEGACY_CHARACTERS_LOCATION, []) : []));
    setCreatures(readSaved(creatureStorageKey, sampleCreatures));
    setDataLoadedFor(`${characterStorageKey}|${creatureStorageKey}`);
  }, [authSession.isPending, characterStorageKey, creatureStorageKey]);
  useEffect(() => {
    if (view !== "home" || authSession.isPending) return;
    setCharacters(readSaved(characterStorageKey, isGuestLocation(characterStorageKey, "characters") ? readSaved(LEGACY_CHARACTERS_LOCATION, []) : []));
    const campaigns = readSaved<unknown>(campaignStorageKey, []);
    setCampaignCount(Array.isArray(campaigns) ? campaigns.length : 0);
  }, [view, authSession.isPending, characterStorageKey, campaignStorageKey]);
  useEffect(() => {
    if (dataLoadedFor === `${characterStorageKey}|${creatureStorageKey}`) window.localStorage.setItem(creatureStorageKey, JSON.stringify(creatures));
  }, [creatures, characterStorageKey, creatureStorageKey, dataLoadedFor]);
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

  if (authSession.isPending || dataLoadedFor !== `${characterStorageKey}|${creatureStorageKey}`) {
    return <main className="app-shell min-h-screen bg-paper text-ink"><p role="status" className="page-content">{locale === "es" ? "Abriendo el grimorio…" : "Opening the Grimoire…"}</p></main>;
  }

  const title = view === "home" ? t("nav.home") : view === "characters" ? t("nav.characters") : view === "encounters" ? t("nav.encounters") : t("nav.account");

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
        <button className={view === "characters" ? "active" : ""} onClick={() => setView("characters")}><span aria-hidden="true">♙</span>{t("nav.characters")}<small>{characters.length}</small></button>
        <button className={view === "encounters" ? "active" : ""} onClick={() => setView("encounters")}><span aria-hidden="true">⚔</span>{t("nav.encounters")}</button>
        <button className={view === "account" ? "active" : ""} onClick={() => setView("account")}><span aria-hidden="true">⚿</span>{t("nav.account")}</button>
      </nav>
      <div className="sidebar-bottom"><span className="edition-dot" />{t("common.rulesLabel")}<p>{t("nav.localData")}</p></div>
    </aside>

    <section className="workspace">
      <header className="workspace-header"><div className="mobile-brand">✳ GRIMOIRE</div><span className="breadcrumb">{t("header.campaign")} <i>/</i> {title.toLocaleUpperCase(locale === "es" ? "es-ES" : "en-US")}</span>
        <button type="button" className="theme-toggle ml-auto rounded-md border border-line px-2 py-1.5 text-xs text-ink" aria-label={t(theme === "dark" ? "theme.switchToLight" : "theme.switchToDark")} onClick={() => setTheme((current) => current === "dark" ? "light" : "dark")}>{theme === "dark" ? "☀" : "☾"}<span>{t(theme === "dark" ? "theme.light" : "theme.dark")}</span></button>
        <label className="inline-flex items-center gap-2 text-xs text-muted"><span className="sr-only">{t("common.language")}</span><select aria-label={t("common.language")} className="rounded-md border border-line bg-parchment px-2 py-1.5 text-ink focus-visible:ring-2 focus-visible:ring-forest" value={locale} onChange={(event) => setLocale(event.target.value as Locale)}><option value="en">{t("common.english")}</option><option value="es">{t("common.spanish")}</option></select></label>
        <span className="edition-badge">{t("common.edition")}</span></header>
      {view === "home" && <div className="page-content">
        <header className="desk-head">
          <div><h1>{t("home.title")}</h1><p>{accountId ? t("home.signedIn", { name: authSession.data?.user.name ?? "" }) : t("home.guest")}</p></div>
          <div className="desk-actions">
            <button className="button button-quiet" onClick={() => setView("encounters")}>⚔ {t("home.generateEncounter")}</button>
            <button className="button button-primary" onClick={() => setView("characters")}>✦ {t("home.createCharacter")}</button>
          </div>
        </header>
        <section className="tool-grid" aria-label={t("home.toolbox")}>
          <button className="tool-tile" onClick={() => setView("characters")}><span className="tool-glyph" aria-hidden="true">♙</span><strong>{t("nav.characters")}</strong><b>{characters.length}</b><small>{t("home.tool.characters")}</small></button>
          <button className="tool-tile" onClick={() => setView("characters")}><span className="tool-glyph" aria-hidden="true">⚑</span><strong>{t("home.campaigns")}</strong><b>{campaignCount}</b><small>{t("home.tool.campaigns")}</small></button>
          <button className="tool-tile" onClick={() => setView("encounters")}><span className="tool-glyph" aria-hidden="true">⚔</span><strong>{t("nav.encounters")}</strong><b>{creatures.length}</b><small>{t("home.tool.encounters")}</small></button>
          <button className="tool-tile" onClick={() => setView("account")}><span className="tool-glyph" aria-hidden="true">⚿</span><strong>{t("nav.account")}</strong><b className="tool-status">{accountId ? "✓" : "—"}</b><small>{t(accountId ? "home.tool.accountOn" : "home.tool.accountOff")}</small></button>
        </section>
        <section className="desk-panel">
          <div className="desk-panel-head"><h2>{t("home.recent")}</h2>{characters.length > 4 && <button className="small-action" onClick={() => setView("characters")}>{t("home.seeAll", { count: characters.length })}</button>}</div>
          {characters.length ? <ul className="roster">{characters.slice(0, 4).map((character) => <li key={character.id}>
            <button onClick={() => setView("characters")}><span className="roster-mark">{character.name.slice(0, 1).toLocaleUpperCase(locale === "es" ? "es-ES" : "en-US")}</span>
              <span className="roster-name">{character.name}<small>{[character.className, character.species].filter(Boolean).join(" · ") || t("character.adventurer")}</small></span>
              <span className="roster-level">{t("character.levelPill", { level: character.level })}</span></button>
          </li>)}</ul> : <p className="desk-empty">{t("home.noCharacters")} <button className="small-action" onClick={() => setView("characters")}>{t("home.createCharacter")}</button></p>}
        </section>
        <p className="local-data-note">◈ {t("home.privacyDescription")}</p>
      </div>}

      {view === "characters" && <div className="page-content">
        <div className="section-title page-title"><div><p className="eyebrow">{t("characters.kicker")}</p><h1>{t("characters.title")}</h1><p className="title-description">{t("characters.description")}</p></div></div>
        <CharacterBuilder locale={locale} storageKey={characterStorageKey} onCharactersChange={setCharacters} />
        <CampaignManager characters={characters} locale={locale} storageKey={campaignStorageKey} />
        <p className="local-data-note">{t("characters.localData")}</p>
      </div>}

      {view === "encounters" && <div className="page-content">
        <div className="section-title page-title"><div><p className="eyebrow">{t("encounters.kicker")}</p><h1>{t("encounters.title")}</h1><p className="title-description">{t("encounters.description")}</p></div><button className="button button-quiet" onClick={() => setShowCatalog((open) => !open)}>{showCatalog ? t("encounters.closeCatalog") : t("encounters.catalog", { count: creatures.length })}</button></div>
        <EncounterBuilder locale={locale} creatures={creatures} characterStorageKey={characterStorageKey} />
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
      <footer className="app-footer"><span>{t("footer.brand")}</span><span>{t("footer.rules")}</span></footer>
    </section>
  </main>;
}
