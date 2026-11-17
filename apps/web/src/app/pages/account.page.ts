import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import type { Locale } from "@grimoire/shared/i18n";
import { AuthPanelComponent } from "../components/auth/auth-panel.component";
import { DataBackupComponent } from "../components/data-backup.component";
import { PageHeaderComponent } from "../components/page-header.component";
import { I18nService } from "../core/i18n.service";
import { PreferencesService } from "../core/preferences.service";
import { ToolkitStore } from "../core/toolkit.store";

/** `/account`: language, sign-in security (password, 2FA, passkeys) and the data backup. */
@Component({
  selector: "app-account-page",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AuthPanelComponent, DataBackupComponent, PageHeaderComponent],
  host: { class: "contents" },
  template: `
    <header appPageHeader [kicker]="t('account.kicker')" [title]="t('nav.account')" [description]="t('account.description')"></header>
    <section class="panel mb-6 flex flex-wrap items-center justify-between gap-3 p-5" aria-labelledby="account-preferences">
      <div><h2 id="account-preferences" class="m-0 font-display text-xl font-medium text-ink">{{ t("account.preferences") }}</h2><p class="mt-1 mb-0 text-sm text-muted">{{ t("account.preferencesNote") }}</p></div>
      <label class="flex items-center gap-2 text-sm text-muted">{{ t("common.language") }}
        <select #language class="field" (change)="changeLocale(language.value)">
          <option value="en" [selected]="preferences.locale() === 'en'">{{ t("common.english") }}</option>
          <option value="es" [selected]="preferences.locale() === 'es'">{{ t("common.spanish") }}</option>
        </select>
      </label>
    </section>
    <app-auth-panel />
    <app-data-backup [onRestored]="store.reloadAfterRestore" />
  `,
})
export class AccountPage {
  protected readonly store = inject(ToolkitStore);
  protected readonly preferences = inject(PreferencesService);
  protected readonly t = inject(I18nService).t;

  protected changeLocale(value: string): void {
    this.preferences.changeLocale(value as Locale);
  }
}
