import type { CSSProperties } from "react";

type BlockProps = { width?: string | number; height?: string | number; className?: string; style?: CSSProperties };

/** A single shimmering placeholder block. Decorative: wrap groups in <SkeletonRegion> for a11y. */
export function Skeleton({ width, height, className = "", style }: BlockProps) {
  return <span aria-hidden="true" className={`skeleton ${className}`.trim()} style={{ width, height, ...style }} />;
}

/** Announces a loading state to assistive tech while its children paint placeholders. */
export function SkeletonRegion({ label, className = "", children }: { label: string; className?: string; children: React.ReactNode }) {
  return <div role="status" aria-live="polite" aria-busy="true" className={className}>
    <span className="sr-only">{label}</span>
    {children}
  </div>;
}

/** Placeholder paragraph: `lines` bars, the last one shorter. */
export function SkeletonText({ lines = 3, className = "" }: { lines?: number; className?: string }) {
  return <span aria-hidden="true" className={`skeleton-text ${className}`.trim()}>
    {Array.from({ length: lines }, (_, index) => <Skeleton key={index} className="skeleton-line" width={index === lines - 1 && lines > 1 ? "60%" : "100%"} />)}
  </span>;
}

/** Small inline spinner for buttons / in-flight refreshes. */
export function Spinner({ className = "" }: { className?: string }) {
  return <span aria-hidden="true" className={`spinner ${className}`.trim()} />;
}
