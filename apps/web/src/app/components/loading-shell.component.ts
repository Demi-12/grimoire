import { NgTemplateOutlet } from "@angular/common";
import { ChangeDetectionStrategy, Component, computed, inject, input } from "@angular/core";
import { I18nService } from "../core/i18n.service";
import { ArcaneBackdropComponent, BrandMarkComponent } from "./brand.component";
import { pageDescriptionClass, pageHeaderClass, pageTitleClass } from "./page-header.component";
import { sectionStack, sectionTitle } from "./section-styles";
import { SKELETONS } from "./skeleton.component";

/**
 * What the shell paints while the session (and then /api/me) loads. It reuses the real layout
 * classes (gate-shell, app-shell, sidebar, desk-head, tool-tile…) with placeholders in place of text,
 * so the page keeps its shape when the real content arrives instead of jumping between layouts.
 *
 * - "gate": nobody is signed in (or we cannot tell yet and the server saw no session cookie):
 *   the sign-in page's header, intro and form card.
 * - "home" / "section": a session is known or very likely: the signed-in shell, with the dashboard
 *   or a generic page heading depending on the route.
 */
export type LoadingVariant = "gate" | "home" | "section";

const labels = { en: "Opening the Grimoire…", es: "Abriendo el grimorio…" } as const;
/** The sidebar's two groups (shell.component): Play (overview, characters, map) and Run the game (campaigns, encounters, bestiary). */
const navGroups = [["58%", "66%", "70%"], ["62%", "64%", "56%"]];

@Component({
  selector: "app-loading-shell",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgTemplateOutlet, ArcaneBackdropComponent, BrandMarkComponent, ...SKELETONS],
  host: { class: "contents" },
  templateUrl: "./loading-shell.component.html",
})
export class LoadingShellComponent {
  private readonly locale = inject(I18nService).locale;

  readonly variant = input.required<LoadingVariant>();
  /** Index of the current view among the six sidebar links, in that order, so it is already lit. */
  readonly activeNav = input(-1);

  protected readonly label = computed(() => labels[this.locale()]);
  protected readonly navGroups = navGroups;
  protected readonly sectionStack = sectionStack;
  protected readonly sectionTitle = sectionTitle;
  protected readonly pageHeaderClass = pageHeaderClass;
  protected readonly pageTitleClass = pageTitleClass;
  protected readonly pageDescriptionClass = pageDescriptionClass;

  protected navClass(group: number, index: number): string {
    const position = group * 3 + index;
    const active = this.activeNav();
    // On phones the bar shows the three Play tabs plus one "Run" tab (the first link of the second group).
    return `nav-link${group === 1 && index > 0 ? " nav-run" : ""}${position === active || (group === 1 && index === 0 && active >= 3) ? " active" : ""}`;
  }

  protected homeTileClass(item: number): string {
    return `panel flex min-h-28 flex-col items-start gap-2.5 px-4 py-3.5 max-[650px]:min-h-21 max-[650px]:p-3${item === 0 ? " col-span-2 min-[901px]:col-span-1 max-[650px]:min-h-14" : ""}${item === 2 ? " max-[650px]:hidden" : ""}`;
  }
}
