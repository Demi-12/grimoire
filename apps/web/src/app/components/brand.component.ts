import { ChangeDetectionStrategy, Component, computed, input } from "@angular/core";

const STAR = "M32 10L33.99 27.2L40.84 23.16L36.8 30.01L54 32L36.8 33.99L40.84 40.84L33.99 36.8L32 54L30.01 36.8L23.16 40.84L27.2 33.99L10 32L27.2 30.01L23.16 23.16L30.01 27.2Z";

/** Each mark on the page needs its own gradient ids. */
let lastMark = 0;

/**
 * The Grimoire mark: a gilt star on a leather cover. Same drawing as public/icon.svg (the favicon).
 *
 *   <svg appBrandMark [size]="26"></svg>
 */
@Component({
  selector: "svg[appBrandMark]",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: "brand-mark", viewBox: "0 0 64 64", "aria-hidden": "true", focusable: "false", "[attr.width]": "size()", "[attr.height]": "size()" },
  template: `
    <svg:defs>
      <svg:linearGradient [attr.id]="id + 'c'" x1="0" y1="0" x2="1" y2="1"><svg:stop offset="0" stop-color="#4b2f7d" /><svg:stop offset="1" stop-color="#1f1530" /></svg:linearGradient>
      <svg:linearGradient [attr.id]="id + 'g'" x1="0" y1="0" x2="0" y2="1"><svg:stop offset="0" stop-color="#f6d98f" /><svg:stop offset="1" stop-color="#d39f45" /></svg:linearGradient>
    </svg:defs>
    <svg:rect width="64" height="64" rx="14" [attr.fill]="'url(#' + id + 'c)'" />
    <svg:rect x="4.5" y="4.5" width="55" height="55" rx="10" fill="none" stroke="#d8aa55" stroke-opacity=".55" stroke-width="1.5" />
    <svg:circle cx="32" cy="32" r="16" fill="none" stroke="#d8aa55" stroke-opacity=".35" stroke-width="1.5" />
    <svg:path [attr.fill]="'url(#' + id + 'g)'" [attr.d]="star" />
    <svg:circle cx="32" cy="32" r="3" fill="#2a1b40" />
  `,
})
export class BrandMarkComponent {
  readonly size = input(22);
  protected readonly id = `brand-mark-${++lastMark}-`;
  protected readonly star = STAR;
}

const polar = (radius: number, degrees: number) => {
  const angle = (degrees - 90) * Math.PI / 180;
  return `${(radius * Math.cos(angle)).toFixed(1)} ${(radius * Math.sin(angle)).toFixed(1)}`;
};
const polygon = (radius: number, sides: number, offset = 0) =>
  `M${Array.from({ length: sides }, (_, index) => polar(radius, offset + index * 360 / sides)).join("L")}Z`;

/** A fixed scatter (no randomness at runtime), so the motes sit in the same places on every visit. */
const MOTES = Array.from({ length: 34 }, (_, index) => {
  const random = (salt: number) => { const x = Math.sin(index * 127.1 + salt * 311.7) * 43758.5453; return x - Math.floor(x); };
  const round = (value: number) => Math.round(value * 100) / 100;
  return { left: round(random(1) * 100), top: round(random(2) * 100), size: round(1.5 + random(3) * 2.5), delay: round(-random(4) * 9), duration: round(5 + random(5) * 6) };
});

/**
 * Arcane backdrop: a slowly turning arcane circle and drifting gilt motes over violet glows.
 * "gate": centred behind the sign-in card. "app": quieter, tucked into the bottom corner behind the workspace.
 * Pure decoration, behind everything (see `.arcane-backdrop` in app.css); still under prefers-reduced-motion.
 *
 *   <div appArcaneBackdrop variant="app"></div>
 */
@Component({
  selector: "div[appArcaneBackdrop]",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { "[class]": "'arcane-backdrop arcane-backdrop-' + variant()", "aria-hidden": "true" },
  template: `
    <!-- Two stacked SVGs, each turned as a whole element, so the compositor rotates them without repainting. -->
    <div class="arcane-sigil">
      <svg class="arcane-sigil-outer" viewBox="-500 -500 1000 1000">
        <g>
          <circle r="488" class="sigil-faint" />
          <circle r="470" />
          @for (tick of ticks; track $index) { <path [attr.d]="tick" /> }
          <circle r="434" class="sigil-faint" />
          @for (diamond of diamonds; track $index) { <path class="sigil-gilt" [attr.d]="diamond" /> }
          <circle r="404" />
        </g>
      </svg>
      <svg class="arcane-sigil-inner" viewBox="-500 -500 1000 1000">
        <g>
          <path [attr.d]="square" />
          <path [attr.d]="squareTurned" />
          <circle r="286" class="sigil-faint" />
          <path class="sigil-gilt-line" [attr.d]="triangle" />
          <path class="sigil-gilt-line" [attr.d]="triangleTurned" />
          <circle r="143" />
          <circle r="128" class="sigil-faint" />
          @for (node of nodes; track $index) { <circle class="sigil-node" r="11" [attr.transform]="node" /> }
        </g>
      </svg>
    </div>
    @for (mote of motes(); track $index) {
      <span class="arcane-mote" [style.left.%]="mote.left" [style.top.%]="mote.top" [style.width.px]="mote.size" [style.height.px]="mote.size"
        [style.animation-delay.s]="mote.delay" [style.animation-duration.s]="mote.duration"></span>
    }
  `,
})
export class ArcaneBackdropComponent {
  readonly variant = input<"gate" | "app">("gate");

  // Fewer motes inside the app: there the backdrop sits behind work, not behind a single card.
  protected readonly motes = computed(() => this.variant() === "app" ? MOTES.slice(0, 10) : MOTES);
  protected readonly ticks = Array.from({ length: 96 }, (_, index) => `M${polar(470, index * 3.75)}L${polar(index % 4 ? 458 : 446, index * 3.75)}`);
  protected readonly diamonds = Array.from({ length: 24 }, (_, index) => `M${polar(420, index * 15)}m0 -7l6 7l-6 7l-6 -7Z`);
  protected readonly square = polygon(404, 4);
  protected readonly squareTurned = polygon(404, 4, 45);
  protected readonly triangle = polygon(286, 3);
  protected readonly triangleTurned = polygon(286, 3, 60);
  protected readonly nodes = Array.from({ length: 8 }, (_, index) => `translate(${polar(404, index * 45).replace(" ", ",")})`);
}
