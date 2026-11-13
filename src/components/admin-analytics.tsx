"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { ANALYTICS_RANGES, percentChange, type AnalyticsRange, type AnalyticsReport, type Comparison, type Section } from "@/lib/analytics";
import { BarList, Sparkline, TimeChart, type Tone } from "./analytics-charts";
import { Skeleton, SkeletonRegion, Spinner } from "./skeleton";
import styles from "./admin-analytics.module.css";

type Locale = "en" | "es";

const text = {
  en: {
    period: "Period", kpis: "Key figures", days: (days: number) => `${days} days`, refresh: "Refresh", updated: (time: string) => `Updated ${time}`,
    vsPrevious: (days: number) => `vs. previous ${days} days`, noPrevious: "no earlier data",
    activeUsers: "Active accounts", activeDetail: (today: number, fresh: number, approved: number) => `${today} today · ${fresh} new · ${approved} approved accounts`,
    characters: "Characters created", charactersDetail: (creator: number, manual: number) => `${creator} with the creator · ${manual} quick edit`,
    encounters: "Encounters generated", encountersDetail: (saved: number) => `${saved} saved to a journal`,
    campaigns: "Campaigns created", campaignsDetail: (joined: number) => `${joined} players joined`,
    errors: "Errors", errorsDetail: (users: number, server: number, client: number) => `${users} accounts affected · ${server} server · ${client} browser`,
    dailyActive: "Active accounts per day", dailyActiveHelp: "Accounts that did anything in Grimoire that day.",
    activeOn: (count: number) => `${count} active account${count === 1 ? "" : "s"}`,
    wizard: "Character creator", wizardHelp: "Of the creators opened for a new character, how many ended in a saved character.",
    wizardStarted: "opened", wizardCompleted: "finished", wizardEmpty: "No one has opened the creator in this period.",
    sections: "Most visited sections", sectionsHelp: "Page views and distinct accounts per section.", sectionsEmpty: "No visits recorded yet.",
    usersIn: (count: number) => `${count} account${count === 1 ? "" : "s"}`,
    dailyErrors: "Errors per day", errorsOn: (count: number) => `${count} error${count === 1 ? "" : "s"}`,
    errorLog: "Error log", errorLogHelp: "Grouped by kind; the latest occurrence is shown. Server errors come from the API and page rendering, browser errors from people's devices.",
    noErrors: "No errors in this period.",
    server: "Server", client: "Browser", times: (count: number) => `×${count}`, affected: (count: number) => `${count} account${count === 1 ? "" : "s"}`,
    lastSeen: "last", firstSeen: "First seen", digest: "Digest", device: "Device", method: "Request", details: "Details", noStack: "No stack trace.",
    table: "Show daily figures as a table", date: "Day", tableActive: "Active", tableCharacters: "Characters", tableEncounters: "Encounters", tableCampaigns: "Campaigns", tableErrors: "Errors",
    loading: "Tallying the chronicle…", loadError: "The analytics couldn't be loaded.", retry: "Try again",
    empty: "Nothing recorded yet. Analytics start counting from this version on; come back after people have used the toolkit.",
    privacy: "Collected on this server only and deleted after 90 days. Events carry no names, notes or free text.",
    section: { home: "Home", characters: "Characters", "character-sheet": "Character sheet", campaigns: "Campaigns", encounters: "Encounters", account: "Account", admin: "Admin", map: "Battle map" } as Record<Section, string>,
  },
  es: {
    period: "Periodo", kpis: "Indicadores", days: (days: number) => `${days} días`, refresh: "Actualizar", updated: (time: string) => `Actualizado a las ${time}`,
    vsPrevious: (days: number) => `frente a los ${days} días anteriores`, noPrevious: "sin datos previos",
    activeUsers: "Cuentas activas", activeDetail: (today: number, fresh: number, approved: number) => `${today} hoy · ${fresh} nuevas · ${approved} cuentas aprobadas`,
    characters: "Personajes creados", charactersDetail: (creator: number, manual: number) => `${creator} con el creador · ${manual} en edición rápida`,
    encounters: "Encuentros generados", encountersDetail: (saved: number) => `${saved} guardados en un diario`,
    campaigns: "Campañas creadas", campaignsDetail: (joined: number) => `${joined} jugadores se unieron`,
    errors: "Errores", errorsDetail: (users: number, server: number, client: number) => `${users} cuentas afectadas · ${server} servidor · ${client} navegador`,
    dailyActive: "Cuentas activas por día", dailyActiveHelp: "Cuentas que hicieron algo en Grimoire ese día.",
    activeOn: (count: number) => `${count} cuenta${count === 1 ? "" : "s"} activa${count === 1 ? "" : "s"}`,
    wizard: "Creador de personajes", wizardHelp: "De los creadores abiertos para un personaje nuevo, cuántos terminaron con un personaje guardado.",
    wizardStarted: "abiertos", wizardCompleted: "terminados", wizardEmpty: "Nadie ha abierto el creador en este periodo.",
    sections: "Secciones más visitadas", sectionsHelp: "Visitas y cuentas distintas por sección.", sectionsEmpty: "Aún no hay visitas registradas.",
    usersIn: (count: number) => `${count} cuenta${count === 1 ? "" : "s"}`,
    dailyErrors: "Errores por día", errorsOn: (count: number) => `${count} error${count === 1 ? "" : "es"}`,
    errorLog: "Registro de errores", errorLogHelp: "Agrupados por tipo; se muestra la última vez que ocurrió. Los de servidor vienen de la API y del renderizado; los de navegador, de los dispositivos de la gente.",
    noErrors: "Sin errores en este periodo.",
    server: "Servidor", client: "Navegador", times: (count: number) => `×${count}`, affected: (count: number) => `${count} cuenta${count === 1 ? "" : "s"}`,
    lastSeen: "última vez", firstSeen: "Primera vez", digest: "Digest", device: "Dispositivo", method: "Petición", details: "Detalles", noStack: "Sin traza.",
    table: "Ver las cifras diarias como tabla", date: "Día", tableActive: "Activas", tableCharacters: "Personajes", tableEncounters: "Encuentros", tableCampaigns: "Campañas", tableErrors: "Errores",
    loading: "Contando la crónica…", loadError: "No se pudieron cargar las analíticas.", retry: "Reintentar",
    empty: "Aún no hay nada registrado. Las analíticas cuentan desde esta versión; vuelve cuando se haya usado el toolkit.",
    privacy: "Se guardan solo en este servidor y se borran a los 90 días. Los eventos no llevan nombres, notas ni texto libre.",
    section: { home: "Inicio", characters: "Personajes", "character-sheet": "Ficha de personaje", campaigns: "Campañas", encounters: "Encuentros", account: "Cuenta", admin: "Admin", map: "Mapa de batalla" } as Record<Section, string>,
  },
};

/** "▲ 12 %" coloured by whether the change is good news; never colour alone (arrow + words). */
function Delta({ value, days, upIsGood, locale }: { value: Comparison; days: number; upIsGood: boolean; locale: Locale }) {
  const t = text[locale];
  const change = percentChange(value);
  if (change === null) return <p className={styles.delta}>{value.current > 0 ? t.noPrevious : "—"}</p>;
  const direction = change > 0 ? "up" : change < 0 ? "down" : "flat";
  const mood = direction === "flat" ? "neutral" : (direction === "up") === upIsGood ? "good" : "bad";
  const arrow = direction === "up" ? "▲" : direction === "down" ? "▼" : "=";
  return <p className={styles.delta} data-mood={mood}>
    <b><span aria-hidden="true">{arrow} </span>{`${change > 0 ? "+" : ""}${change.toLocaleString(locale === "es" ? "es-ES" : "en-US")} %`}</b> {t.vsPrevious(days)}
  </p>;
}

function StatTile({ label, value, detail, comparison, days, upIsGood = true, trend, tone, locale, format }: {
  label: string; value: number; detail: string; comparison: Comparison; days: number; upIsGood?: boolean;
  trend: number[]; tone?: Tone; locale: Locale; format: Intl.NumberFormat;
}) {
  return <article className={styles.tile} data-tone={tone}>
    <h3>{tone === "critical" && <span className={styles.statusIcon} aria-hidden="true">!</span>}{label}</h3>
    <p className={styles.value}>{format.format(value)}</p>
    <Delta value={comparison} days={days} upIsGood={upIsGood} locale={locale} />
    <Sparkline values={trend} tone={tone} />
    <p className={styles.detail}>{detail}</p>
  </article>;
}

/** Usage and error figures for site admins (see /api/admin/analytics). */
export default function AdminAnalytics({ locale }: { locale: Locale }) {
  const t = text[locale];
  const numberLocale = locale === "es" ? "es-ES" : "en-US";
  const [days, setDays] = useState<AnalyticsRange>(30);
  const [report, setReport] = useState<AnalyticsReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  const load = useCallback(async (range: AnalyticsRange) => {
    setBusy(true);
    setError(false);
    try {
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const data = await api<{ report: AnalyticsReport }>(`/api/admin/analytics?days=${range}&tz=${encodeURIComponent(timeZone)}`);
      setReport(data.report);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => { void load(days); }, [days, load]);

  if (!report) {
    if (error) return <div className={styles.failure} role="alert"><p>{t.loadError}</p><button type="button" className="button button-primary" onClick={() => void load(days)}>{t.retry}</button></div>;
    return <SkeletonRegion label={t.loading} className={styles.skeleton}>
      <div className={styles.kpis}>{[0, 1, 2, 3, 4].map((item) => <div key={item} className={styles.tile}><Skeleton width="60%" height={12} /><Skeleton width="40%" height={30} style={{ marginTop: 10 }} /><Skeleton width="80%" height={10} style={{ marginTop: 12 }} /><Skeleton width="100%" height={32} style={{ marginTop: 10 }} /></div>)}</div>
      <Skeleton width="100%" height={240} style={{ marginTop: 14 }} />
    </SkeletonRegion>;
  }

  const format = new Intl.NumberFormat(numberLocale, { notation: "compact", maximumFractionDigits: 1 });
  const plain = new Intl.NumberFormat(numberLocale);
  const dayLabel = new Intl.DateTimeFormat(numberLocale, { day: "numeric", month: "short", timeZone: "UTC" });
  const dateTime = new Intl.DateTimeFormat(numberLocale, { dateStyle: "medium", timeStyle: "short" });
  const time = new Intl.DateTimeFormat(numberLocale, { timeStyle: "short" });
  const relative = new Intl.RelativeTimeFormat(numberLocale, { numeric: "auto" });
  const ago = (iso: string) => {
    // Relative to when the report was built, so rendering stays pure.
    const minutes = Math.round((new Date(iso).getTime() - new Date(report.range.generatedAt).getTime()) / 60_000);
    if (Math.abs(minutes) < 60) return relative.format(minutes, "minute");
    if (Math.abs(minutes) < 60 * 24) return relative.format(Math.round(minutes / 60), "hour");
    return relative.format(Math.round(minutes / (60 * 24)), "day");
  };
  const { kpis, daily } = report;
  const label = (date: string) => dayLabel.format(new Date(`${date}T00:00:00Z`));
  const series = (key: keyof (typeof daily)[number]) => daily.map((day) => Number(day[key]));
  const nothingYet = kpis.activeUsers.current === 0 && kpis.activeUsers.previous === 0 && kpis.errors.current === 0;
  const wizardRate = kpis.wizard.started ? Math.min(100, Math.round((kpis.wizard.completed / kpis.wizard.started) * 100)) : null;
  const maxViews = Math.max(1, ...report.sections.map((row) => row.views));

  return <div className={styles.dashboard} aria-busy={busy}>
    <div className={styles.filters}>
      <div className={styles.segmented} role="group" aria-label={t.period}>
        {ANALYTICS_RANGES.map((range) => <button key={range} type="button" aria-pressed={days === range} onClick={() => setDays(range)}>{t.days(range)}</button>)}
      </div>
      <button type="button" className="button button-quiet" disabled={busy} onClick={() => void load(days)}>{busy && <Spinner />}{t.refresh}</button>
      <p className={styles.updated} role="status">{error ? t.loadError : t.updated(time.format(new Date(report.range.generatedAt)))}</p>
    </div>

    <div className={styles.body} data-refreshing={busy || undefined}>
      {nothingYet && <p className={styles.notice}>{t.empty}</p>}

      <section className={styles.kpis} aria-label={t.kpis}>
        <StatTile locale={locale} format={format} days={days} label={t.activeUsers} value={kpis.activeUsers.current} comparison={kpis.activeUsers}
          detail={t.activeDetail(kpis.activeToday, kpis.newUsers.current, kpis.approvedUsers)} trend={series("activeUsers")} />
        <StatTile locale={locale} format={format} days={days} label={t.characters} value={kpis.charactersCreated.current} comparison={kpis.charactersCreated}
          detail={t.charactersDetail(kpis.charactersCreated.creator, kpis.charactersCreated.manual)} trend={series("characters")} />
        <StatTile locale={locale} format={format} days={days} label={t.encounters} value={kpis.encountersGenerated.current} comparison={kpis.encountersGenerated}
          detail={t.encountersDetail(kpis.encountersSaved.current)} trend={series("encounters")} />
        <StatTile locale={locale} format={format} days={days} label={t.campaigns} value={kpis.campaignsCreated.current} comparison={kpis.campaignsCreated}
          detail={t.campaignsDetail(kpis.campaignsJoined.current)} trend={series("campaigns")} />
        <StatTile locale={locale} format={format} days={days} label={t.errors} value={kpis.errors.current} comparison={kpis.errors} upIsGood={false} tone="critical"
          detail={t.errorsDetail(kpis.errors.users, kpis.errors.server, kpis.errors.client)} trend={series("errors")} />
      </section>

      <div className={styles.row}>
        <section className={`${styles.panel} ${styles.wide}`} aria-labelledby="analytics-active">
          <header><h2 id="analytics-active">{t.dailyActive}</h2><p>{t.dailyActiveHelp}</p></header>
          <TimeChart kind="line" label={t.dailyActive} describe={t.activeOn} points={daily.map((day) => ({ date: day.date, label: label(day.date), value: day.activeUsers }))} />
        </section>
        <section className={styles.panel} aria-labelledby="analytics-wizard">
          <header><h2 id="analytics-wizard">{t.wizard}</h2><p>{t.wizardHelp}</p></header>
          {wizardRate === null ? <p className={styles.empty}>{t.wizardEmpty}</p> : <div className={styles.funnel}>
            <p className={styles.rate}>{plain.format(wizardRate)} %</p>
            <div className={styles.meter} role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={wizardRate} aria-label={t.wizard}><span style={{ width: `${wizardRate}%` }} /></div>
            <dl>
              <div><dt>{t.wizardStarted}</dt><dd>{plain.format(kpis.wizard.started)}</dd></div>
              <div><dt>{t.wizardCompleted}</dt><dd>{plain.format(kpis.wizard.completed)}</dd></div>
            </dl>
          </div>}
        </section>
      </div>

      <div className={styles.row}>
        <section className={styles.panel} aria-labelledby="analytics-sections">
          <header><h2 id="analytics-sections">{t.sections}</h2><p>{t.sectionsHelp}</p></header>
          {report.sections.length ? <BarList max={maxViews} rows={report.sections.map((row) => ({
            key: row.section, label: t.section[row.section], value: row.views, display: plain.format(row.views), detail: t.usersIn(row.users),
          }))} /> : <p className={styles.empty}>{t.sectionsEmpty}</p>}
        </section>
        <section className={styles.panel} aria-labelledby="analytics-errors-daily">
          <header><h2 id="analytics-errors-daily"><span className={styles.statusIcon} aria-hidden="true">!</span>{t.dailyErrors}</h2><p>{t.errorsDetail(kpis.errors.users, kpis.errors.server, kpis.errors.client)}</p></header>
          <TimeChart kind="column" tone="critical" label={t.dailyErrors} describe={t.errorsOn} height={170} points={daily.map((day) => ({ date: day.date, label: label(day.date), value: day.errors }))} />
        </section>
      </div>

      <details className={styles.tableView}>
        <summary>{t.table}</summary>
        <div className={styles.tableScroll}>
          <table>
            <thead><tr><th scope="col">{t.date}</th><th scope="col">{t.tableActive}</th><th scope="col">{t.tableCharacters}</th><th scope="col">{t.tableEncounters}</th><th scope="col">{t.tableCampaigns}</th><th scope="col">{t.tableErrors}</th></tr></thead>
            <tbody>{[...daily].reverse().map((day) => <tr key={day.date}>
              <th scope="row">{label(day.date)}</th><td>{day.activeUsers}</td><td>{day.characters}</td><td>{day.encounters}</td><td>{day.campaigns}</td><td>{day.errors}</td>
            </tr>)}</tbody>
          </table>
        </div>
      </details>

      <section className={styles.panel} aria-labelledby="analytics-error-log">
        <header><h2 id="analytics-error-log">{t.errorLog}</h2><p>{t.errorLogHelp}</p></header>
        {!report.errors.length ? <p className={styles.allClear}><span aria-hidden="true">✓</span>{t.noErrors}</p> : <ul className={styles.errorList}>
          {report.errors.map((item) => <li key={item.fingerprint}>
            <div className={styles.errorHead}>
              <span className={styles.badge} data-source={item.source}>{item.source === "server" ? t.server : t.client}</span>
              <p className={styles.errorMessage}><b>{item.name}</b> {item.message}</p>
            </div>
            <p className={styles.errorMeta}>
              {item.route && <code>{item.method ? `${item.method} ` : ""}{item.route}</code>}
              <span>{t.times(item.count)}</span>
              <span>{t.affected(item.users)}</span>
              <span>{t.lastSeen} <time dateTime={item.lastSeen} title={dateTime.format(new Date(item.lastSeen))}>{ago(item.lastSeen)}</time></span>
            </p>
            <details>
              <summary>{t.details}</summary>
              <dl className={styles.errorFacts}>
                <div><dt>{t.firstSeen}</dt><dd>{dateTime.format(new Date(item.firstSeen))}</dd></div>
                {item.userAgent && <div><dt>{t.device}</dt><dd>{item.userAgent}</dd></div>}
                {item.digest && <div><dt>{t.digest}</dt><dd><code>{item.digest}</code></dd></div>}
              </dl>
              {item.stack ? <pre>{item.stack}</pre> : <p className={styles.empty}>{t.noStack}</p>}
            </details>
          </li>)}
        </ul>}
      </section>

      <p className={styles.privacy}>{t.privacy}</p>
    </div>
  </div>;
}
