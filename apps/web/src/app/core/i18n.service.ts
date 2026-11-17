import { Injectable, signal } from "@angular/core";
import { translate, type Locale } from "@grimoire/shared/i18n";

/**
 * The interface language as a signal, plus `t()` to translate a key of packages/shared/src/i18n.ts.
 * Components keep `protected readonly t = inject(I18nService).t;` and call `t('key', { values })` in
 * their templates; because `t` reads the signal, every text follows a language change on its own.
 *
 * The starting value is whatever the inline script in index.html already put on <html lang>
 * (saved choice, else the browser's language), so nothing flashes in the wrong language.
 */
@Injectable({ providedIn: "root" })
export class I18nService {
  readonly locale = signal<Locale>(document.documentElement.lang === "es" ? "es" : "en");

  readonly t = (key: string, values?: Record<string, string | number>): string => translate(this.locale(), key, values);
}
