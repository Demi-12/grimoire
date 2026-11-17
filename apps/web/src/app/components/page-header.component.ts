import { booleanAttribute, ChangeDetectionStrategy, Component, computed, input } from "@angular/core";

/** Shared with the loading skeleton, so the placeholder header has the real one's size and rule. */
export const pageHeaderClass = "relative mb-7 flex flex-wrap items-end justify-between gap-x-5 gap-y-3 pb-4 after:absolute after:inset-x-0 after:bottom-0 after:h-1 after:bg-accent after:[clip-path:polygon(0_0,100%_50%,0_100%)]";
export const pageTitleClass = "m-0 font-display text-[clamp(30px,4vw,42px)] leading-[1.08] font-medium text-ink";
export const pageDescriptionClass = "mt-2 mb-0 text-base leading-normal text-muted";

/**
 * The one page header every section uses: an optional small-caps kicker, the page's <h1>, a line of description and,
 * on the right, the page's actions. The tapered violet rule underneath marks where the page itself starts.
 *
 *   <header appPageHeader [kicker]="t('x.kicker')" [title]="t('x.title')" [description]="t('x.description')"></header>
 *   <header appPageHeader [title]="…" actions><button …>…</button></header>      (buttons go inside, with `actions`)
 */
@Component({
  selector: "header[appPageHeader]",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { "[class]": "hostClass()" },
  template: `
    <div class="min-w-0 max-w-[68ch]">
      @if (kicker()) { <p class="eyebrow">{{ kicker() }}</p> }
      <h1 [attr.id]="titleId() ?? null" [class]="titleClass">{{ title() }}</h1>
      @if (description()) { <p [class]="descriptionClass">{{ description() }}</p> }
    </div>
    @if (actions()) { <div class="flex flex-wrap gap-2 max-[650px]:w-full"><ng-content /></div> }
  `,
})
export class PageHeaderComponent {
  readonly kicker = input<string>();
  readonly title = input.required<string>();
  readonly description = input<string>();
  readonly titleId = input<string>();
  /** Set when the header has action buttons as content. */
  readonly actions = input(false, { transform: booleanAttribute });
  /** Keep the header for screen readers only (e.g. while a character sheet, with its own heading, is open). */
  readonly hidden = input(false, { transform: booleanAttribute });

  protected readonly titleClass = pageTitleClass;
  protected readonly descriptionClass = pageDescriptionClass;
  protected readonly hostClass = computed(() => this.hidden() ? "sr-only" : pageHeaderClass);
}
