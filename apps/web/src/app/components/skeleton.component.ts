import { ChangeDetectionStrategy, Component, computed, input } from "@angular/core";

/**
 * Loading placeholders. Each one is an attribute on the element it styles, so the markup keeps its shape:
 *
 *   <span appSkeleton width="60%" [height]="12"></span>          a shimmering block
 *   <span appSkeletonLine width="11ch"></span>                    a bar one line of text tall
 *   <div appSkeletonRegion [label]="t('loading')">…</div>         announces the loading state around placeholders
 *   <span appSkeletonText [lines]="2"></span>                     a placeholder paragraph
 *   <span appSpinner></span>                                      a small inline spinner
 *
 * Extra classes and styles go on the element as usual (`class="skeleton-circle"`, `[style.margin-top.px]="10"`).
 */

/** A number is pixels; a string is any CSS length. */
const size = (value: string | number | undefined): string | null => value === undefined ? null : typeof value === "number" ? `${value}px` : value;

/** A single shimmering placeholder block. Decorative: wrap groups in `appSkeletonRegion` for a11y. */
@Component({
  selector: "span[appSkeleton]",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: "skeleton", "aria-hidden": "true", "[style.width]": "cssWidth()", "[style.height]": "cssHeight()" },
  template: "",
})
export class SkeletonComponent {
  readonly width = input<string | number>();
  readonly height = input<string | number>();
  protected readonly cssWidth = computed(() => size(this.width()));
  protected readonly cssHeight = computed(() => size(this.height()));
}

/**
 * A bar exactly one line of the surrounding text tall (the bar itself is drawn thinner), so a heading,
 * label or button can keep its real tag/class and the placeholder takes the space the text will.
 */
@Component({
  selector: "span[appSkeletonLine]",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: "skeleton skeleton-lh", "aria-hidden": "true", "[style.width]": "cssWidth()" },
  template: "",
})
export class SkeletonLineComponent {
  readonly width = input<string | number>();
  protected readonly cssWidth = computed(() => size(this.width()));
}

/** Announces a loading state to assistive tech while its children paint placeholders. */
@Component({
  selector: "div[appSkeletonRegion]",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { role: "status", "aria-live": "polite", "aria-busy": "true" },
  template: `<span class="sr-only">{{ label() }}</span><ng-content />`,
})
export class SkeletonRegionComponent {
  readonly label = input.required<string>();
}

/** Placeholder paragraph: `lines` bars, the last one shorter. */
@Component({
  selector: "span[appSkeletonText]",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SkeletonComponent],
  host: { class: "skeleton-text", "aria-hidden": "true" },
  template: `@for (width of widths(); track $index) { <span appSkeleton class="skeleton-line" [width]="width"></span> }`,
})
export class SkeletonTextComponent {
  readonly lines = input(3);
  protected readonly widths = computed(() => Array.from({ length: this.lines() }, (_, index) => index === this.lines() - 1 && this.lines() > 1 ? "60%" : "100%"));
}

/** Small inline spinner for buttons / in-flight refreshes. */
@Component({
  selector: "span[appSpinner]",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: "spinner", "aria-hidden": "true" },
  template: "",
})
export class SpinnerComponent {}

/** Everything above, for a component's `imports`. */
export const SKELETONS = [SkeletonComponent, SkeletonLineComponent, SkeletonRegionComponent, SkeletonTextComponent, SpinnerComponent] as const;
