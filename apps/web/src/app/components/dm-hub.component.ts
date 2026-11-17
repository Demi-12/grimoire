import { ChangeDetectionStrategy, Component, computed, inject, input } from "@angular/core";
import { RouterLink } from "@angular/router";
import { I18nService } from "../core/i18n.service";
import { IconComponent, type IconName } from "./icons.component";
import { PageHeaderComponent } from "./page-header.component";
import { glyphWell, linkCard, sectionStack } from "./section-styles";

/**
 * `/dm`: the "Run the game" group as a page of its own. On a phone the bottom bar has room for four tabs,
 * so Campaigns, Encounters and Bestiary sit behind this one; on wider screens the sidebar lists them directly.
 */
@Component({
  selector: "app-dm-hub",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, IconComponent, PageHeaderComponent],
  host: { class: "contents" },
  template: `
    <div [class]="sectionStack">
      <header appPageHeader [kicker]="t('dm.kicker')" [title]="t('dm.title')" [description]="t('dm.description')"></header>
      <nav class="flex max-w-160 flex-col gap-2.5" [attr.aria-label]="t('dm.aria')">
        @for (link of links(); track link.href) {
          <a [class]="linkCard + ' min-h-21 items-center gap-3.5 p-4'" [routerLink]="link.href">
            <span [class]="glyphWell()" aria-hidden="true"><svg [appIcon]="link.icon"></svg></span>
            <span class="flex min-w-0 flex-1 flex-col gap-0.5"><b class="font-display text-[19px] font-medium">{{ link.title }}</b><small class="text-sm leading-snug text-muted">{{ link.note }}</small></span>
            @if (link.count !== undefined) { <span class="font-label text-xs text-muted">{{ link.count }}</span> }
            <span class="flex-none text-muted" aria-hidden="true"><svg appIcon="chevron"></svg></span>
          </a>
        }
      </nav>
      <a class="button button-primary min-h-12 self-start px-5 text-[15px] max-[650px]:self-stretch" routerLink="/campaigns" fragment="campaign-name">✦ {{ t("dm.createCampaign") }}</a>
    </div>
  `,
})
export class DmHubComponent {
  protected readonly t = inject(I18nService).t;

  readonly campaignCount = input.required<number>();

  protected readonly links = computed<{ href: string; icon: IconName; title: string; note: string; count?: number }[]>(() => [
    { href: "/campaigns", icon: "campaigns", title: this.t("nav.campaigns"), note: this.t("dm.campaignsNote"), count: this.campaignCount() },
    { href: "/encounters", icon: "encounters", title: this.t("nav.encounters"), note: this.t("dm.encountersNote") },
    { href: "/bestiary", icon: "bestiary", title: this.t("nav.bestiary"), note: this.t("dm.bestiaryNote") },
  ]);

  protected readonly sectionStack = sectionStack;
  protected readonly linkCard = linkCard;
  protected readonly glyphWell = glyphWell;
}
