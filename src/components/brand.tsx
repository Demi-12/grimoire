import { useId } from "react";

const STAR = "M32 10L33.99 27.2L40.84 23.16L36.8 30.01L54 32L36.8 33.99L40.84 40.84L33.99 36.8L32 54L30.01 36.8L23.16 40.84L27.2 33.99L10 32L27.2 30.01L23.16 23.16L30.01 27.2Z";

/** The Grimoire mark: a gilt star on a leather cover. Same drawing as src/app/icon.svg (the favicon). */
export function BrandMark({ size = 22, className }: { size?: number; className?: string }) {
  const id = useId();
  return <svg className={className ? `brand-mark ${className}` : "brand-mark"} width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id={`${id}c`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#4b2f7d" /><stop offset="1" stopColor="#1f1530" /></linearGradient>
      <linearGradient id={`${id}g`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#f6d98f" /><stop offset="1" stopColor="#d39f45" /></linearGradient>
    </defs>
    <rect width="64" height="64" rx="14" fill={`url(#${id}c)`} />
    <rect x="4.5" y="4.5" width="55" height="55" rx="10" fill="none" stroke="#d8aa55" strokeOpacity=".55" strokeWidth="1.5" />
    <circle cx="32" cy="32" r="16" fill="none" stroke="#d8aa55" strokeOpacity=".35" strokeWidth="1.5" />
    <path fill={`url(#${id}g)`} d={STAR} />
    <circle cx="32" cy="32" r="3" fill="#2a1b40" />
  </svg>;
}

const polar = (radius: number, degrees: number) => {
  const angle = (degrees - 90) * Math.PI / 180;
  return `${(radius * Math.cos(angle)).toFixed(1)} ${(radius * Math.sin(angle)).toFixed(1)}`;
};
const polygon = (radius: number, sides: number, offset = 0) =>
  `M${Array.from({ length: sides }, (_, index) => polar(radius, offset + index * 360 / sides)).join("L")}Z`;

/** Deterministic scatter so server and client render the same motes (no hydration mismatch). */
const MOTES = Array.from({ length: 34 }, (_, index) => {
  const random = (salt: number) => { const x = Math.sin(index * 127.1 + salt * 311.7) * 43758.5453; return x - Math.floor(x); };
  const round = (value: number) => Math.round(value * 100) / 100;
  return { left: round(random(1) * 100), top: round(random(2) * 100), size: round(1.5 + random(3) * 2.5), delay: round(-random(4) * 9), duration: round(5 + random(5) * 6) };
});

/**
 * Sign-in backdrop: a slowly turning arcane circle behind the gate and drifting gilt motes.
 * Pure decoration, behind everything (see `.gate-backdrop` in globals.css); still under prefers-reduced-motion.
 */
export function GateBackdrop() {
  return <div className="gate-backdrop" aria-hidden="true">
    <svg className="gate-sigil" viewBox="-500 -500 1000 1000">
      <g className="gate-sigil-outer">
        <circle r="488" className="sigil-faint" />
        <circle r="470" />
        {Array.from({ length: 96 }, (_, index) => <path key={index} d={`M${polar(470, index * 3.75)}L${polar(index % 4 ? 458 : 446, index * 3.75)}`} />)}
        <circle r="434" className="sigil-faint" />
        {Array.from({ length: 24 }, (_, index) => <path key={index} className="sigil-gilt" d={`M${polar(420, index * 15)}m0 -7l6 7l-6 7l-6 -7Z`} />)}
        <circle r="404" />
      </g>
      <g className="gate-sigil-inner">
        <path d={polygon(404, 4)} />
        <path d={polygon(404, 4, 45)} />
        <circle r="286" className="sigil-faint" />
        <path className="sigil-gilt-line" d={polygon(286, 3)} />
        <path className="sigil-gilt-line" d={polygon(286, 3, 60)} />
        <circle r="143" />
        <circle r="128" className="sigil-faint" />
        {Array.from({ length: 8 }, (_, index) => <circle key={index} className="sigil-node" r="11" transform={`translate(${polar(404, index * 45).replace(" ", ",")})`} />)}
      </g>
    </svg>
    {MOTES.map((mote, index) => <span key={index} className="gate-mote" style={{ left: `${mote.left}%`, top: `${mote.top}%`, width: mote.size, height: mote.size, animationDelay: `${mote.delay}s`, animationDuration: `${mote.duration}s` }} />)}
  </div>;
}
