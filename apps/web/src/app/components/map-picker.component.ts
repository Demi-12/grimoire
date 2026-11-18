import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from "@angular/core";
import { RouterLink } from "@angular/router";
import type { Campaign, Character } from "../core/api-client";
import { FeedbackService } from "../core/feedback.service";
import { I18nService } from "../core/i18n.service";
import { dmName } from "./home-dashboard.component";
import { IconComponent } from "./icons.component";
import { PageHeaderComponent } from "./page-header.component";
import { cardAction, cardActions, firstRun, note, roleLine, sectionStack, sectionTitle } from "./section-styles";

/**
 * `/map`: the battle map of each campaign the person sits at, the one they opened last first.
 * (With a single campaign the menu links straight to its map, so this page is mostly for groups of tables.)
 */
@Component({
  selector: "app-map-picker",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, IconComponent, PageHeaderComponent],
  host: { class: "contents" },
  template: `
    <div [class]="sectionStack">
      <header appPageHeader [title]="t('map.title')" [description]="t('map.description')"></header>

      @if (campaigns().length === 0) {
        <div [class]="firstRun">
          <div><h2 [class]="sectionTitle">{{ t("map.emptyTitle") }}</h2><p class="mt-1.5 mb-0 max-w-[46ch] leading-normal text-muted">{{ t("map.emptyDescription") }}</p></div>
          <a class="button button-primary" routerLink="/campaigns" fragment="campaign-name">{{ t("home.createCampaign") }}</a>
        </div>
      } @else {
        <div class="grid grid-cols-[repeat(auto-fill,minmax(min(100%,320px),1fr))] gap-4">
          @for (table of tables(); track table.campaign.id; let index = $index) {
            <article class="panel flex flex-col overflow-hidden">
              <!-- A square grid stands in for the map until maps have thumbnails. -->
              <div class="relative h-37.5 border-b border-line bg-sunken bg-[linear-gradient(color-mix(in_srgb,var(--accent)_14%,transparent)_1px,transparent_1px),linear-gradient(90deg,color-mix(in_srgb,var(--accent)_14%,transparent)_1px,transparent_1px)] bg-size-[22px_22px]" aria-hidden="true">
                @if (index === 0 && campaigns().length > 1) { <span class="absolute top-3 left-3 rounded-control bg-surface px-2 py-1 font-label text-xs font-bold tracking-[.1em] text-muted">{{ t("map.lastUsed") }}</span> }
              </div>
              <div class="flex flex-col gap-3.5 p-4.5">
                <div>
                  <p [class]="roleLine(table.isDm)">{{ table.isDm ? (table.players === 1 ? t("home.roleDmOne") : t("home.roleDm", { count: table.players })) : upper(t("home.rolePlayer", { name: table.dm })) }}</p>
                  <h2 [class]="sectionTitle">{{ table.campaign.name }}</h2>
                </div>
                <div [class]="cardActions">
                  <!-- One filled button per page: the table opened last. -->
                  <a [class]="cardAction + (index === 0 ? ' button-primary' : '')" [routerLink]="['/map', table.campaign.id]" [attr.aria-label]="t('map.openAria', { name: table.campaign.name })">
                    <svg appIcon="map"></svg>{{ t("map.open") }}
                  </a>
                  @if (table.isDm) {
                    <button type="button" [class]="cardAction" (click)="copy(table.campaign)">
                      <svg appIcon="link"></svg><span aria-live="polite">{{ copiedId() === table.campaign.id ? t("map.copied") : t("map.copy") }}</span>
                    </button>
                  }
                </div>
                <p [class]="note">{{ table.isDm ? t("map.shareNote") : table.heroes.length ? t("map.youMove", { names: table.heroes.join(", ") }) : t("map.noHero") }}</p>
              </div>
            </article>
          }
        </div>
      }
    </div>
  `,
})
export class MapPickerComponent {
  private readonly i18n = inject(I18nService);
  private readonly toast = inject(FeedbackService).toast;
  protected readonly t = this.i18n.t;

  /** Member campaigns, already sorted by when their map was last opened. */
  readonly campaigns = input.required<Campaign[]>();
  /** The person's own characters, to say which hero they move. */
  readonly characters = input.required<Character[]>();

  protected readonly copiedId = signal("");
  protected readonly tables = computed(() => this.campaigns().map((campaign) => ({
    campaign,
    isDm: campaign.myRole === "dm",
    players: campaign.members.filter((member) => member.role === "player").length,
    dm: dmName(campaign),
    heroes: this.characters().filter((character) => character.campaignId === campaign.id).map((character) => character.name),
  })));

  protected readonly sectionStack = sectionStack;
  protected readonly sectionTitle = sectionTitle;
  protected readonly cardActions = cardActions;
  protected readonly cardAction = cardAction;
  protected readonly firstRun = firstRun;
  protected readonly note = note;
  protected readonly roleLine = roleLine;

  protected upper(text: string): string {
    return text.toLocaleUpperCase(this.i18n.locale() === "es" ? "es-ES" : "en-US");
  }

  protected async copy(campaign: Campaign): Promise<void> {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/map/${encodeURIComponent(campaign.id)}`);
      this.copiedId.set(campaign.id);
      window.setTimeout(() => this.copiedId.update((current) => current === campaign.id ? "" : current), 2_000);
    } catch {
      this.toast.error(this.t("map.copyError"));
    }
  }
}
