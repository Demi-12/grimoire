/**
 * Usage analytics and error reporting: the pure part shared by the server, the browser and the tests.
 *
 * Privacy: everything stays in this app's PostgreSQL. Events carry only a fixed name and a few small,
 * non-personal properties (no names, notes or free text); paths are reduced to route patterns so ids and
 * invite tokens never get stored; error messages have e-mail addresses and long tokens masked.
 */

/** Actions recorded by the API routes themselves (the browser cannot send these). */
export const SERVER_EVENTS = [
  "character.created",
  "character.deleted",
  "campaign.created",
  "campaign.joined",
  "encounter.saved",
  "homebrew.created",
] as const;

/** Actions only the browser sees (navigation, generating an encounter happens client-side, ...). */
export const CLIENT_EVENTS = [
  "page.view",
  "character.wizard_started",
  "character.level_up",
  "encounter.generated",
] as const;

export type ServerEventName = (typeof SERVER_EVENTS)[number];
export type ClientEventName = (typeof CLIENT_EVENTS)[number];
export type EventName = ServerEventName | ClientEventName;

/** Sections of the app counted by `page.view`. */
export const SECTIONS = ["home", "characters", "character-sheet", "campaigns", "encounters", "account", "admin", "map"] as const;
export type Section = (typeof SECTIONS)[number];

export type EventProps = Record<string, string | number | boolean>;

/** Property names (and value kinds) each browser event may carry; anything else is dropped. */
const CLIENT_PROPS: Record<ClientEventName, Record<string, "string" | "number" | "boolean">> = {
  "page.view": { section: "string" },
  "character.wizard_started": { quick: "boolean" },
  "character.level_up": { level: "number" },
  "encounter.generated": { difficulty: "string", source: "string", party: "number", results: "number" },
};

const MAX_STRING_PROP = 40;

function cleanProps(raw: unknown, allowed: Record<string, "string" | "number" | "boolean">): EventProps {
  const props: EventProps = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return props;
  for (const [key, kind] of Object.entries(allowed)) {
    const value = (raw as Record<string, unknown>)[key];
    if (kind === "string" && typeof value === "string" && /^[\w.-]{1,40}$/.test(value)) props[key] = value.slice(0, MAX_STRING_PROP);
    if (kind === "number" && typeof value === "number" && Number.isFinite(value)) props[key] = Math.max(-1e6, Math.min(1e6, Math.round(value)));
    if (kind === "boolean" && typeof value === "boolean") props[key] = value;
  }
  return props;
}

export interface ClientEvent { kind: "event"; name: ClientEventName; props: EventProps }

export interface ErrorReport {
  name: string;
  message: string;
  stack: string | null;
  route: string | null;
  method: string | null;
  digest: string | null;
}
export interface ClientErrorReport extends ErrorReport { kind: "error" }

const isClientEvent = (name: unknown): name is ClientEventName => typeof name === "string" && (CLIENT_EVENTS as readonly string[]).includes(name);

const text = (value: unknown, max: number): string | null =>
  typeof value === "string" && value.trim() ? value.trim().slice(0, max) : null;

/** Validate a body posted to /api/telemetry. Returns null for anything that isn't a known event or an error. */
export function parseTelemetry(body: unknown): ClientEvent | ClientErrorReport | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const input = body as Record<string, unknown>;
  if (input.kind === "event") {
    if (!isClientEvent(input.name)) return null;
    const props = cleanProps(input.props, CLIENT_PROPS[input.name]);
    if (input.name === "page.view" && !(SECTIONS as readonly string[]).includes(String(props.section))) return null;
    return { kind: "event", name: input.name, props };
  }
  if (input.kind === "error") {
    const message = text(input.message, 2000);
    if (!message) return null;
    return {
      kind: "error",
      name: text(input.name, 100) ?? "Error",
      message,
      stack: text(input.stack, 8000),
      route: text(input.route, 500),
      method: null,
      digest: text(input.digest, 100),
    };
  }
  return null;
}

const EXTENSION_URL = /^(chrome|moz|safari|safari-web)-extension:|^webkit-masked-url:/;
const URL_IN_TEXT = /\b(?:https?|webkit-masked-url|(?:chrome|moz|safari|safari-web)-extension):\/\/[^\s)]+/g;
/**
 * Every script this app ships is an Angular bundle at the site's root: `main-<hash>.js`, `chunk-<hash>.js`,
 * `polyfills-<hash>.js` (without the hash under `ng serve`). In a stack the URL is followed by `:line:column`.
 */
const isAppScript = (url: string) => /^https?:\/\/[^/]+\/(?:main|chunk|polyfills)(?:-[A-Z0-9]{8})?\.js(?:[?#:]|$)/.test(url);

/**
 * Whether an uncaught browser error came from a script that isn't ours: an extension, or code a browser
 * injects into every page. Brave on iOS, for one, injects its wallet (`window.ethereum`) into the page
 * itself, so its errors look like they come from the page's own URL (`global code@https://…/admin`).
 * Rule: foreign if it was thrown inside an extension, or if it names locations and none is an app chunk.
 * Errors with no location at all are kept, since they can't be ruled out.
 */
export function isForeignScriptError({ filename, stack }: { filename?: string | null; stack?: string | null }): boolean {
  const urls = [...(stack?.match(URL_IN_TEXT) ?? [])];
  const thrownAt = filename || urls[0];
  if (thrownAt && EXTENSION_URL.test(thrownAt)) return true;
  if (filename) urls.push(filename);
  return urls.length > 0 && !urls.some(isAppScript);
}

/** Ids, uuids and tokens in a path segment: anything with a digit, or long enough to be generated. */
const VARIABLE_SEGMENT = /^(?=.*\d)[\w~.%-]+$|^[\w~.%-]{20,}$/;

/**
 * Reduce a URL or path to its route pattern: `/characters/3f2a…?invite=x` → `/characters/:id`.
 * Drops the query and hash (invite tokens travel there) and replaces id-like segments.
 */
export function normalizeRoute(input: string | null | undefined): string | null {
  if (!input) return null;
  let path = input.trim();
  try {
    if (/^[a-z][a-z\d+.-]*:\/\//i.test(path)) path = new URL(path).pathname;
  } catch {
    return null;
  }
  path = path.split(/[?#]/)[0] ?? "";
  if (!path.startsWith("/")) return null;
  const segments = path.split("/").filter(Boolean).slice(0, 8)
    .map((segment) => VARIABLE_SEGMENT.test(segment) ? ":id" : segment.slice(0, 40));
  return `/${segments.join("/")}`.slice(0, 200);
}

const EMAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;
const LONG_TOKEN = /\b[A-Za-z0-9_-]{32,}\b/g;
const UUID = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;

/** Mask e-mail addresses, uuids and long tokens, and cap the length. */
export function sanitizeText(value: string, max: number): string {
  return value.replace(EMAIL, "[email]").replace(UUID, "[id]").replace(LONG_TOKEN, "[token]").slice(0, max);
}

/** The error with its text cleaned and trimmed to what the app_error table holds. */
export function sanitizeError(report: ErrorReport): ErrorReport {
  return {
    name: sanitizeText(report.name || "Error", 100),
    message: sanitizeText(report.message || "(no message)", 500),
    stack: report.stack ? sanitizeText(report.stack, 4000) : null,
    route: normalizeRoute(report.route),
    method: report.method ? report.method.toUpperCase().slice(0, 10) : null,
    digest: report.digest ? report.digest.slice(0, 100) : null,
  };
}

/**
 * What makes two errors "the same" for grouping: the source, the error class, the message with numbers and
 * ids blanked out, and the route. Returned as a key the server hashes.
 */
export function errorGroupKey(source: "server" | "client", report: Pick<ErrorReport, "name" | "message" | "route">): string {
  const message = report.message.replace(/\d+/g, "#").replace(/\s+/g, " ").trim().slice(0, 200);
  return [source, report.name, message, report.route ?? ""].join("|");
}

/** First match wins: Edge and Opera also say "Chrome", and every Chromium browser also says "Safari". */
const BROWSERS: [name: string, majorVersion: RegExp][] = [
  ["Edge", /Edg\/(\d+)/], ["Opera", /OPR\/(\d+)/], ["Firefox", /Firefox\/(\d+)/], ["Chrome", /CriOS\/(\d+)/], ["Chrome", /Chrome\/(\d+)/],
  ["Safari", /Version\/(\d+)[\d.]* .*Safari\//],
];
/** First match wins: Android and ChromeOS also say "Linux", iOS also says "Mac OS X". */
const SYSTEMS: [name: string, pattern: RegExp][] = [
  ["Android", /Android/], ["iOS", /iPhone|iPad|iPod/], ["Windows", /Windows/], ["macOS", /Mac OS X|Macintosh/], ["ChromeOS", /CrOS/], ["Linux", /Linux/],
];

function browserOf(userAgent: string): string {
  for (const [name, pattern] of BROWSERS) {
    const major = pattern.exec(userAgent)?.[1];
    if (major) return `${name} ${major}`;
  }
  return /node|undici/i.test(userAgent) ? "Node" : "Other";
}

/** A short "Browser version · OS" label, enough to reproduce an error without keeping the full user agent. */
export function summarizeUserAgent(userAgent: string | null | undefined): string | null {
  if (!userAgent) return null;
  const browser = browserOf(userAgent);
  const os = SYSTEMS.find(([, pattern]) => pattern.test(userAgent))?.[0];
  return (os ? `${browser} · ${os}` : browser).slice(0, 100);
}

/** Periods offered by the dashboard, in days (today included). */
export const ANALYTICS_RANGES = [7, 30, 90] as const;
export type AnalyticsRange = (typeof ANALYTICS_RANGES)[number];
export const RETENTION_DAYS = 90;

export function parseRange(value: string | null): AnalyticsRange {
  const days = Number(value);
  return (ANALYTICS_RANGES as readonly number[]).includes(days) ? days as AnalyticsRange : 30;
}

/** An IANA time zone the runtime knows, or UTC. Used to cut days at the admin's midnight. */
export function parseTimeZone(value: string | null): string {
  if (!value || value.length > 64) return "UTC";
  try {
    return new Intl.DateTimeFormat("en-US", { timeZone: value }).resolvedOptions().timeZone;
  } catch {
    return "UTC";
  }
}

export interface Comparison { current: number; previous: number }

/** Change between two periods as a whole percentage; null when there is nothing to compare against. */
export function percentChange({ current, previous }: Comparison): number | null {
  if (previous === 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

/** Shape returned by GET /api/admin/analytics. */
export interface AnalyticsReport {
  range: { days: AnalyticsRange; timeZone: string; from: string; to: string; generatedAt: string };
  kpis: {
    activeUsers: Comparison;
    activeToday: number;
    approvedUsers: number;
    newUsers: Comparison;
    charactersCreated: Comparison & { creator: number; manual: number };
    encountersGenerated: Comparison;
    encountersSaved: Comparison;
    campaignsCreated: Comparison;
    campaignsJoined: Comparison;
    errors: Comparison & { users: number; server: number; client: number };
    wizard: { started: number; completed: number };
  };
  daily: { date: string; activeUsers: number; characters: number; encounters: number; campaigns: number; errors: number }[];
  sections: { section: Section; views: number; users: number }[];
  errors: {
    fingerprint: string; source: "server" | "client"; name: string; message: string; route: string | null;
    count: number; users: number; firstSeen: string; lastSeen: string;
    stack: string | null; digest: string | null; userAgent: string | null; method: string | null;
  }[];
}

// ---- Dashboard report: from the rows of admin/analytics.service.ts's queries to AnalyticsReport ----

/** A count as PostgreSQL returns it: bigint arrives as a string. */
type DbCount = string;

/**
 * What the report's SQL queries return, untouched. The single-row aggregates may be missing
 * (undefined), and every missing count reads as 0.
 */
export interface AnalyticsRows {
  /** Per event name (page views excluded): this period, the previous one, and new characters by creation mode. */
  events: { name: string; current: DbCount; previous: DbCount; creator: DbCount; manual: DbCount }[];
  /** Distinct users with any event: this period, the previous one and today. */
  active: { current: DbCount; previous: DbCount; today: DbCount } | undefined;
  /** Approved accounts, and accounts created this period and the previous one. */
  users: { approved: DbCount; current: DbCount; previous: DbCount } | undefined;
  /** Errors this period and the previous one, with this period's affected users and split by source. */
  errorTotals: { current: DbCount; previous: DbCount; users: DbCount; server: DbCount; client: DbCount } | undefined;
  /** One row per day of the period, oldest first. */
  daily: { date: string; activeUsers: DbCount; characters: DbCount; encounters: DbCount; campaigns: DbCount; errors: DbCount }[];
  /** Page views per section, most viewed first. */
  sections: { section: string; views: DbCount; users: DbCount }[];
  /** One row per error group: its latest occurrence plus the group's totals. */
  errors: {
    fingerprint: string; source: "server" | "client"; name: string; message: string; route: string | null;
    count: DbCount; users: DbCount; firstSeen: Date; lastSeen: Date; stack: string | null; digest: string | null; userAgent: string | null; method: string | null;
  }[];
}

/** Error groups the dashboard lists (the most recently seen). */
const MAX_REPORTED_ERRORS = 50;

const count = (value: DbCount | undefined) => Number(value ?? 0);
const comparison = (row: { current: DbCount; previous: DbCount } | undefined): Comparison => ({ current: count(row?.current), previous: count(row?.previous) });
const isSection = (value: string): value is Section => (SECTIONS as readonly string[]).includes(value);

function reportKpis({ events, active, users, errorTotals }: AnalyticsRows): AnalyticsReport["kpis"] {
  const byName = new Map(events.map((row) => [row.name, row]));
  const compare = (name: EventName) => comparison(byName.get(name));
  const created = byName.get("character.created");
  return {
    activeUsers: comparison(active),
    activeToday: count(active?.today),
    approvedUsers: count(users?.approved),
    newUsers: comparison(users),
    charactersCreated: { ...compare("character.created"), creator: count(created?.creator), manual: count(created?.manual) },
    encountersGenerated: compare("encounter.generated"),
    encountersSaved: compare("encounter.saved"),
    campaignsCreated: compare("campaign.created"),
    campaignsJoined: compare("campaign.joined"),
    errors: { ...comparison(errorTotals), users: count(errorTotals?.users), server: count(errorTotals?.server), client: count(errorTotals?.client) },
    wizard: { started: compare("character.wizard_started").current, completed: count(created?.creator) },
  };
}

const errorGroup = (row: AnalyticsRows["errors"][number]): AnalyticsReport["errors"][number] => ({
  fingerprint: row.fingerprint, source: row.source, name: row.name, message: row.message, route: row.route,
  count: count(row.count), users: count(row.users), firstSeen: row.firstSeen.toISOString(), lastSeen: row.lastSeen.toISOString(),
  stack: row.stack, digest: row.digest, userAgent: row.userAgent, method: row.method,
});

/**
 * The admin dashboard's report from its query rows: counts become numbers, sections the app no
 * longer has are left out, and only the most recently seen error groups are listed, newest first.
 */
export function shapeAnalyticsReport(range: Omit<AnalyticsReport["range"], "generatedAt">, rows: AnalyticsRows, now: Date): AnalyticsReport {
  return {
    range: { ...range, generatedAt: now.toISOString() },
    kpis: reportKpis(rows),
    daily: rows.daily.map((row) => ({
      date: row.date, activeUsers: count(row.activeUsers), characters: count(row.characters),
      encounters: count(row.encounters), campaigns: count(row.campaigns), errors: count(row.errors),
    })),
    sections: rows.sections.flatMap((row) => (isSection(row.section) ? [{ section: row.section, views: count(row.views), users: count(row.users) }] : [])),
    errors: rows.errors.map(errorGroup).sort((a, b) => b.lastSeen.localeCompare(a.lastSeen)).slice(0, MAX_REPORTED_ERRORS),
  };
}
