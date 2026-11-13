import { Skeleton, SkeletonLine, SkeletonRegion } from "./skeleton";
import { ArcaneBackdrop, BrandMark } from "./brand";

/**
 * What the Toolkit paints while the session (and then /api/me) loads. It reuses the real layout
 * classes (gate-shell, app-shell, sidebar, desk-head, tool-tile…) with placeholders in place of text,
 * so the page keeps its shape when the real content arrives instead of jumping between layouts.
 *
 * - "gate": nobody is signed in (or we cannot tell yet and the server saw no session cookie):
 *   the sign-in page's header, intro and form card.
 * - "home" / "section": a session is known or very likely: the signed-in shell, with the dashboard
 *   or a generic page heading depending on the route.
 */
export type LoadingVariant = "gate" | "home" | "section";

const labels = { en: "Opening the Grimoire…", es: "Abriendo el grimorio…" } as const;
const navWidths = ["58%", "66%", "62%", "64%", "50%"];

/** `activeNav`: index of the current view in the sidebar (home, characters, campaigns, encounters, account), so it is already lit. */
export function LoadingShell({ variant, locale, activeNav = -1 }: { variant: LoadingVariant; locale: "en" | "es"; activeNav?: number }) {
  const label = labels[locale];
  if (variant === "gate") return <GateSkeleton label={label} />;

  return <div className="app-shell min-h-screen bg-paper text-ink skeleton-shell" aria-busy="true">
    <ArcaneBackdrop variant="app" />
    <aside className="sidebar" aria-hidden="true" inert>
      <div className="brand"><BrandMark size={26} /><b>GRIMOIRE</b></div>
      <div className="sidebar-caption"><SkeletonLine width="9ch" /></div>
      <div className="side-nav">{navWidths.map((width, index) => <button type="button" tabIndex={-1} key={index} className={index === activeNav ? "active" : undefined}>
        <span><Skeleton className="skeleton-circle" width={16} height={16} /></span><SkeletonLine width={width} />
      </button>)}</div>
      <div className="sidebar-bottom"><SkeletonLine width="13ch" /><p><SkeletonLine width="10ch" /></p><span className="sidebar-signout skeleton-ghost">&nbsp;</span></div>
    </aside>
    <div className="workspace">
      <header className="workspace-header" aria-hidden="true" inert>
        <div className="mobile-brand"><BrandMark size={20} /> <span className="brand-word">GRIMOIRE</span></div>
        <span className="breadcrumb"><SkeletonLine width="18ch" /></span>
        <HeaderControls />
        <span className="header-signout skeleton-ghost skeleton-icon-control">&nbsp;</span>
        <span className="edition-badge skeleton-ghost">5E · 2024</span>
      </header>
      <main className="page-content" aria-busy="true">
        <SkeletonRegion label={label}>
          <div aria-hidden="true">{variant === "home" ? <HomeSkeleton /> : <SectionSkeleton />}</div>
        </SkeletonRegion>
      </main>
      <footer className="app-footer" aria-hidden="true">
        {/* On phones both footer notes wrap onto a second line. */}
        <span><SkeletonLine width="min(24ch, 40vw)" /><SkeletonLine width="10ch" className="skeleton-narrow-only" /></span>
        <span><SkeletonLine width="min(18ch, 40vw)" /><SkeletonLine width="8ch" className="skeleton-narrow-only" /></span>
      </footer>
    </div>
  </div>;
}

/** Placeholders the size of the theme toggle and language select (the real ones need the locale and theme). */
function HeaderControls() {
  return <div className="header-controls">
    <span className="header-control theme-toggle skeleton-ghost skeleton-theme-control">&nbsp;</span>
    <span className="header-select"><span className="header-control skeleton-ghost skeleton-select-control">&nbsp;</span></span>
  </div>;
}

function HomeSkeleton() {
  return <>
    <header className="desk-head">
      <div><h1><SkeletonLine width="11ch" /></h1><p><SkeletonLine width="11ch" /></p></div>
      <div className="desk-actions">
        <span className="button button-quiet skeleton-ghost skeleton-action">&nbsp;</span>
        <span className="button button-primary skeleton-ghost skeleton-action">&nbsp;</span>
      </div>
    </header>
    <div className="tool-grid">{[0, 1, 2, 3].map((item) => <div key={item} className="tool-tile skeleton-tile">
      <Skeleton className="tool-glyph skeleton-circle" />
      <strong><SkeletonLine width="72%" /></strong>
      <b><SkeletonLine width="1.2ch" /></b>
      {/* The encounters note runs to two lines in both languages; the row takes the tallest tile. */}
      <small><SkeletonLine width="80%" />{item === 2 && <SkeletonLine width="55%" />}</small>
    </div>)}</div>
    <section className="desk-panel">
      <div className="desk-panel-head"><h2><SkeletonLine width="13ch" /></h2></div>
      <p className="desk-empty skeleton-inline"><SkeletonLine width="13ch" /><span className="small-action skeleton-ghost skeleton-small-action">&nbsp;</span></p>
    </section>
    <p className="local-data-note"><SkeletonLine width="min(64ch, 100%)" /><SkeletonLine width="30%" className="skeleton-narrow-only" /></p>
  </>;
}

function SectionSkeleton() {
  return <>
    <div className="section-title page-title">
      <div><p className="eyebrow"><span /><SkeletonLine width="14ch" /></p><h1><SkeletonLine width="11ch" /></h1><p className="title-description"><SkeletonLine width="min(64ch, 100%)" /></p></div>
    </div>
    <div className="skeleton-grid">
      {[0, 1, 2].map((item) => <div key={item} className="skeleton-row"><Skeleton width={36} height={36} className="skeleton-circle" /><div className="skeleton-grow"><Skeleton width="45%" height={14} /></div></div>)}
    </div>
  </>;
}

/**
 * The sign-in gate (toolkit.tsx + auth-panel.tsx): same header, stage, cover and panel classes, with the
 * sign-in step's rhythm in placeholders: kicker, title, two labelled fields, submit, passkey, footer link.
 */
function GateSkeleton({ label }: { label: string }) {
  return <div className="gate-shell text-ink skeleton-shell" aria-busy="true">
    <ArcaneBackdrop />
    <header className="gate-header" aria-hidden="true" inert><span className="gate-brand"><BrandMark size={26} />GRIMOIRE</span><HeaderControls /></header>
    <main className="gate-main">
      <SkeletonRegion label={label} className="gate-stage">
        <div className="gate-cover" aria-hidden="true">
          <span className="gate-seal">✳︎</span>
          <p className="eyebrow gate-cover-kicker"><span /><SkeletonLine width="13ch" /></p>
          {/* Line counts follow the real copy: the title wraps to three lines beside the form, two when stacked; the intro the other way round. */}
          <div className="gate-cover-title"><SkeletonLine width="100%" /><SkeletonLine width="90%" /><SkeletonLine width="45%" className="skeleton-wide-only" /></div>
          <div className="gate-intro"><SkeletonLine width="100%" /><SkeletonLine width="100%" /><SkeletonLine width="70%" /><SkeletonLine width="40%" className="skeleton-narrow-only" /></div>
          <ul className="gate-features">{["9ch", "8ch", "9ch"].map((width, index) => <li key={index}><Skeleton className="skeleton-circle" width={17} height={17} /><SkeletonLine width={width} /></li>)}</ul>
        </div>
        <div className="auth-panel" data-mode="sign-in" aria-hidden="true">
          <div className="auth-head"><p className="eyebrow"><span /><SkeletonLine width="12ch" /></p><div className="auth-title"><SkeletonLine width="9ch" /></div></div>
          <div className="auth-form">
            {["14ch", "9ch"].map((width, index) => <div key={index} className="auth-field">
              <span className="auth-label"><SkeletonLine width={width} /></span>
              {index === 1 && <span className="auth-link auth-field-aside"><SkeletonLine width="12ch" /></span>}
              <div className="auth-control"><span className="auth-input skeleton-ghost" /></div>
            </div>)}
            <span className="button button-primary auth-submit skeleton-ghost">&nbsp;</span>
          </div>
          <div className="auth-divider"><SkeletonLine width="2ch" /></div>
          <span className="button button-quiet auth-alt skeleton-ghost">&nbsp;</span>
          <div className="auth-foot"><p><span className="auth-link"><SkeletonLine width="22ch" /></span></p></div>
        </div>
      </SkeletonRegion>
    </main>
  </div>;
}
