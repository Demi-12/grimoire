import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from "@angular/core";
import { ANALYTICS_RANGES, percentChange, type AnalyticsRange, type AnalyticsReport, type Comparison, type Section } from "@grimoire/shared/analytics";
import { api } from "../core/api-client";
import { I18nService } from "../core/i18n.service";
import { BarListComponent, SparklineComponent, TimeChartComponent, type Tone } from "./analytics-charts.component";
import { SKELETONS } from "./skeleton.component";

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

type Copy = (typeof text)["en"];

/**
 * "▲ 12 %" coloured by whether the change is good news; never colour alone (arrow + words).
 * `change` null means there is nothing to compare against and `fallback` is shown instead.
 */
type Delta =
  | { change: null; fallback: string }
  | { change: string; mood: "good" | "bad" | "neutral"; arrow: string; versus: string };

function delta(value: Comparison, days: number, upIsGood: boolean, t: Copy, numberLocale: string): Delta {
  const change = percentChange(value);
  if (change === null) return { change: null, fallback: value.current > 0 ? t.noPrevious : "—" };
  const direction = change > 0 ? "up" : change < 0 ? "down" : "flat";
  const mood = direction === "flat" ? "neutral" : (direction === "up") === upIsGood ? "good" : "bad";
  const arrow = direction === "up" ? "▲" : direction === "down" ? "▼" : "=";
  return { change: `${change > 0 ? "+" : ""}${change.toLocaleString(numberLocale)} %`, mood, arrow, versus: t.vsPrevious(days) };
}

/** Usage and error figures for site admins (see /api/admin/analytics). */
@Component({
  selector: "app-admin-analytics",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BarListComponent, SparklineComponent, TimeChartComponent, SKELETONS],
  styleUrl: "./admin-analytics.component.css",
  host: { class: "contents" },
  templateUrl: "./admin-analytics.component.html",
})
export class AdminAnalyticsComponent {
  private readonly i18n = inject(I18nService);
  protected readonly t = computed(() => text[this.i18n.locale()]);

  protected readonly ranges = ANALYTICS_RANGES;
  protected readonly placeholders = [0, 1, 2, 3, 4];
  protected readonly days = signal<AnalyticsRange>(30);
  protected readonly report = signal<AnalyticsReport | null>(null);
  protected readonly busy = signal(false);
  protected readonly error = signal(false);

  /** Everything the dashboard shows, worked out once per report (and per language and period). */
  protected readonly view = computed(() => {
    const report = this.report();
    if (!report) return null;
    const t = this.t();
    const days = this.days();
    const numberLocale = this.i18n.locale() === "es" ? "es-ES" : "en-US";
    const format = new Intl.NumberFormat(numberLocale, { notation: "compact", maximumFractionDigits: 1 });
    const plain = new Intl.NumberFormat(numberLocale);
    const dayLabel = new Intl.DateTimeFormat(numberLocale, { day: "numeric", month: "short", timeZone: "UTC" });
    const dateTime = new Intl.DateTimeFormat(numberLocale, { dateStyle: "medium", timeStyle: "short" });
    const time = new Intl.DateTimeFormat(numberLocale, { timeStyle: "short" });
    const relative = new Intl.RelativeTimeFormat(numberLocale, { numeric: "auto" });
    const ago = (iso: string) => {
      // Relative to when the report was built, so the figures do not depend on when they are drawn.
      const minutes = Math.round((new Date(iso).getTime() - new Date(report.range.generatedAt).getTime()) / 60_000);
      if (Math.abs(minutes) < 60) return relative.format(minutes, "minute");
      if (Math.abs(minutes) < 60 * 24) return relative.format(Math.round(minutes / 60), "hour");
      return relative.format(Math.round(minutes / (60 * 24)), "day");
    };
    const { kpis, daily } = report;
    const label = (date: string) => dayLabel.format(new Date(`${date}T00:00:00Z`));
    const series = (key: keyof (typeof daily)[number]) => daily.map((day) => Number(day[key]));
    const tile = (name: string, value: number, comparison: Comparison, detail: string, trend: number[], tone?: Tone, upIsGood = true) => ({
      label: name, value: format.format(value), delta: delta(comparison, days, upIsGood, t, numberLocale), detail, trend, tone,
    });
    const wizardRate = kpis.wizard.started ? Math.min(100, Math.round((kpis.wizard.completed / kpis.wizard.started) * 100)) : null;
    return {
      updated: t.updated(time.format(new Date(report.range.generatedAt))),
      nothingYet: kpis.activeUsers.current === 0 && kpis.activeUsers.previous === 0 && kpis.errors.current === 0,
      tiles: [
        tile(t.activeUsers, kpis.activeUsers.current, kpis.activeUsers, t.activeDetail(kpis.activeToday, kpis.newUsers.current, kpis.approvedUsers), series("activeUsers")),
        tile(t.characters, kpis.charactersCreated.current, kpis.charactersCreated, t.charactersDetail(kpis.charactersCreated.creator, kpis.charactersCreated.manual), series("characters")),
        tile(t.encounters, kpis.encountersGenerated.current, kpis.encountersGenerated, t.encountersDetail(kpis.encountersSaved.current), series("encounters")),
        tile(t.campaigns, kpis.campaignsCreated.current, kpis.campaignsCreated, t.campaignsDetail(kpis.campaignsJoined.current), series("campaigns")),
        tile(t.errors, kpis.errors.current, kpis.errors, t.errorsDetail(kpis.errors.users, kpis.errors.server, kpis.errors.client), series("errors"), "critical", false),
      ],
      activePoints: daily.map((day) => ({ date: day.date, label: label(day.date), value: day.activeUsers })),
      errorPoints: daily.map((day) => ({ date: day.date, label: label(day.date), value: day.errors })),
      errorsDetail: t.errorsDetail(kpis.errors.users, kpis.errors.server, kpis.errors.client),
      wizard: wizardRate === null ? null : {
        rate: wizardRate,
        rateText: `${plain.format(wizardRate)} %`,
        started: plain.format(kpis.wizard.started),
        completed: plain.format(kpis.wizard.completed),
      },
      maxViews: Math.max(1, ...report.sections.map((row) => row.views)),
      sections: report.sections.map((row) => ({
        key: row.section, label: t.section[row.section], value: row.views, display: plain.format(row.views), detail: t.usersIn(row.users),
      })),
      table: [...daily].reverse().map((day) => ({ ...day, label: label(day.date) })),
      errors: report.errors.map((item) => ({
        item,
        source: item.source === "server" ? t.server : t.client,
        route: item.route ? `${item.method ? `${item.method} ` : ""}${item.route}` : null,
        times: t.times(item.count),
        affected: t.affected(item.users),
        lastSeenTitle: dateTime.format(new Date(item.lastSeen)),
        lastSeenAgo: ago(item.lastSeen),
        firstSeen: dateTime.format(new Date(item.firstSeen)),
      })),
    };
  });

  constructor() {
    effect(() => {
      const days = this.days();
      untracked(() => void this.load(days));
    });
  }

  protected async load(range: AnalyticsRange): Promise<void> {
    this.busy.set(true);
    this.error.set(false);
    try {
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const data = await api<{ report: AnalyticsReport }>(`/api/admin/analytics?days=${range}&tz=${encodeURIComponent(timeZone)}`);
      this.report.set(data.report);
    } catch {
      this.error.set(true);
    } finally {
      this.busy.set(false);
    }
  }
}
