"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import styles from "./admin-analytics.module.css";

/**
 * Small, dependency-free SVG charts for the admin analytics dashboard. Each chart plots one series
 * (identity comes from the title, so there is no legend), keeps marks thin, and is readable without the
 * pointer: arrow keys move the same readout the hover shows, and every value is also in a table view.
 */

export type Tone = "accent" | "critical";

/** Width of an element, kept up to date with a ResizeObserver (0 until measured). */
function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    // clientWidth is in layout px; getBoundingClientRect() would include the desktop `zoom` on <html> (globals.css).
    const update = () => setWidth(element.clientWidth);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

/** A round axis maximum (1, 2, 5 × 10ⁿ) at or above `value`, never below 4 so small counts get whole ticks. */
export function niceMax(value: number): number {
  if (value <= 4) return 4;
  const power = 10 ** Math.floor(Math.log10(value));
  for (const step of [1, 2, 2.5, 5, 10]) if (step * power >= value) return step * power;
  return 10 * power;
}

/** A 12-ish point trend line for a stat tile. Decorative: the tile's number carries the value. */
export function Sparkline({ values, tone = "accent" }: { values: number[]; tone?: Tone }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const height = 32;
  const max = Math.max(1, ...values);
  const step = values.length > 1 ? (width - 4) / (values.length - 1) : 0;
  const points = values.map((value, index) => [2 + index * step, height - 3 - (value / max) * (height - 6)] as const);
  const line = points.map(([x, y], index) => `${index ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join("");
  const last = points.at(-1);
  return <div ref={ref} className={styles.sparkline} data-tone={tone} aria-hidden="true">
    {width > 0 && values.length > 1 && <svg width={width} height={height}>
      <path d={`${line}L${points.at(-1)![0].toFixed(1)},${height}L2,${height}Z`} className={styles.area} />
      <path d={line} className={styles.line} />
      {last && <circle cx={last[0]} cy={last[1]} r={3} className={styles.dot} />}
    </svg>}
  </div>;
}

export interface TimePoint { date: string; label: string; value: number }

/**
 * A daily series as a line (with a soft area) or as columns. Hovering snaps a crosshair to the nearest day;
 * focusing the chart and using ←/→ (Home/End) does the same, announced through a live region.
 */
export function TimeChart({ points, kind, tone = "accent", label, describe, height = 190 }: {
  points: TimePoint[];
  kind: "line" | "column";
  tone?: Tone;
  /** Accessible name of the chart, e.g. "Active accounts per day". */
  label: string;
  /** Readout for one day, e.g. "3 active accounts". */
  describe: (value: number) => string;
  height?: number;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);
  const liveId = useId();
  const pad = { top: 12, right: 12, bottom: 26, left: 34 };
  const plotWidth = Math.max(0, width - pad.left - pad.right);
  const plotHeight = height - pad.top - pad.bottom;
  const max = niceMax(Math.max(0, ...points.map((point) => point.value)));
  const ticks = [0, max / 2, max];
  const band = points.length ? plotWidth / points.length : 0;
  const xAt = (index: number) => pad.left + band * index + band / 2;
  const yAt = (value: number) => pad.top + plotHeight - (value / max) * plotHeight;

  const line = points.map((point, index) => `${index ? "L" : "M"}${xAt(index).toFixed(1)},${yAt(point.value).toFixed(1)}`).join("");
  const area = points.length ? `${line}L${xAt(points.length - 1).toFixed(1)},${yAt(0)}L${xAt(0).toFixed(1)},${yAt(0)}Z` : "";
  const columnWidth = Math.max(2, Math.min(24, band - 2));
  const labelEvery = Math.max(1, Math.ceil(points.length / Math.max(2, Math.floor(plotWidth / 70))));
  const peak = points.reduce((best, point, index) => point.value > (points[best]?.value ?? -1) ? index : best, 0);

  function onPointer(event: PointerEvent<SVGSVGElement>) {
    // Pointer coordinates are visual px; scale them back to the SVG's layout px (the page may be zoomed).
    const box = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - box.left) * (width / (box.width || 1));
    const index = Math.floor((x - pad.left) / (band || 1));
    setActive(index >= 0 && index < points.length ? index : null);
  }
  function onKey(event: KeyboardEvent<HTMLDivElement>) {
    if (!points.length) return;
    const last = points.length - 1;
    const current = active ?? last;
    const next = event.key === "ArrowLeft" ? Math.max(0, current - 1)
      : event.key === "ArrowRight" ? Math.min(last, current + 1)
      : event.key === "Home" ? 0 : event.key === "End" ? last : null;
    if (next === null) return;
    event.preventDefault();
    setActive(next);
  }

  const focused = active !== null ? points[active] : null;
  const tooltipLeft = active !== null ? Math.min(Math.max(xAt(active), 70), Math.max(70, width - 70)) : 0;

  return <div className={styles.chart} data-tone={tone}>
    <div ref={ref} className={styles.chartFrame} style={{ height }} tabIndex={0} role="group"
      aria-label={label} aria-describedby={liveId} onKeyDown={onKey} onFocus={() => setActive((current) => current ?? points.length - 1)} onBlur={() => setActive(null)}>
      {width > 0 && <svg width={width} height={height} aria-hidden="true" onPointerMove={onPointer} onPointerLeave={() => setActive(null)}>
        {ticks.map((tick) => <g key={tick}>
          <line x1={pad.left} x2={width - pad.right} y1={yAt(tick)} y2={yAt(tick)} className={tick === 0 ? styles.baseline : styles.grid} />
          <text x={pad.left - 8} y={yAt(tick)} className={styles.tick} textAnchor="end" dominantBaseline="middle">{Number.isInteger(tick) ? tick : tick.toFixed(1)}</text>
        </g>)}
        {points.map((point, index) => index % labelEvery === 0 || index === points.length - 1
          ? <text key={point.date} x={xAt(index)} y={height - 8} className={styles.tick} textAnchor={index === 0 ? "start" : index === points.length - 1 ? "end" : "middle"}>{point.label}</text>
          : null)}
        {active !== null && <line x1={xAt(active)} x2={xAt(active)} y1={pad.top} y2={yAt(0)} className={styles.crosshair} />}
        {kind === "line" ? <>
          <path d={area} className={styles.area} />
          <path d={line} className={styles.line} />
          {points.length > 0 && <circle cx={xAt(points.length - 1)} cy={yAt(points.at(-1)!.value)} r={4} className={styles.dot} />}
          {active !== null && <circle cx={xAt(active)} cy={yAt(points[active].value)} r={5} className={styles.dot} />}
        </> : points.map((point, index) => point.value > 0 && <path key={point.date}
          className={`${styles.column}${active === index ? ` ${styles.columnActive}` : ""}`}
          d={roundedTop(xAt(index) - columnWidth / 2, yAt(point.value), columnWidth, yAt(0) - yAt(point.value))} />)}
        {points.length > 0 && points[peak].value > 0 && active === null &&
          <text x={xAt(peak)} y={yAt(points[peak].value) - 8} className={styles.peak} textAnchor={peak === 0 ? "start" : peak === points.length - 1 ? "end" : "middle"}>{points[peak].value}</text>}
      </svg>}
      {focused && <div className={styles.tooltip} style={{ left: tooltipLeft }} aria-hidden="true">
        <b>{describe(focused.value)}</b><span>{focused.label}</span>
      </div>}
    </div>
    <p id={liveId} className="sr-only" aria-live="polite">{focused ? `${focused.label}: ${describe(focused.value)}` : ""}</p>
  </div>;
}

/** A column with a 4px rounded top and a square foot on the baseline. */
function roundedTop(x: number, y: number, width: number, height: number) {
  const r = Math.min(4, width / 2, height);
  return `M${x},${y + height}V${y + r}Q${x},${y} ${x + r},${y}H${x + width - r}Q${x + width},${y} ${x + width},${y + r}V${y + height}Z`;
}

/** Ranked horizontal bars built from plain HTML, each labelled with its value. */
export function BarList({ rows, max }: { rows: { key: string; label: string; value: number; display: string; detail?: string }[]; max?: number }) {
  const top = max ?? Math.max(1, ...rows.map((row) => row.value));
  return <ul className={styles.barList}>
    {rows.map((row) => <li key={row.key}>
      <span className={styles.barLabel}>{row.label}</span>
      <span className={styles.barTrack} aria-hidden="true"><span style={{ width: `${Math.max(2, (row.value / top) * 100)}%` }} /></span>
      <span className={styles.barValue}><b>{row.display}</b>{row.detail && <small>{row.detail}</small>}</span>
    </li>)}
  </ul>;
}
