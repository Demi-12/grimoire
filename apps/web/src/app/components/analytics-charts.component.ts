import {
  afterNextRender, ChangeDetectionStrategy, Component, computed, DestroyRef, ElementRef, inject, input, signal, viewChild,
  type Signal,
} from "@angular/core";

/**
 * Small, dependency-free SVG charts for the admin analytics dashboard. Each chart plots one series
 * (identity comes from the title, so there is no legend), keeps marks thin, and is readable without the
 * pointer: arrow keys move the same readout the hover shows, and every value is also in a table view.
 *
 * They share admin-analytics.component.css with the dashboard; every selector of that file stays inside
 * one template (the dashboard's or one chart's), so the scoped styles all match.
 */

export type Tone = "accent" | "critical";

/**
 * Width of an element, kept up to date with a ResizeObserver (0 until measured). Call it from a
 * component's constructor (it injects DestroyRef).
 */
function trackWidth(element: Signal<ElementRef<HTMLElement>>): Signal<number> {
  const width = signal(0);
  let observer: ResizeObserver | null = null;
  afterNextRender(() => {
    const node = element().nativeElement;
    // clientWidth is in layout px; getBoundingClientRect() would include the desktop `zoom` on <html> (styles/app.css).
    const update = () => width.set(node.clientWidth);
    update();
    observer = new ResizeObserver(update);
    observer.observe(node);
  });
  inject(DestroyRef).onDestroy(() => observer?.disconnect());
  return width.asReadonly();
}

/** A round axis maximum (1, 2, 5 × 10ⁿ) at or above `value`, never below 4 so small counts get whole ticks. */
export function niceMax(value: number): number {
  if (value <= 4) return 4;
  const power = 10 ** Math.floor(Math.log10(value));
  for (const step of [1, 2, 2.5, 5, 10]) if (step * power >= value) return step * power;
  return 10 * power;
}

/** A 12-ish point trend line for a stat tile. Decorative: the tile's number carries the value. */
@Component({
  selector: "app-sparkline",
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: "./admin-analytics.component.css",
  host: { class: "contents" },
  template: `
    <div #frame class="sparkline" [attr.data-tone]="tone() ?? 'accent'" aria-hidden="true">
      @if (chart(); as chart) {
        <svg [attr.width]="chart.width" [attr.height]="chart.height">
          <path [attr.d]="chart.area" class="area" />
          <path [attr.d]="chart.line" class="line" />
          <circle [attr.cx]="chart.last[0]" [attr.cy]="chart.last[1]" r="3" class="dot" />
        </svg>
      }
    </div>
  `,
})
export class SparklineComponent {
  readonly values = input.required<number[]>();
  /** Unset (or undefined) draws in the accent colour. */
  readonly tone = input<Tone | undefined>("accent");

  private readonly frame = viewChild.required<ElementRef<HTMLElement>>("frame");
  private readonly width = trackWidth(this.frame);

  protected readonly chart = computed(() => {
    const width = this.width();
    const values = this.values();
    if (width <= 0 || values.length <= 1) return null;
    const height = 32;
    const max = Math.max(1, ...values);
    const step = (width - 4) / (values.length - 1);
    const points = values.map((value, index) => [2 + index * step, height - 3 - (value / max) * (height - 6)] as const);
    const line = points.map(([x, y], index) => `${index ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join("");
    const last = points[points.length - 1];
    return { width, height, line, area: `${line}L${last[0].toFixed(1)},${height}L2,${height}Z`, last };
  });
}

export interface TimePoint { date: string; label: string; value: number }

const PAD = { top: 12, right: 12, bottom: 26, left: 34 };

/** Each chart's live region needs its own id. */
let lastChart = 0;

/**
 * A daily series as a line (with a soft area) or as columns. Hovering snaps a crosshair to the nearest day;
 * focusing the chart and using ←/→ (Home/End) does the same, announced through a live region.
 */
@Component({
  selector: "app-time-chart",
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: "./admin-analytics.component.css",
  host: { class: "contents" },
  template: `
    <div class="chart" [attr.data-tone]="tone() ?? 'accent'">
      <div #frame class="chartFrame" [style.height.px]="height()" tabindex="0" role="group"
        [attr.aria-label]="label()" [attr.aria-describedby]="liveId" (keydown)="onKey($event)" (focus)="onFocus()" (blur)="active.set(null)">
        @if (chart(); as chart) {
          <svg [attr.width]="chart.width" [attr.height]="chart.height" aria-hidden="true" (pointermove)="onPointer($event)" (pointerleave)="active.set(null)">
            @for (tick of chart.ticks; track tick.value) {
              <g>
                <line [attr.x1]="chart.left" [attr.x2]="chart.right" [attr.y1]="tick.y" [attr.y2]="tick.y" [class]="tick.value === 0 ? 'baseline' : 'gridLine'" />
                <text [attr.x]="chart.left - 8" [attr.y]="tick.y" class="tick" text-anchor="end" dominant-baseline="middle">{{ tick.text }}</text>
              </g>
            }
            @for (dayLabel of chart.labels; track dayLabel.date) {
              <text [attr.x]="dayLabel.x" [attr.y]="chart.height - 8" class="tick" [attr.text-anchor]="dayLabel.anchor">{{ dayLabel.text }}</text>
            }
            @if (focus(); as focus) {
              <line [attr.x1]="focus.x" [attr.x2]="focus.x" [attr.y1]="chart.top" [attr.y2]="chart.baseline" class="crosshair" />
            }
            @if (kind() === "line") {
              <path [attr.d]="chart.area" class="area" />
              <path [attr.d]="chart.line" class="line" />
              @if (chart.last; as last) {
                <circle [attr.cx]="last.x" [attr.cy]="last.y" r="4" class="dot" />
              }
              @if (focus()?.point; as point) {
                <circle [attr.cx]="point.x" [attr.cy]="point.y" r="5" class="dot" />
              }
            } @else {
              @for (column of chart.columns; track column.date) {
                <path class="column" [class.columnActive]="active() === column.index" [attr.d]="column.d" />
              }
            }
            @if (chart.peak && active() === null) {
              <text [attr.x]="chart.peak.x" [attr.y]="chart.peak.y" class="peak" [attr.text-anchor]="chart.peak.anchor">{{ chart.peak.text }}</text>
            }
          </svg>
        }
        @if (focus()?.point; as point) {
          <div class="tooltip" [style.left.px]="point.tooltipLeft" aria-hidden="true">
            <b>{{ point.readout }}</b><span>{{ point.label }}</span>
          </div>
        }
      </div>
      <p [id]="liveId" class="sr-only" aria-live="polite">{{ live() }}</p>
    </div>
  `,
})
export class TimeChartComponent {
  readonly points = input.required<TimePoint[]>();
  readonly kind = input.required<"line" | "column">();
  /** Unset (or undefined) draws in the accent colour. */
  readonly tone = input<Tone | undefined>("accent");
  /** Accessible name of the chart, e.g. "Active accounts per day". */
  readonly label = input.required<string>();
  /** Readout for one day, e.g. "3 active accounts". */
  readonly describe = input.required<(value: number) => string>();
  readonly height = input(190);

  private readonly frame = viewChild.required<ElementRef<HTMLElement>>("frame");
  private readonly width = trackWidth(this.frame);
  protected readonly active = signal<number | null>(null);
  protected readonly liveId = `time-chart-live-${++lastChart}`;

  /** Scales shared by the drawing and the pointer/keyboard readout. */
  private readonly geometry = computed(() => {
    const width = this.width();
    const height = this.height();
    const points = this.points();
    const plotWidth = Math.max(0, width - PAD.left - PAD.right);
    const plotHeight = height - PAD.top - PAD.bottom;
    const max = niceMax(Math.max(0, ...points.map((point) => point.value)));
    const band = points.length ? plotWidth / points.length : 0;
    const xAt = (index: number) => PAD.left + band * index + band / 2;
    const yAt = (value: number) => PAD.top + plotHeight - (value / max) * plotHeight;
    return { width, height, points, plotWidth, max, band, xAt, yAt };
  });

  /** Everything the SVG draws that does not depend on the highlighted day; null until the frame is measured. */
  protected readonly chart = computed(() => {
    const { width, height, points, plotWidth, max, band, xAt, yAt } = this.geometry();
    if (width <= 0) return null;
    const last = points.length - 1;
    const anchor = (index: number) => index === 0 ? "start" : index === last ? "end" : "middle";
    const line = points.map((point, index) => `${index ? "L" : "M"}${xAt(index).toFixed(1)},${yAt(point.value).toFixed(1)}`).join("");
    const columnWidth = Math.max(2, Math.min(24, band - 2));
    const labelEvery = Math.max(1, Math.ceil(points.length / Math.max(2, Math.floor(plotWidth / 70))));
    const peak = points.reduce((best, point, index) => point.value > (points[best]?.value ?? -1) ? index : best, 0);
    return {
      width,
      height,
      top: PAD.top,
      left: PAD.left,
      right: width - PAD.right,
      baseline: yAt(0),
      ticks: [0, max / 2, max].map((tick) => ({ value: tick, y: yAt(tick), text: Number.isInteger(tick) ? String(tick) : tick.toFixed(1) })),
      labels: points.flatMap((point, index) => index % labelEvery === 0 || index === last
        ? [{ date: point.date, x: xAt(index), anchor: anchor(index), text: point.label }]
        : []),
      line,
      area: points.length ? `${line}L${xAt(last).toFixed(1)},${yAt(0)}L${xAt(0).toFixed(1)},${yAt(0)}Z` : "",
      last: points.length > 0 ? { x: xAt(last), y: yAt(points[last].value) } : null,
      columns: points.flatMap((point, index) => point.value > 0
        ? [{ date: point.date, index, d: roundedTop(xAt(index) - columnWidth / 2, yAt(point.value), columnWidth, yAt(0) - yAt(point.value)) }]
        : []),
      peak: points.length > 0 && points[peak].value > 0
        ? { x: xAt(peak), y: yAt(points[peak].value) - 8, anchor: anchor(peak), text: String(points[peak].value) }
        : null,
    };
  });

  /** The highlighted day: the crosshair position and, when it is a real day, its marker and readout. */
  protected readonly focus = computed(() => {
    const active = this.active();
    if (active === null) return null;
    const { width, points, xAt, yAt } = this.geometry();
    const point = points[active];
    return {
      x: xAt(active),
      point: point ? {
        x: xAt(active),
        y: yAt(point.value),
        label: point.label,
        readout: this.describe()(point.value),
        tooltipLeft: Math.min(Math.max(xAt(active), 70), Math.max(70, width - 70)),
      } : null,
    };
  });

  protected readonly live = computed(() => {
    const point = this.focus()?.point;
    return point ? `${point.label}: ${point.readout}` : "";
  });

  protected onPointer(event: PointerEvent): void {
    // Pointer coordinates are visual px; scale them back to the SVG's layout px (the page may be zoomed).
    const { width, band, points } = this.geometry();
    const box = (event.currentTarget as SVGSVGElement).getBoundingClientRect();
    const x = (event.clientX - box.left) * (width / (box.width || 1));
    const index = Math.floor((x - PAD.left) / (band || 1));
    this.active.set(index >= 0 && index < points.length ? index : null);
  }

  protected onKey(event: KeyboardEvent): void {
    const points = this.points();
    if (!points.length) return;
    const last = points.length - 1;
    const current = this.active() ?? last;
    const next = event.key === "ArrowLeft" ? Math.max(0, current - 1)
      : event.key === "ArrowRight" ? Math.min(last, current + 1)
      : event.key === "Home" ? 0 : event.key === "End" ? last : null;
    if (next === null) return;
    event.preventDefault();
    this.active.set(next);
  }

  protected onFocus(): void {
    this.active.update((current) => current ?? this.points().length - 1);
  }
}

/** A column with a 4px rounded top and a square foot on the baseline. */
function roundedTop(x: number, y: number, width: number, height: number): string {
  const r = Math.min(4, width / 2, height);
  return `M${x},${y + height}V${y + r}Q${x},${y} ${x + r},${y}H${x + width - r}Q${x + width},${y} ${x + width},${y + r}V${y + height}Z`;
}

/** Ranked horizontal bars built from plain HTML, each labelled with its value. */
@Component({
  selector: "app-bar-list",
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: "./admin-analytics.component.css",
  host: { class: "contents" },
  template: `
    <ul class="barList">
      @for (row of bars(); track row.key) {
        <li>
          <span class="barLabel">{{ row.label }}</span>
          <span class="barTrack" aria-hidden="true"><span [style.width.%]="row.percent"></span></span>
          <span class="barValue"><b>{{ row.display }}</b>@if (row.detail) {<small>{{ row.detail }}</small>}</span>
        </li>
      }
    </ul>
  `,
})
export class BarListComponent {
  readonly rows = input.required<{ key: string; label: string; value: number; display: string; detail?: string }[]>();
  readonly max = input<number>();

  protected readonly bars = computed(() => {
    const rows = this.rows();
    const top = this.max() ?? Math.max(1, ...rows.map((row) => row.value));
    return rows.map((row) => ({ ...row, percent: Math.max(2, (row.value / top) * 100) }));
  });
}
