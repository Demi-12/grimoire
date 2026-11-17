import { effect, inject, Injectable, signal } from "@angular/core";
import type { Locale } from "@grimoire/shared/i18n";
import { api } from "./api-client";
import { I18nService } from "./i18n.service";
import { SessionService } from "./session.service";

export type Theme = "light" | "dark";

/**
 * Language and theme: kept on <html> (`lang`, `data-theme`), in localStorage (`grimoire.locale.v1`,
 * `grimoire.theme.v1`: the same keys the inline script in index.html reads before first paint) and,
 * when signed in, on the account through PATCH /api/me.
 */
@Injectable({ providedIn: "root" })
export class PreferencesService {
  private readonly i18n = inject(I18nService);
  private readonly session = inject(SessionService);

  readonly locale = this.i18n.locale;
  readonly theme = signal<Theme>(document.documentElement.dataset["theme"] === "dark" ? "dark" : "light");

  constructor() {
    effect(() => {
      const locale = this.locale();
      document.documentElement.lang = locale;
      try {
        window.localStorage.setItem("grimoire.locale.v1", locale);
      } catch {
        // Keep the current selection for this session if storage is unavailable.
      }
    });
    effect(() => {
      const theme = this.theme();
      document.documentElement.dataset["theme"] = theme;
      try {
        window.localStorage.setItem("grimoire.theme.v1", theme);
      } catch {
        // Keep the selected theme for the current session.
      }
    });
  }

  /** The person picked a language: apply it and remember it on their account. */
  changeLocale(next: Locale): void {
    this.locale.set(next);
    this.save({ locale: next });
  }

  /** The person picked a theme: apply it and remember it on their account. */
  changeTheme(next: Theme): void {
    this.theme.set(next);
    this.save({ theme: next });
  }

  private save(preference: { locale: Locale } | { theme: Theme }): void {
    if (this.session.accountId()) api("/api/me", { method: "PATCH", body: preference }).catch(() => undefined);
  }
}
