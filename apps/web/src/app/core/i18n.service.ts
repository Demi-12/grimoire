import { Injectable, signal } from "@angular/core";
import { apiErrorText, authErrorText } from "@grimoire/shared/error-text";
import { translate, type Locale } from "@grimoire/shared/i18n";

/**
 * The interface language as a signal, plus `t()` to translate a key of packages/shared/src/i18n.ts.
 * Components keep `protected readonly t = inject(I18nService).t;` and call `t('key', { values })` in
 * their templates; because `t` reads the signal, every text follows a language change on its own.
 *
 * `errorText(cause, fallback)` and `authErrorText(cause, fallback)` turn a failure (an ApiError, better-auth's
 * error, a dropped connection) into a text in the same language; never show `cause.message` itself.
 *
 * The starting value is whatever the inline script in index.html already put on <html lang>
 * (saved choice, else the browser's language), so nothing flashes in the wrong language.
 */
@Injectable({ providedIn: "root" })
export class I18nService {
  readonly locale = signal<Locale>(document.documentElement.lang === "es" ? "es" : "en");

  readonly t = (key: string, values?: Record<string, string | number>): string => translate(this.locale(), key, values);

  /** What to tell the person about a failed API call; `fallback` is the action's own "couldn't …" text. */
  readonly errorText = (cause: unknown, fallback?: string): string => apiErrorText(this.locale(), cause, fallback);

  /** What to tell the person about a failed better-auth call (sign-in, 2FA, passkeys, password). */
  readonly authErrorText = (cause: unknown, fallback: string): string => authErrorText(this.locale(), cause, fallback);
}
