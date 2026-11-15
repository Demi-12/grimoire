/**
 * Tailwind class lists shared by the overview, the battle map picker and the "Run the game" hub, so their tiles,
 * cards and actions stay identical. Colours, corners and fonts come from the theme (globals.css).
 */
export const sectionStack = "flex flex-col gap-7 max-[650px]:gap-5 [&>header]:mb-0";
/** Square icon well used by shortcut tiles and hub links (on the filled primary tile it turns translucent). */
export const glyphWell = (onFill = false) => `grid size-9 flex-none place-items-center rounded-control text-[19px] ${onFill ? "bg-on-accent/15 text-on-accent" : "bg-sunken text-accent"}`;
/** A card that is a link: lifts on hover, its border turning to the accent. */
export const linkCard = "panel flex text-ink no-underline transition-[border-color,translate] duration-150 hover:-translate-y-px hover:border-accent";
export const cardTitle = "m-0 font-display text-[19px] leading-tight font-medium [overflow-wrap:anywhere] text-ink";
export const sectionTitle = "m-0 font-display text-2xl font-medium text-ink";
export const note = "m-0 text-sm leading-normal text-muted";
/** Small-caps role line on a campaign card ("DM · 3 players"); the DM's own tables read in gilt. */
export const roleLine = (isDm: boolean) => `m-0 mb-1 font-label text-xs font-bold tracking-[.1em] ${isDm ? "text-gilt-text" : "text-muted"}`;
export const cardActions = "flex flex-wrap gap-2";
export const cardAction = "button button-quiet button-sm min-h-11 flex-auto";
/** Dashed call to action shown when a list is empty. */
export const firstRun = "flex flex-wrap items-center justify-between gap-4 rounded-card border border-dashed border-control-line p-6";
