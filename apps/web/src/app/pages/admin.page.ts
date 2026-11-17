import { ChangeDetectionStrategy, Component, computed, inject, input } from "@angular/core";
import { RouterLink } from "@angular/router";
import { AdminAnalyticsComponent } from "../components/admin-analytics.component";
import { AdminUsersComponent } from "../components/admin-users.component";
import { IconComponent } from "../components/icons.component";
import { PageHeaderComponent } from "../components/page-header.component";
import { I18nService } from "../core/i18n.service";
import { ToolkitStore } from "../core/toolkit.store";

/** `/admin` (accounts) and `/admin/analytics`: one page with two tabs, each with its own address. Admins only. */
@Component({
  selector: "app-admin-page",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, AdminAnalyticsComponent, AdminUsersComponent, IconComponent, PageHeaderComponent],
  host: { class: "contents" },
  template: `
    @if (store.isAdmin()) {
      <header appPageHeader [kicker]="t('admin.kicker')" [title]="t(analytics() ? 'admin.analyticsTitle' : 'admin.usersTitle')" [description]="t(analytics() ? 'admin.analyticsDescription' : 'admin.description')"></header>
      <nav class="tabs -mt-3" [attr.aria-label]="t('admin.tabsAria')">
        <a routerLink="/admin" [attr.aria-current]="analytics() ? null : 'page'">
          <span aria-hidden="true"><svg appIcon="users"></svg></span>{{ t("admin.tab.users") }}
          @if (store.pendingCount() > 0) { <small class="nav-alert" [attr.aria-label]="t('admin.pendingAria', { count: store.pendingCount() })">{{ store.pendingCount() }}</small> }
        </a>
        <a routerLink="/admin/analytics" [attr.aria-current]="analytics() ? 'page' : null">
          <span aria-hidden="true"><svg appIcon="analytics"></svg></span>{{ t("admin.tab.analytics") }}
        </a>
      </nav>
      @if (analytics()) {
        <app-admin-analytics />
      } @else {
        <app-admin-users [me]="store.me()!" [onPendingCount]="setPendingCount" />
      }
    }
  `,
})
export class AdminPage {
  protected readonly store = inject(ToolkitStore);
  protected readonly t = inject(I18nService).t;

  /** From the route: "analytics" on `/admin/analytics`. */
  readonly tab = input<string>();
  protected readonly analytics = computed(() => this.tab() === "analytics");

  protected readonly setPendingCount = (count: number): void => this.store.pendingCount.set(count);
}
