import { NgTemplateOutlet } from "@angular/common";
import { ChangeDetectionStrategy, Component, computed, effect, inject } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { NavigationEnd, Router, RouterLink, RouterOutlet } from "@angular/router";
import { filter, map } from "rxjs";
import type { Locale } from "@grimoire/shared/i18n";
import { AuthPanelComponent } from "../components/auth/auth-panel.component";
import { ArcaneBackdropComponent, BrandMarkComponent } from "../components/brand.component";
import { IconComponent, type IconName } from "../components/icons.component";
import { LoadingShellComponent, type LoadingVariant } from "../components/loading-shell.component";
import { SpinnerComponent } from "../components/skeleton.component";
import type { Campaign } from "../core/api-client";
import { useDocumentTitle } from "../core/document-title";
import { I18nService } from "../core/i18n.service";
import { PreferencesService } from "../core/preferences.service";
import { track } from "../core/telemetry-client";
import { ToolkitStore } from "../core/toolkit.store";

export type View = "home" | "characters" | "map" | "campaigns" | "encounters" | "bestiary" | "dm" | "account" | "admin";

/** Each view has its own URL (see app.routes.ts); the shell stays mounted while people move between them. */
export const viewPaths: Record<View, string> = {
  home: "/", characters: "/characters", map: "/map", campaigns: "/campaigns", encounters: "/encounters", bestiary: "/bestiary", dm: "/dm", account: "/account", admin: "/admin",
};
/** The menu's two groups: what everyone uses at the table, and what the DM uses to prepare it (open to all). */
const playViews: View[] = ["home", "characters", "map"];
const runViews: View[] = ["campaigns", "encounters", "bestiary"];
/** `/characters/<id>` is the characters view with that character's full sheet open. */
const characterPath = /^\/characters\/([^/]+)$/;
/** `/characters/new` opens the step-by-step creator (the overview's "Create a character" links here). */
const newCharacterPath = "/characters/new";
/** The admin view has two tabs, each with its own URL. */
const adminAnalyticsPath = "/admin/analytics";

function viewFromPath(pathname: string): View {
  if (characterPath.test(pathname)) return "characters";
  if (pathname === adminAnalyticsPath) return "admin";
  return (Object.keys(viewPaths) as View[]).find((candidate) => viewPaths[candidate] === pathname) ?? "home";
}

/** The path of a router URL, without query, fragment or trailing slashes. */
const pathOf = (url: string) => url.split(/[?#]/)[0].replace(/\/+$/, "") || "/";

type NavItem = { target: View; icon: IconName; label: string; href: string; className: string; short?: string; count?: number; current: boolean };

/**
 * The frame of the signed-in toolkit: sidebar, header, the invitation banner and the page chosen by the
 * router. Before that it is the door: the loading skeleton, the sign-in panel, or the "waiting for
 * approval" / "blocked" card. All shared data lives in ToolkitStore; this component only decides what to draw.
 */
@Component({
  selector: "app-shell",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgTemplateOutlet, RouterLink, RouterOutlet, AuthPanelComponent, ArcaneBackdropComponent, BrandMarkComponent, IconComponent, LoadingShellComponent, SpinnerComponent],
  host: { class: "contents" },
  templateUrl: "./shell.component.html",
})
export class ShellComponent {
  protected readonly store = inject(ToolkitStore);
  protected readonly preferences = inject(PreferencesService);
  private readonly router = inject(Router);
  private readonly i18n = inject(I18nService);
  protected readonly t = this.i18n.t;

  /**
   * The server saw a session cookie on this page load (see web.middleware.ts in the API). It only picks
   * which skeleton to paint before get-session answers; access is decided by the real session.
   */
  private readonly sessionHint = document.documentElement.dataset["sessionHint"] === "1";

  private readonly pathname = toSignal(
    this.router.events.pipe(filter((event) => event instanceof NavigationEnd), map(() => pathOf(this.router.url))),
    { initialValue: pathOf(this.router.url) },
  );
  protected readonly view = computed(() => viewFromPath(this.pathname()));
  private readonly selectedCharacterId = computed(() => {
    const id = this.pathname() === newCharacterPath ? undefined : characterPath.exec(this.pathname())?.[1];
    return id ? decodeURIComponent(id) : null;
  });
  private readonly adminTab = computed(() => this.view() === "admin" && this.pathname() === adminAnalyticsPath ? "analytics" : "users");

  /** What to draw: the skeleton, the door (sign-in, pending, blocked, load error) or the app. */
  protected readonly stage = computed<"loading" | "gate" | "app">(() => {
    const accountId = this.store.accountId();
    if (!this.store.sessionChecked() || (accountId && this.store.meLoadedFor() !== accountId)) return "loading";
    // Everyone must sign in; new accounts wait for an admin before they see any shared data.
    if (!accountId || !this.store.approved()) return "gate";
    return this.store.dataLoadedFor() === accountId ? "app" : "loading";
  });

  /**
   * Signed-in shell only when a session is known (or, before the first check, the server saw its cookie);
   * otherwise the sign-in page's shape, so a visitor never sees a dashboard flash before the gate.
   */
  protected readonly loadingVariant = computed<LoadingVariant>(() =>
    this.store.accountId() || (!this.store.sessionChecked() && this.sessionHint) ? (this.view() === "home" ? "home" : "section") : "gate");
  protected readonly activeNav = computed(() => [...playViews, ...runViews].indexOf(this.view()));

  /** With a single table the menu skips the picker and opens its map. */
  private readonly mapNavHref = computed(() => {
    const tables = this.store.tables();
    return tables.length === 1 ? this.mapHref(tables[0]) : viewPaths.map;
  });

  protected readonly playLinks = computed<NavItem[]>(() => [
    this.navItem("home", "home", this.t("nav.home")),
    this.navItem("characters", "characters", this.t("nav.characters"), { count: this.store.ownCharacters().length }),
    this.navItem("map", "map", this.t("nav.map"), { href: this.mapNavHref(), short: this.t("nav.mapShort") }),
  ]);
  protected readonly runLinks = computed<NavItem[]>(() => [
    this.navItem("campaigns", "campaigns", this.t("nav.campaigns"), { count: this.store.campaigns().length, className: "nav-run" }),
    this.navItem("encounters", "encounters", this.t("nav.encounters"), { className: "nav-run" }),
    this.navItem("bestiary", "bestiary", this.t("nav.bestiary"), { className: "nav-run" }),
    // Phones: one "Run" tab stands for the three links above (they are hidden there).
    this.navItem("dm", "dm", this.t("nav.dm"), { className: "nav-dm-hub", current: this.view() === "dm" || runViews.includes(this.view()) }),
    ...(this.store.isAdmin() ? [this.navItem("admin", "admin", this.t("nav.admin"), { className: "nav-admin" })] : []),
  ]);

  protected readonly accountPath = viewPaths.account;
  protected readonly gateFeatures = ["characters", "campaigns", "encounters"] as const;

  constructor() {
    useDocumentTitle(() => {
      const view = this.view();
      const accountId = this.store.accountId();
      const me = this.store.me();
      const selectedId = this.selectedCharacterId();
      const selectedName = selectedId ? this.store.characters().find((item) => item.id === selectedId)?.name : undefined;
      return !this.store.sessionChecked() ? this.t(this.sessionHint ? `title.${view}` : "title.gate")
        : !accountId || (this.store.meLoadedFor() === accountId && !me) ? this.t("title.gate")
        : me && me.status !== "approved" ? this.t(me.status === "blocked" ? "title.blocked" : "title.pending")
        : selectedName ? this.t("title.character", { name: selectedName })
        : this.adminTab() === "analytics" ? this.t("title.adminAnalytics")
        : this.t(`title.${view}`);
    });

    // The admin pages are for admins: anyone else landing there goes home.
    effect(() => {
      const me = this.store.me();
      if (this.view() === "admin" && me && me.role !== "admin") void this.router.navigateByUrl("/", { replaceUrl: true });
    });

    // `/map` with a single table goes straight to its map (replace, so Back skips the picker).
    effect(() => {
      const accountId = this.store.accountId();
      if (this.view() !== "map" || !accountId || this.store.dataLoadedFor() !== accountId) return;
      const sitting = this.store.memberCampaigns();
      if (sitting.length === 1) void this.router.navigateByUrl(this.mapHref(sitting[0]), { replaceUrl: true });
    });

    // One page view per section visited (the open sheet counts apart from the character list).
    effect(() => {
      const section = this.selectedCharacterId() ? "character-sheet" : this.view();
      if (this.store.approved()) track("page.view", { section });
    });
  }

  private mapHref(campaign: Campaign): string {
    return `/map/${encodeURIComponent(campaign.id)}`;
  }

  private navItem(target: View, icon: IconName, label: string, options: { href?: string; count?: number; className?: string; short?: string; current?: boolean } = {}): NavItem {
    const current = options.current ?? this.view() === target;
    return {
      target, icon, label, current, short: options.short, count: options.count,
      href: options.href ?? viewPaths[target],
      className: `nav-link${options.className ? ` ${options.className}` : ""}${current ? " active" : ""}`,
    };
  }

  /** `aria-current`: "page" on the link of the view itself, "true" on a link that only stands for it (the phone's Run tab). */
  protected ariaCurrent(item: NavItem): "page" | "true" | null {
    return this.view() === item.target ? "page" : item.current ? "true" : null;
  }

  protected changeLocale(value: string): void {
    this.preferences.changeLocale(value as Locale);
  }

  protected toggleTheme(): void {
    this.preferences.changeTheme(this.preferences.theme() === "dark" ? "light" : "dark");
  }

  protected goToAdmin(): void {
    if (this.view() !== "admin") void this.router.navigateByUrl(viewPaths.admin);
  }

  protected reload(): void {
    window.location.reload();
  }
}
