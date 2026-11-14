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
/** Every script this app ships is served from /_next/ (bundled chunks, in development too). */
const isAppScript = (url: string) => /^https?:\/\/[^/]+\/_next\//.test(url);

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

/** A short "Browser version · OS" label, enough to reproduce an error without keeping the full user agent. */
export function summarizeUserAgent(userAgent: string | null | undefined): string | null {
  if (!userAgent) return null;
  const ua = userAgent;
  const browser =
    /Edg\/(\d+)/.exec(ua) ? `Edge ${/Edg\/(\d+)/.exec(ua)![1]}`
    : /OPR\/(\d+)/.exec(ua) ? `Opera ${/OPR\/(\d+)/.exec(ua)![1]}`
    : /Firefox\/(\d+)/.exec(ua) ? `Firefox ${/Firefox\/(\d+)/.exec(ua)![1]}`
    : /CriOS\/(\d+)/.exec(ua) ? `Chrome ${/CriOS\/(\d+)/.exec(ua)![1]}`
    : /Chrome\/(\d+)/.exec(ua) ? `Chrome ${/Chrome\/(\d+)/.exec(ua)![1]}`
    : /Version\/(\d+)[\d.]* .*Safari\//.exec(ua) ? `Safari ${/Version\/(\d+)/.exec(ua)![1]}`
    : /node|undici/i.test(ua) ? "Node" : "Other";
  const os =
    /Android/.test(ua) ? "Android"
    : /iPhone|iPad|iPod/.test(ua) ? "iOS"
    : /Windows/.test(ua) ? "Windows"
    : /Mac OS X|Macintosh/.test(ua) ? "macOS"
    : /CrOS/.test(ua) ? "ChromeOS"
    : /Linux/.test(ua) ? "Linux" : null;
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
