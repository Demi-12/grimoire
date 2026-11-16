"use client";

import { isForeignScriptError, type ClientEventName, type EventProps } from "@/lib/analytics";

/**
 * Fire-and-forget reporting to /api/telemetry. Nothing here may throw or block the UI: failures are dropped.
 * `keepalive` lets a report sent while the page unloads still reach the server.
 */
function send(body: unknown) {
  try {
    void fetch("/api/telemetry", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    // fetch unavailable or the body could not be serialised: skip it.
  }
}

/** Record a usage event (only counted for approved accounts; see the route). */
export function track(name: ClientEventName, props: EventProps = {}) {
  send({ kind: "event", name, props });
}

/** At most this many error reports per page load, and each distinct message once. */
const MAX_REPORTS_PER_PAGE = 10;
const reported = new Set<string>();

/** Send a browser error to the admin's error log. */
export function reportClientError(error: unknown, extra: { digest?: string } = {}) {
  const cause = error instanceof Error ? error : new Error(typeof error === "string" ? error : "Non-error value thrown");
  const key = `${cause.name}:${cause.message}`;
  if (reported.has(key) || reported.size >= MAX_REPORTS_PER_PAGE) return;
  reported.add(key);
  send({
    kind: "error",
    name: cause.name,
    message: cause.message || "(no message)",
    stack: cause.stack ?? null,
    route: typeof window === "undefined" ? null : window.location.pathname,
    digest: extra.digest ?? (cause as { digest?: string }).digest ?? null,
  });
}

/**
 * Errors thrown by scripts we don't control (extensions, cross-origin scripts, wallets a browser injects
 * into the page) are not Grimoire bugs and carry no useful detail.
 */
function isNoise(event: ErrorEvent) {
  if (event.message === "Script error." || (!event.error && !event.filename)) return true;
  const stack = event.error instanceof Error ? event.error.stack : null;
  return isForeignScriptError({ filename: event.filename, stack });
}

/** Listen for uncaught errors and unhandled promise rejections. Returns a cleanup function. */
export function installErrorReporting(): () => void {
  const onError = (event: ErrorEvent) => {
    if (isNoise(event)) return;
    reportClientError(event.error ?? new Error(event.message));
  };
  const onRejection = (event: PromiseRejectionEvent) => {
    // An aborted fetch (navigating away) is not a bug.
    if (event.reason instanceof DOMException && event.reason.name === "AbortError") return;
    if (event.reason instanceof Error && isForeignScriptError({ stack: event.reason.stack })) return;
    reportClientError(event.reason);
  };
  window.addEventListener("error", onError);
  window.addEventListener("unhandledrejection", onRejection);
  return () => {
    window.removeEventListener("error", onError);
    window.removeEventListener("unhandledrejection", onRejection);
  };
}
