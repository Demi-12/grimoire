"use client";

import { useEffect, useState, type FormEvent } from "react";
import CharacterBuilder from "@/components/character-builder";
import EncounterBuilder from "@/components/encounter-builder";
import { sampleCreatures, type Creature } from "@/lib/rules";
import { detectLocale, translate, type Locale } from "@/lib/i18n";

type View = "home" | "characters" | "encounters";
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
  const [view, setView] = useState<View>("home");
  const [locale, setLocale] = useState<Locale>("en");
  const [theme, setTheme] = useState<Theme>("light");
  const [themeReady, setThemeReady] = useState(false);
  const [localeReady, setLocaleReady] = useState(false);
  const [characters, setCharacters] = useState<{ id: string }[]>([]);
  const [creatures, setCreatures] = useState<Creature[]>(sampleCreatures);
  const [creatureName, setCreatureName] = useState("");
  const [creatureXp, setCreatureXp] = useState(100);
  const [showCatalog, setShowCatalog] = useState(false);

  const t = (key: string, values?: Record<string, string | number>) => translate(locale, key, values);

  useEffect(() => {
    setCharacters(readSaved("grimoire.characters.v1", []));
    setCreatures(readSaved("grimoire.creatures.v1", sampleCreatures));
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
    if (view === "home") setCharacters(readSaved("grimoire.characters.v1", []));
  }, [view]);
  useEffect(() => {
    window.localStorage.setItem("grimoire.creatures.v1", JSON.stringify(creatures));
  }, [creatures]);
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

  const title = view === "home" ? t("nav.home") : view === "characters" ? t("nav.characters") : t("nav.encounters");

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
      </nav>
      <div className="sidebar-bottom"><span className="edition-dot" />{t("common.rulesLabel")}<p>{t("nav.localData")}</p></div>
    </aside>

    <section className="workspace">
      <header className="workspace-header"><div className="mobile-brand">✳ GRIMOIRE</div><span className="breadcrumb">{t("header.campaign")} <i>/</i> {title.toLocaleUpperCase(locale === "es" ? "es-ES" : "en-US")}</span>
        <button type="button" className="theme-toggle ml-auto rounded-md border border-line px-2 py-1.5 text-xs text-ink" aria-label={t(theme === "dark" ? "theme.switchToLight" : "theme.switchToDark")} onClick={() => setTheme((current) => current === "dark" ? "light" : "dark")}>{theme === "dark" ? "☀" : "☾"}<span>{t(theme === "dark" ? "theme.light" : "theme.dark")}</span></button>
        <label className="inline-flex items-center gap-2 text-xs text-muted"><span className="sr-only">{t("common.language")}</span><select aria-label={t("common.language")} className="rounded-md border border-line bg-parchment px-2 py-1.5 text-ink focus-visible:ring-2 focus-visible:ring-forest" value={locale} onChange={(event) => setLocale(event.target.value as Locale)}><option value="en">{t("common.english")}</option><option value="es">{t("common.spanish")}</option></select></label>
        <span className="edition-badge">{t("common.edition")}</span></header>
      {view === "home" && <div className="page-content">
        <section className="welcome-banner"><div className="banner-copy"><p className="eyebrow light-eyebrow"><span /> {t("home.journal")}</p><h1>{locale === "es" ? <>Las grandes historias<br />empiezan <em>aquí.</em></> : <>Great stories<br />start <em>here.</em></>}</h1><p>{t("home.description")}</p><div className="banner-actions"><button className="button button-lime" onClick={() => setView("characters")}>{t("home.createCharacter")} <span>↗</span></button><button className="button button-outline" onClick={() => setView("encounters")}>{t("home.prepareEncounter")}</button></div></div><div className="banner-art" aria-hidden="true"><div className="art-ring ring-a" /><div className="art-ring ring-b" /><span>✳</span><small>EST. MMXXIV</small></div></section>
        <section className="dashboard-section"><div className="section-title"><div><p className="eyebrow">{t("home.startingPoint")}</p><h2>{t("home.toolbox")}</h2></div><span className="section-aside">{t("home.savedCharacters", { count: characters.length, label: t(characters.length === 1 ? "home.characterSingular" : "home.characterPlural") })}</span></div><div className="dashboard-grid">
          <button className="dashboard-card" onClick={() => setView("characters")}><span className="dashboard-icon">♙</span><span className="card-kicker">{t("home.charactersKicker")}</span><strong>{t("home.characterCardTitle")}</strong><p>{t("home.characterCardDescription")}</p><span className="card-link">{t("home.openCreator")} <b>↗</b></span></button>
          <button className="dashboard-card" onClick={() => setView("encounters")}><span className="dashboard-icon crossed-swords">⚔</span><span className="card-kicker">{t("home.encountersKicker")}</span><strong>{t("home.encounterCardTitle")}</strong><p>{t("home.encounterCardDescription")}</p><span className="card-link">{t("home.generateEncounter")} <b>↗</b></span></button>
        </div></section>
        <div className="privacy-note"><span>◈</span><p><b>{t("home.privacyTitle")}</b> {t("home.privacyDescription")}</p></div>
      </div>}

      {view === "characters" && <div className="page-content">
        <div className="section-title page-title"><div><p className="eyebrow">{t("characters.kicker")}</p><h1>{t("characters.title")}</h1><p className="title-description">{t("characters.description")}</p></div></div>
        <CharacterBuilder locale={locale} />
        <p className="local-data-note">{t("characters.localData")}</p>
      </div>}

      {view === "encounters" && <div className="page-content">
        <div className="section-title page-title"><div><p className="eyebrow">{t("encounters.kicker")}</p><h1>{t("encounters.title")}</h1><p className="title-description">{t("encounters.description")}</p></div><button className="button button-quiet" onClick={() => setShowCatalog((open) => !open)}>{showCatalog ? t("encounters.closeCatalog") : t("encounters.catalog", { count: creatures.length })}</button></div>
        <EncounterBuilder locale={locale} creatures={creatures} />
        {showCatalog && <section className="catalog-panel"><div className="catalog-heading"><div><p className="eyebrow">{t("catalog.kicker")}</p><h2>{t("catalog.title")}</h2><p>{t("catalog.description")}</p></div></div>
          <form className="creature-form" onSubmit={addCreature}><label>{t("catalog.name")}<input required maxLength={60} value={creatureName} onChange={(event) => setCreatureName(event.target.value)} placeholder={t("catalog.namePlaceholder")} /></label><label>{t("catalog.xp")}<input type="number" min={1} max={100000} value={creatureXp} onChange={(event) => setCreatureXp(Number(event.target.value))} /></label><button className="button button-primary" type="submit">{t("catalog.add")}</button></form>
          <div className="catalog-list">{creatures.map((creature) => <div className="catalog-row" key={creature.id}><span aria-hidden="true">✦</span><b>{creature.source === "Ejemplo editable" ? t(`creature.sample.${creature.xp}.name`) : creature.name}</b><small>{creature.source === "Ejemplo editable" ? t("creature.sample.source") : creature.source === "Catálogo propio" ? t("catalog.customSource") : creature.source}</small><strong>{creature.xp.toLocaleString(locale === "es" ? "es-ES" : "en-US")} XP</strong>{creature.source === "Catálogo propio" && <button className="small-action danger-action" onClick={() => setCreatures((current) => current.filter((item) => item.id !== creature.id))}>{t("catalog.remove")}</button>}</div>)}</div>
        </section>}
      </div>}
      <footer className="app-footer"><span>{t("footer.brand")}</span><span>{t("footer.rules")}</span></footer>
    </section>
  </main>;
}
