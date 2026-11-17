/**
 * Tailwind class lists for the step-by-step creator (character-wizard.tsx) and the level-up dialog (level-up.tsx),
 * which share their frame, step bar, option cards and fields. Keys keep the names the screens already use.
 * States are attributes on the element, not extra classes: data-state="current" | "done" on a step, data-on and
 * data-locked on a skill, data-bad on the point pool. Option cards are the shared .choice (styles/ui.css).
 */

/** The small-caps label used by fact lists, table heads and summaries. */
const caps = "font-label text-xs tracking-[.1em] uppercase text-muted";

/** A numbered step in the bar: muted, then underlined in violet while current, its number gilt once done. */
const stepState = "data-[state=current]:bg-surface data-[state=current]:text-ink data-[state=current]:shadow-[inset_0_-3px_var(--accent)] "
  + "data-[state=current]:[&_span]:border-accent-fill data-[state=current]:[&_span]:bg-accent-fill data-[state=current]:[&_span]:text-on-accent "
  + "data-[state=done]:[&_span]:border-gilt data-[state=done]:[&_span]:bg-[color-mix(in_srgb,var(--gilt)_45%,var(--surface))] data-[state=done]:[&_span]:text-ink";
const stepNumber = "[&_span]:grid [&_span]:place-items-center [&_span]:rounded-full [&_span]:border [&_span]:border-line [&_span]:bg-surface [&_span]:font-display [&_span]:text-xs [&_span]:font-semibold";

export const wz = {
  wizard: "relative mb-6.5 rounded-card border border-line bg-surface shadow-[0_0_0_4px_var(--surface),0_0_0_5px_var(--line),0_14px_30px_rgb(23_17_36/0.14)]",
  head: "flex items-start justify-between px-6 pt-5.5 pb-3 max-[560px]:px-3.5 [&_h2]:m-0 [&_h2]:font-display [&_h2]:text-[26px] [&_h2]:leading-[1.15] [&_h2]:font-semibold [&_h2]:text-ink",
  kicker: "m-0 mb-1.5 font-label text-sm tracking-[.02em] text-accent",
  close: "size-8 cursor-pointer rounded-full border border-line bg-transparent text-xl text-ink pointer-coarse:size-11 max-[650px]:size-11",

  steps: "grid grid-cols-[repeat(9,minmax(max-content,1fr))] overflow-x-auto border-y border-line bg-paper/70 max-[820px]:grid-cols-3",
  step: `grid cursor-pointer justify-items-center gap-1 border-0 border-r border-line bg-transparent px-0.75 py-2.5 font-body text-xs font-semibold text-muted last:border-r-0 hover:text-ink max-[820px]:nth-[3n]:border-r-0 max-[820px]:nth-[-n+6]:border-b [&_span]:size-6.5 ${stepNumber} ${stepState}`,

  body: "px-6 pt-5 pb-2 max-[560px]:px-3.5 [&>label]:mt-3.5",
  intro: "m-0 mb-4 max-w-180 text-sm leading-relaxed text-muted italic",
  cardGrid: "grid grid-cols-[repeat(auto-fill,minmax(170px,1fr))] gap-2",
  choice: "choice content-start disabled:cursor-not-allowed disabled:opacity-50 [&_strong]:font-display [&_strong]:text-[15px] [&_strong]:font-semibold "
    + "[&_small]:font-label [&_small]:text-xs [&_small]:tracking-[.05em] [&_small]:text-accent [&_em]:text-xs [&_em]:leading-[1.45] [&_em]:text-muted "
    + "[&_ul]:mt-1 [&_ul]:mb-0 [&_ul]:pl-4 [&_ul]:text-xs [&_ul]:leading-normal [&_ul]:text-muted",
  /** The shared .choice shows the selection from aria-pressed. */
  selected: "",

  detail: "relative mt-4 rounded-card border border-line bg-paper px-4.5 py-4 before:absolute before:inset-x-0 before:top-0 before:h-0.75 before:rounded-t-card before:bg-linear-to-r before:from-accent before:to-transparent "
    + "[&_h3]:m-0 [&_h3]:mb-2.5 [&_h3]:font-display [&_h3]:text-xl [&_h3]:font-semibold [&_h3]:text-accent",
  facts: "m-0 grid grid-cols-2 gap-x-5.5 gap-y-2 max-[820px]:grid-cols-1 [&_div]:grid [&_div]:gap-0.5 [&_dt]:font-label [&_dt]:text-xs [&_dt]:tracking-[.1em] [&_dt]:text-muted [&_dt]:uppercase [&_dd]:m-0 [&_dd]:text-xs [&_dd]:leading-[1.45] [&_dd]:text-ink",

  inline: "mt-3.5 flex flex-wrap items-end gap-x-5 gap-y-3",
  field: "grid gap-1.5 text-xs text-muted [&_:is(input,select,textarea)]:min-w-0 [&_:is(input,select,textarea)]:rounded-control [&_:is(input,select,textarea)]:border [&_:is(input,select,textarea)]:border-line "
    + "[&_:is(input,select,textarea)]:bg-surface [&_:is(input,select,textarea)]:px-2.5 [&_:is(input,select,textarea)]:py-2.25 [&_:is(input,select,textarea)]:font-body [&_:is(input,select,textarea)]:text-sm [&_:is(input,select,textarea)]:text-ink [&_textarea]:resize-y",
  check: "inline-flex cursor-pointer items-center gap-2 text-xs text-ink [&_input]:accent-accent",
  note: "mt-1.5 mb-0 text-xs text-muted",

  subhead: `mt-3.5 mb-1.5 ${caps}`,
  traitList: "m-0 grid [&>div]:border-b [&>div]:border-dotted [&>div]:border-line [&>div]:py-1.5 [&>div:last-child]:border-b-0 [&>div:last-child]:pb-0 "
    + "[&_dt]:font-display [&_dt]:text-[14px] [&_dt]:font-semibold [&_dt]:text-ink [&_dd]:m-0 [&_dd]:mt-0.5 [&_dd]:text-xs [&_dd]:leading-normal [&_dd]:text-muted",
  lineageText: "mt-2.5 mb-0 text-xs leading-normal text-ink",
  group: "mt-4 mb-0 rounded-control border border-line px-3.5 pt-3 pb-3.5 [&_legend]:px-1.5 [&_legend]:font-display [&_legend]:text-sm [&_legend]:font-semibold [&_legend]:text-accent",
  pills: "grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-1.5",

  skillGrid: "grid grid-cols-[repeat(auto-fill,minmax(165px,1fr))] gap-1.5",
  skill: "flex cursor-pointer items-center gap-2 rounded-control border border-line bg-paper px-2.25 py-1.75 text-xs [&_input]:accent-accent [&_span]:grid [&_span]:gap-px "
    + "[&_small]:font-label [&_small]:text-xs [&_small]:tracking-[.05em] [&_small]:text-muted [&_small]:uppercase data-on:border-accent data-on:bg-surface data-locked:cursor-default data-locked:opacity-70",

  tabs: "grid grid-cols-3 gap-2 max-[820px]:grid-cols-1",
  toolbar: "mt-3.5 mb-2 flex flex-wrap items-center gap-3.5",
  link: "cursor-pointer border-0 bg-transparent p-0 font-body text-xs font-semibold text-accent underline underline-offset-3 pointer-coarse:inline-flex pointer-coarse:min-h-11 pointer-coarse:items-center max-[650px]:inline-flex max-[650px]:min-h-11 max-[650px]:items-center",
  pool: "border border-dashed border-line px-2 py-1 font-label text-xs text-ink data-bad:border-bad data-bad:text-bad",
  rolls: "m-0 flex list-none flex-wrap gap-1.5 p-0 [&_li]:min-w-[2.5em] [&_li]:cursor-help [&_li]:border [&_li]:border-dashed [&_li]:border-line [&_li]:px-2 [&_li]:py-1 [&_li]:text-center [&_li]:font-label [&_li]:text-xs [&_li]:font-semibold [&_li]:text-ink",

  abilityTable: "overflow-hidden rounded-control border border-line",
  abilityHead: "grid grid-cols-[minmax(110px,1.4fr)_1.4fr_.7fr_.7fr_.7fr] items-center gap-2 bg-accent-fill px-3 py-2 font-label text-xs tracking-[.12em] text-on-accent uppercase max-[560px]:grid-cols-[1.2fr_1.5fr_.6fr_.6fr_.6fr] max-[560px]:gap-1 max-[560px]:px-2 max-[560px]:py-1.75",
  abilityRow: "grid grid-cols-[minmax(110px,1.4fr)_1.4fr_.7fr_.7fr_.7fr] items-center gap-2 border-t border-line px-3 py-2 text-sm odd:bg-paper/60 max-[560px]:grid-cols-[1.2fr_1.5fr_.6fr_.6fr_.6fr] max-[560px]:gap-1 max-[560px]:px-2 max-[560px]:py-1.75 "
    + "[&_b]:font-display [&_b]:text-sm [&_b]:font-semibold [&_b_i]:text-gilt-text [&_b_i]:not-italic [&_select]:rounded-control [&_select]:border [&_select]:border-line [&_select]:bg-surface [&_select]:px-2 [&_select]:py-1.5 [&_select]:font-body [&_select]:text-sm [&_select]:text-ink "
    + "[&_strong]:font-display [&_strong]:text-lg [&_strong]:font-bold [&_strong]:text-ink",
  bonusCell: "font-bold text-accent",
  mod: "font-label text-sm font-bold",
  stepper: "inline-flex items-center gap-1.5 [&_button]:size-6 [&_button]:cursor-pointer [&_button]:rounded-control [&_button]:border [&_button]:border-line [&_button]:bg-surface [&_button]:text-ink [&_button:disabled]:cursor-not-allowed [&_button:disabled]:opacity-35 "
    + "[&_output]:min-w-5 [&_output]:text-center [&_output]:font-bold [&_small]:font-label [&_small]:text-xs [&_small]:text-muted",
  warning: "text-xs text-bad",

  kitGrid: "grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-2",
  gold: "mt-3.5 mb-0 text-sm [&_b]:font-display [&_b]:text-base [&_b]:font-bold [&_b]:text-accent",
  formGrid: "mb-1 grid grid-cols-[1.4fr_1fr] gap-3 max-[820px]:grid-cols-1",

  summary: "rounded-card border border-line bg-paper p-4.5 [&_header]:border-b-2 [&_header]:border-accent [&_header]:pb-2 [&_h3]:m-0 [&_h3]:font-display [&_h3]:text-[26px] [&_h3]:font-bold [&_h3]:text-accent "
    + "[&_header_p]:mt-0.75 [&_header_p]:mb-0 [&_header_p]:text-xs [&_header_p]:text-muted [&_header_p]:italic",
  vitals: `my-3.5 grid grid-cols-6 gap-1.5 max-[820px]:grid-cols-3 [&_div]:grid [&_div]:justify-items-center [&_div]:gap-0.75 [&_div]:rounded-control [&_div]:border [&_div]:border-line [&_div]:bg-surface [&_div]:px-1 [&_div]:py-2.25 [&_div]:text-center `
    + "[&_span]:font-label [&_span]:text-xs [&_span]:tracking-[.06em] [&_span]:text-muted [&_span]:uppercase [&_b]:font-display [&_b]:text-xl [&_b]:font-bold [&_b]:text-ink",
  abilityStrip: "grid grid-cols-6 gap-1.5 max-[820px]:grid-cols-3 [&_div]:grid [&_div]:justify-items-center [&_div]:gap-0.5 [&_div]:rounded-[14px_14px_3px_3px] [&_div]:border [&_div]:border-line [&_div]:bg-surface [&_div]:px-1 [&_div]:py-2 "
    + "[&_span]:font-label [&_span]:text-xs [&_span]:tracking-[.08em] [&_span]:text-muted [&_b]:font-display [&_b]:text-xl [&_b]:font-bold [&_small]:text-xs [&_small]:text-muted [&_em]:font-label [&_em]:text-xs [&_em]:text-muted [&_em]:not-italic",
  twoCol: "mt-3.5 grid grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] gap-4.5 max-[820px]:grid-cols-1 [&_h4]:mt-2.5 [&_h4]:mb-0.75 [&_h4]:font-display [&_h4]:text-xs [&_h4]:font-semibold [&_h4]:tracking-[.03em] [&_h4]:text-accent [&_h4:first-child]:mt-0 [&_p]:m-0 [&_p]:text-xs [&_p]:leading-normal",
  skillList: "m-0 list-none columns-2 gap-x-3.5 p-0 text-xs max-[560px]:columns-1 [&_li]:flex [&_li]:break-inside-avoid [&_li]:items-baseline [&_li]:gap-1.5 [&_li]:py-0.5 [&_li]:text-muted [&_li_b]:ml-auto [&_li_b]:font-label [&_li_b]:text-xs [&_i]:text-xs [&_i]:text-accent [&_i]:not-italic",
  /** A proficient save or skill in the summary: stands out of the muted list. */
  prof: "font-semibold text-ink!",

  foot: "mt-3 flex items-center gap-2.5 border-t border-line px-6 py-3.5 max-[560px]:flex-wrap max-[560px]:px-3.5",
  issues: "mr-auto text-xs text-bad max-[560px]:basis-full",
  srd: "m-0 px-6 pb-3.5 font-label text-xs text-muted max-[560px]:px-3.5",
  sectionTitle: "mt-6 mb-2 border-b border-current pb-1 text-[1.1rem]",
};

/** The level-up dialog's own pieces (it reuses the frame, fields and option cards above). */
export const lu = {
  progress: `m-0 flex list-none overflow-x-auto border-y border-line bg-paper/70 p-0 [&_li]:flex [&_li]:flex-[1_0_auto] [&_li]:items-center [&_li]:justify-center [&_li]:gap-2 [&_li]:border-r [&_li]:border-line [&_li]:px-3.5 [&_li]:py-2.5 `
    + "[&_li]:font-body [&_li]:text-xs [&_li]:font-semibold [&_li]:whitespace-nowrap [&_li]:text-muted [&_li:last-child]:border-r-0 max-[560px]:[&_li]:px-2.5 max-[560px]:[&_li]:py-2.25 "
    + "[&_li_span]:grid [&_li_span]:size-5.5 [&_li_span]:place-items-center [&_li_span]:rounded-full [&_li_span]:border [&_li_span]:border-line [&_li_span]:bg-surface [&_li_span]:font-display [&_li_span]:text-xs [&_li_span]:font-semibold "
    + "[&_li[data-state=current]]:bg-surface [&_li[data-state=current]]:text-ink [&_li[data-state=current]]:shadow-[inset_0_-3px_var(--accent)] [&_li[data-state=current]_span]:border-accent-fill [&_li[data-state=current]_span]:bg-accent-fill [&_li[data-state=current]_span]:text-on-accent "
    + "[&_li[data-state=done]_span]:border-gilt [&_li[data-state=done]_span]:bg-[color-mix(in_srgb,var(--gilt)_45%,var(--surface))] [&_li[data-state=done]_span]:text-ink",

  cards: "grid grid-cols-[repeat(auto-fit,minmax(230px,1fr))] gap-2.5",
  card: "rounded-card border border-line bg-paper px-4 py-3.5 [&_h3]:m-0 [&_h3]:mb-2 [&_h3]:font-display [&_h3]:text-[15px] [&_h3]:font-semibold [&_h3]:text-accent [&_p]:mt-1.5 [&_p]:mb-0 [&_p]:text-xs [&_p]:leading-normal [&_p]:text-muted",
  big: "m-0! font-display text-[22px]! font-semibold text-ink! [&_b]:text-accent",
  changes: "m-0 grid list-none gap-1.5 p-0 [&_li]:flex [&_li]:justify-between [&_li]:gap-2.5 [&_li]:text-xs [&_b]:text-right [&_b]:font-label [&_b]:text-xs [&_b]:font-semibold [&_b]:text-ink",

  heading: "mt-4.5 mb-2 font-display text-[15px] font-semibold text-accent",
  features: "m-0 grid list-none gap-1.5 p-0 [&_li]:grid [&_li]:gap-0.5 [&_li]:rounded-control [&_li]:border [&_li]:border-l-3 [&_li]:border-line [&_li]:border-l-accent [&_li]:bg-surface [&_li]:px-3 [&_li]:py-2.25 "
    + "[&_b]:font-display [&_b]:text-sm [&_b]:font-semibold [&_b]:text-ink [&_span]:text-xs [&_span]:leading-normal [&_span]:text-muted",
  ahead: "mt-3.5 mb-0 text-xs text-muted italic",
  callout: "mt-3.5 mb-0 rounded-card border border-dashed border-accent bg-paper px-3.5 py-2.5 text-sm text-ink",

  tabs: "mt-4 grid grid-cols-2 gap-2 max-[560px]:grid-cols-1",
  abilityPick: "mt-2 grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-2",

  review: "m-0 grid gap-1.5 [&_div]:grid [&_div]:grid-cols-[minmax(130px,.5fr)_1fr] [&_div]:gap-3 [&_div]:rounded-control [&_div]:border [&_div]:border-line [&_div]:bg-paper [&_div]:px-3 [&_div]:py-2.25 max-[560px]:[&_div]:grid-cols-1 "
    + `[&_dt]:self-center [&_dt]:font-label [&_dt]:text-xs [&_dt]:tracking-[.1em] [&_dt]:text-muted [&_dt]:uppercase [&_dd]:m-0 [&_dd]:font-display [&_dd]:text-[14px] [&_dd]:font-semibold [&_dd]:text-ink`,
};
