import { ErrorHandler, Injectable, signal } from "@angular/core";
import { reportClientError } from "./telemetry-client";

/**
 * Angular's ErrorHandler for the app. Every error it receives goes to the admin's error log (see
 * /admin/analytics) and to the console. An error thrown while Angular was rendering (a template, a
 * computed, an effect) leaves the screen half-drawn, so those also raise `crashed`, and AppComponent
 * swaps the app for the crash screen until the person retries.
 *
 * Errors from a click or key handler, or from a rejected promise, reach here from inside a DOM event
 * (`window.event` is set) and leave the screen as it was: they are reported and nothing else.
 */
@Injectable({ providedIn: "root" })
export class CrashService implements ErrorHandler {
  readonly crashed = signal(false);

  handleError(error: unknown): void {
    console.error(error);
    reportClientError(error);
    if (typeof window.event === "undefined") this.crashed.set(true);
  }

  /** "Try again": draw the app from scratch. */
  readonly reset = (): void => this.crashed.set(false);
}
