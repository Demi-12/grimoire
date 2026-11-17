import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from "@angular/core";
import { RouterLink } from "@angular/router";
import { characterIdentity, sheetFor } from "@grimoire/shared/character-view";
import { abilities, abilityModifier } from "@grimoire/shared/rules";
import type { Campaign, Character } from "../core/api-client";
import { I18nService } from "../core/i18n.service";
import { IconComponent } from "./icons.component";
import { PageHeaderComponent } from "./page-header.component";
import { cardAction, cardActions, cardTitle, firstRun, glyphWell, note, roleLine, sectionStack, sectionTitle } from "./section-styles";

type Filter = "all" | "camp" | "free";
/** Cards shown before "See all in Characters"; the new-character card fills the next slot. */
const MAX_CARDS = 5;

const signedMod = (score: number) => { const mod = abilityModifier(score); return `${mod >= 0 ? "+" : "−"}${Math.abs(mod)}`; };

/** Who runs a campaign, for the "PLAYER · DM: …" line. */
export function dmName(campaign: Campaign): string {
  return campaign.members.find((member) => member.role === "dm")?.name ?? campaign.ownerName;
}

// Shortcut tiles: the first is filled (the main thing to do here); on a phone it becomes a full-width row.
const tileBase = "flex min-h-28 flex-col items-start gap-2.5 rounded-card border px-4 py-3.5 no-underline transition-[border-color,translate] duration-150 hover:-translate-y-px max-[650px]:gap-1.5 max-[650px]:p-3";

/** The overview ("Mesa de juego"): shortcuts, the person's characters and the campaigns they sit at. */
@Component({
  selector: "app-home-dashboard",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, IconComponent, PageHeaderComponent],
  host: { class: "contents" },
  templateUrl: "./home-dashboard.component.html",
})
export class HomeDashboardComponent {
  private readonly i18n = inject(I18nService);
  protected readonly t = this.i18n.t;

  /** The person's own characters. */
  readonly characters = input.required<Character[]>();
  /** Campaigns the person is a member of. */
  readonly campaigns = input.required<Campaign[]>();
  /** Where the "Battle map" shortcut goes, and the campaign it opens (none: the picker). */
  readonly mapShortcut = input.required<{ href: string; campaignName?: string }>();

  protected readonly filter = signal<Filter>("all");
  protected readonly filters = ["all", "camp", "free"] as const;
  protected readonly maxCards = MAX_CARDS;
  protected readonly abilities = abilities;

  protected readonly counts = computed<Record<Filter, number>>(() => {
    const characters = this.characters();
    const inCampaign = characters.filter((character) => character.campaignId).length;
    return { all: characters.length, camp: inCampaign, free: characters.length - inCampaign };
  });
  protected readonly visible = computed(() => {
    const filter = this.filter();
    return this.characters().filter((character) => filter === "all" || (filter === "camp" ? character.campaignId : !character.campaignId));
  });
  protected readonly summary = computed(() => {
    const characters = this.characters();
    const campaigns = this.campaigns();
    const averageLevel = characters.length ? Math.round(characters.reduce((sum, character) => sum + character.level, 0) / characters.length) : 0;
    return [
      characters.length === 1 ? this.t("home.summary.character") : this.t("home.summary.characters", { count: characters.length }),
      characters.length ? this.t("home.summary.level", { level: averageLevel }) : "",
      campaigns.length === 1 ? this.t("home.summary.campaign") : this.t("home.summary.campaigns", { count: campaigns.length }),
    ].filter(Boolean).join(" · ");
  });

  /** The cards on screen, with everything the template shows worked out once per change. */
  protected readonly cards = computed(() => {
    const locale = this.i18n.locale();
    const campaignNames = new Map(this.campaigns().map((campaign) => [campaign.id, campaign.name]));
    return this.visible().slice(0, MAX_CARDS).map((character) => {
      const sheet = sheetFor(character);
      const identity = characterIdentity(character, locale);
      return {
        character,
        initial: this.upper(character.name.slice(0, 1)),
        subtitle: [identity.className, identity.species].filter(Boolean).join(" · ") || this.t("character.adventurer"),
        stats: sheet ? ([["character.acShort", sheet.armorClass], ["character.hpShort", sheet.hitPoints], ["home.passive", sheet.passivePerception]] as const) : null,
        campaignName: (character.campaignId && campaignNames.get(character.campaignId)) || this.t("home.noCampaign"),
      };
    });
  });

  protected readonly tables = computed(() => this.campaigns().map((campaign) => ({
    campaign,
    isDm: campaign.myRole === "dm",
    players: campaign.members.filter((member) => member.role === "player").length,
    dm: dmName(campaign),
    heroes: this.characters().filter((character) => character.campaignId === campaign.id).map((character) => character.name),
  })));

  protected readonly sectionStack = sectionStack;
  protected readonly sectionTitle = sectionTitle;
  protected readonly cardTitle = cardTitle;
  protected readonly cardActions = cardActions;
  protected readonly cardAction = cardAction;
  protected readonly firstRun = firstRun;
  protected readonly note = note;
  protected readonly glyphWell = glyphWell;
  protected readonly roleLine = roleLine;
  protected readonly signedMod = signedMod;
  protected readonly tile = `${tileBase} border-line bg-surface text-ink shadow-card hover:border-accent dark:shadow-card-dark max-[650px]:min-h-21`;
  protected readonly primaryTile = `${tileBase} col-span-2 border-accent-fill bg-accent-fill text-on-accent shadow-card dark:shadow-card-dark max-[650px]:min-h-14 max-[650px]:flex-row max-[650px]:items-center min-[901px]:col-span-1`;
  protected readonly tileLabel = "block font-display text-lg leading-tight font-medium max-[650px]:text-base";
  protected readonly tileNote = "mt-0.5 block text-sm max-[650px]:text-xs";

  protected upper(text: string): string {
    return text.toLocaleUpperCase(this.i18n.locale() === "es" ? "es-ES" : "en-US");
  }
}
