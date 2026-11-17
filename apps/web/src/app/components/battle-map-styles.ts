/**
 * Tailwind class lists for the battle map page (battle-map.tsx). The board's colours are theme tokens
 * (map-floor, map-line, map-coord); the paints on it (walls, doors, fog, token rims) stay fixed in both themes,
 * because they sit on the board, not on the page. States are passed in, so each element gets one set of classes.
 */
type Status = "live" | "connecting" | "offline";
type WallKind = "wall" | "doorClosed" | "doorOpen";

const fieldBox = "min-h-9 rounded-control border border-control-line bg-paper px-2 py-1.5 font-body font-medium text-ink";
const field = `${fieldBox} text-[15px]`;
/** Stat tiles on a hero's sheet (vitals and ability scores). */
const statGrid = "m-0 grid gap-1.5 [&>div]:grid [&>div]:gap-0.5 [&>div]:rounded-control [&>div]:border [&>div]:border-line [&>div]:bg-paper [&>div]:p-1.5 [&>div]:text-center "
  + "[&_dt]:font-label [&_dt]:text-xs [&_dt]:font-bold [&_dt]:[overflow-wrap:anywhere] [&_dt]:text-muted [&_dd]:m-0 [&_dd]:font-label [&_dd]:text-[17px] [&_dd]:font-bold";
const small = "min-h-8 rounded-control border border-control-line bg-paper px-1.5 py-1 text-[13px] text-ink pointer-coarse:min-h-10";

export const bm = {
  page: "min-h-screen bg-paper p-4 text-ink max-[520px]:p-3",
  loading: "mx-auto mt-[15vh] max-w-140 text-center text-[17px]",
  notice: "panel mx-auto mt-[15vh] grid max-w-140 justify-items-center gap-3.5 p-6 text-center text-[17px] [&_p]:m-0",

  top: "mx-auto mb-3.5 flex max-w-350 flex-wrap items-center gap-x-4 gap-y-2.5",
  back: "inline-flex min-h-10 items-center font-label text-[14px] font-bold text-accent no-underline hover:underline",
  titleBlock: "min-w-0 flex-1 [&_h1]:m-0 [&_h1]:font-display [&_h1]:text-[clamp(22px,4vw,30px)] [&_h1]:leading-[1.15] [&_h1]:font-medium [&_h1]:[overflow-wrap:anywhere]",
  kicker: "m-0 mb-0.5 font-label text-xs font-bold tracking-[.14em] text-muted",
  topActions: "flex flex-wrap items-center gap-2.5 max-[520px]:w-full",
  /** A labelled checkbox (the players' view switch and the board options). */
  check: "inline-flex min-h-10 cursor-pointer items-center gap-1.75 font-label text-[14px] font-medium [&_input]:size-4.5 [&_input]:accent-accent",
  status: (status: Status) => `inline-flex items-center gap-1.5 font-label text-[13px] font-bold ${status === "live" ? "text-good" : "text-warn"} `
    + `[&>span]:size-2.25 [&>span]:rounded-full [&>span]:bg-current ${status === "offline" ? "[&>span]:animate-blink" : ""}`,

  layout: "mx-auto grid max-w-350 grid-cols-[minmax(0,1fr)_340px] items-start gap-4 max-[900px]:grid-cols-1",
  boardWrap: "min-w-0",
  scroller: "overflow-x-auto",
  /**
   * The board: never taller than the screen (width follows the grid's --ratio). On a phone the squares stay big
   * enough to tap and the board scrolls sideways; at the table it fills the space the bar and legend leave.
   */
  board: (table: boolean) => `mx-auto block h-auto touch-pan-x touch-pan-y border border-line bg-surface select-none ${table
    ? "w-[min(100cqw,100cqh*var(--ratio))]"
    : "w-[min(100%,calc((100vh-140px)*var(--ratio)))] max-[900px]:w-[max(100%,var(--min-width))]"}`,
  floor: "cursor-pointer fill-map-floor",
  backdrop: "pointer-events-none",
  gridLines: "pointer-events-none fill-none stroke-map-line stroke-1",
  coords: "[&_text]:pointer-events-none [&_text]:fill-map-coord [&_text]:font-label [&_text]:text-[13px] [&_text]:font-bold [&_text]:[dominant-baseline:middle] [&_text]:[text-anchor:middle]",
  cone: "pointer-events-none stroke-[1.5] [fill-opacity:.16] [stroke-opacity:.55]",

  token: ({ pass, dragging, hidden, movable }: { pass: boolean; dragging: boolean; hidden: boolean; movable: boolean }) =>
    `group/token outline-none ${dragging ? "cursor-grabbing" : movable ? "cursor-grab touch-none transition-transform duration-250" : "cursor-default transition-transform duration-250"}`
    + `${hidden ? " opacity-50" : ""}${pass ? " pointer-events-none" : ""}`,
  selectRing: "fill-none stroke-gilt stroke-4",
  /** The token's disc: a dark rim (gold and thicker on your own hero), dashed while hidden, gilt when focused. */
  disc: (mine: boolean, hidden: boolean) => `${mine ? "stroke-[#f6d27a] stroke-4" : "stroke-[rgb(11_9_17/.7)] stroke-2"}${hidden ? " [stroke-dasharray:6_4]" : ""} group-focus-visible/token:stroke-gilt group-focus-visible/token:stroke-5`,
  tokenText: "pointer-events-none fill-white font-label font-bold [dominant-baseline:middle] [text-anchor:middle]",
  cross: "pointer-events-none stroke-white stroke-4 [stroke-linecap:round]",
  facing: "pointer-events-none fill-white stroke-[rgb(11_9_17/.7)] stroke-[1.5]",
  fog: (dm: boolean) => `pointer-events-none fill-[#0b0911] ${dm ? "[fill-opacity:.45]" : "[fill-opacity:.94]"}`,
  memory: (dm: boolean) => `pointer-events-none fill-[#0b0911] ${dm ? "[fill-opacity:.25]" : "[fill-opacity:.62]"}`,

  /** Walls and doors. A wide transparent line under each one makes it easy to tap. */
  walls: "pointer-events-none",
  wallPick: "group/pick pointer-events-auto cursor-pointer outline-none",
  wallHit: "stroke-transparent stroke-16 [stroke-linecap:round] group-focus-visible/pick:stroke-gilt group-focus-visible/pick:[stroke-opacity:.35]",
  wallLine: (kind: WallKind, erasing: boolean) => {
    const base = kind === "wall" ? "stroke-[#1b1622] stroke-6 [stroke-linecap:round]"
      : kind === "doorClosed" ? "stroke-[#a8620f] stroke-9 [stroke-linecap:butt]"
      : "stroke-[#a8620f] stroke-4 [stroke-dasharray:6_5] [stroke-linecap:butt]";
    // Erasing turns whatever is under the pointer red; otherwise doors light up to show they can be opened.
    const hover = erasing ? "group-hover/pick:stroke-[#c0392b]" : kind === "wall" ? "" : "group-hover/pick:stroke-gilt group-focus-visible/pick:stroke-gilt";
    return `${base} ${hover}`;
  },
  wallPreview: "pointer-events-none [&_circle]:fill-gilt [&_line]:stroke-gilt [&_line]:stroke-6 [&_line]:[stroke-dasharray:10_6] [&_line]:[stroke-linecap:round]",

  selectedBar: "mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-control border border-line bg-surface px-2.5 py-2 text-[15px]",
  selectedName: "min-w-0 flex-[1_1_140px] [overflow-wrap:anywhere]",
  selectedNote: (grow: boolean) => `${grow ? "flex-[1_1_180px]" : "flex-[0_1_auto]"} text-[13px] text-muted`,
  nudge: "inline-flex gap-1 [&_button]:size-11 [&_button]:cursor-pointer [&_button]:rounded-control [&_button]:border [&_button]:border-control-line [&_button]:bg-paper [&_button]:text-xl [&_button]:text-ink [&_button:hover]:bg-surface",
  vision: "inline-flex flex-wrap gap-1.5 [&_label]:inline-flex [&_label]:items-center [&_label]:gap-1 [&_label]:font-label [&_label]:text-[13px] [&_label]:font-bold",
  boardOptions: "mt-1.5 flex flex-wrap gap-x-4 gap-y-1",
  hint: "mt-2 mb-0 text-[14px] text-muted",
  error: "mt-2.5 mb-0 rounded-card border border-danger/40 bg-danger/5 px-2.5 py-2 text-[14px] text-danger",

  panel: "panel grid gap-4.5 p-3.5 [&_section]:grid [&_section]:gap-2.5 [&_h2]:m-0 [&_h2]:font-label [&_h2]:text-xs [&_h2]:font-bold [&_h2]:tracking-[.14em] [&_h2]:text-accent [&_h2]:uppercase",
  list: "m-0 grid list-none gap-1.5 p-0",
  /** A row in the panel's lists; a hidden monster's row is dashed like its token. */
  listItem: (hidden = false) => `flex flex-wrap items-center gap-1.5 rounded-control border border-line bg-paper px-2 py-1.5${hidden ? " border-dashed" : ""}`,
  itemName: "min-w-30 flex-1 cursor-pointer border-0 bg-transparent p-0 text-left font-body text-[15px] font-bold [overflow-wrap:anywhere] text-inherit [&_small]:block [&_small]:font-label [&_small]:text-[13px] [&_small]:font-medium [&_small]:text-muted",
  smallButton: "min-h-8 min-w-8 cursor-pointer rounded-control border border-control-line bg-transparent px-2 py-1 font-label text-[13px] font-bold text-accent hover:bg-surface pointer-coarse:min-h-10 pointer-coarse:min-w-10 "
    + "aria-pressed:border-accent-fill aria-pressed:bg-accent-fill aria-pressed:text-on-accent disabled:cursor-not-allowed disabled:opacity-60",
  empty: "m-0 text-[14px] text-muted italic",
  form: "flex flex-wrap items-end gap-2 [&_label]:grid [&_label]:gap-1 [&_label]:font-label [&_label]:text-[13px] [&_label]:font-bold",
  grow: "flex-[1_1_160px] [&_:is(input,select)]:w-full",
  field,
  number: `${field} w-19`,
  sizeSelect: `${small} max-w-37.5`,
  visionSelect: small,
  share: "m-0 text-[14px] text-muted",
  copy: "flex gap-1.5",
  copyInput: `${fieldBox} min-w-0 flex-1 text-[13px]`,
  tools: "flex flex-wrap items-center gap-1.5 [&_small]:font-label [&_small]:text-[13px] [&_small]:font-medium [&_small]:text-muted",
  backgroundPreview: "block max-h-35 w-full rounded-control border border-line bg-paper object-contain",

  legend: "m-0 mt-2.5 flex max-h-[30%] flex-none list-none flex-wrap gap-x-3.5 gap-y-1.5 overflow-auto p-0 font-label text-[15px] font-medium [&_small]:text-[13px] [&_small]:text-muted",
  /** A legend entry; in a fight the one acting is bold and ringed in gilt. */
  legendItem: (defeated: boolean, active = false) => `inline-flex items-center gap-1.5${defeated ? " line-through opacity-70" : ""}${active ? " font-bold outline-2 outline-offset-2 outline-gilt" : ""}`,
  legendDot: "inline-grid h-5.5 min-w-5.5 flex-none place-items-center rounded-[11px] px-0.75 font-label text-xs font-bold text-white",

  /** Table display: the board fills the screen of the device in the middle of the table. */
  table: "fixed inset-0 z-50 overflow-auto bg-paper p-2.5 text-ink",
  tableMain: "flex h-full min-h-80 flex-col",
  tableBar: "mb-2 flex items-center gap-3 font-display text-lg font-bold [&_b]:min-w-0 [&_b]:flex-1 [&_b]:font-medium [&_b]:[overflow-wrap:anywhere]",
  /** Sized from the space left by the bar and legend (container units), not from vh, which fullscreen changes. */
  tableBoard: "grid min-h-0 flex-1 place-items-center [container-type:size]",
  tableTurn: "flex-none border-2 border-gilt px-2.5 py-0.5 font-label text-base font-bold",

  /* Fights: initiative order, turns and movement (battle-map-combat.tsx). */
  /** The squares the creature whose turn it is can still reach. */
  reach: "pointer-events-none fill-gilt [fill-opacity:.24]",
  /** A dashed gilt ring turning slowly round the creature whose turn it is. */
  activeRing: "pointer-events-none fill-none stroke-gilt stroke-5 [stroke-dasharray:9_6] [transform-box:fill-box] origin-center animate-orbit motion-reduce:animate-none",
  /** Distance shown while dragging a creature in the fight; light red when it is more than it has left. */
  dragCost: (over: boolean) => `pointer-events-none stroke-[#0b0911] stroke-5 font-label text-lg font-bold [paint-order:stroke] [text-anchor:middle] ${over ? "fill-[#ffb4a3]" : "fill-white"}`,
  combat: "grid gap-2.5",
  combatHead: "flex flex-wrap items-center gap-2 [&_h2]:flex-[1_1_140px]",
  turnBanner: "grid gap-1.5 rounded-control border border-l-4 border-line border-l-gilt bg-paper px-2.5 py-2 text-[15px]",
  turnTools: "flex flex-wrap items-center gap-1.5",
  inlineField: "inline-flex items-center gap-1 font-label text-[13px] font-bold [&_small]:font-medium [&_small]:text-muted",
  movement: (inBar = false) => `grid gap-1 font-label text-[14px] font-medium${inBar ? " flex-[1_1_180px]" : ""}`,
  over: "text-bad",
  moveBar: "block h-1.25 overflow-hidden rounded-[3px] bg-line",
  moveFill: (over: boolean) => `block h-full ${over ? "bg-[#c0392b]" : "bg-gilt"}`,
  order: "m-0 grid list-none gap-1.5 p-0",
  /** A row of the initiative order: the one acting is ringed in gilt, the defeated struck through, hidden ones dashed. */
  orderItem: ({ active, defeated, hidden }: { active: boolean; defeated: boolean; hidden: boolean }) =>
    `flex flex-wrap items-center gap-1.5 rounded-control border bg-paper px-2 py-1.5 [&_[aria-pressed=true]]:underline${active ? " border-gilt shadow-[inset_4px_0_0_var(--gilt)]" : " border-line"}`
    + `${defeated ? " [&_button[aria-pressed]]:line-through [&_button[aria-pressed]]:opacity-70" : ""}${hidden ? " border-dashed" : ""}`,
  initiative: "min-w-8 text-center font-label text-base font-bold",
  initiativeInput: `${fieldBox} min-h-8 w-13.5 px-1.5 py-1 text-[14px]`,
  setup: "grid gap-2.5",
  setupTable: "w-full border-collapse text-[14px] [&_:is(th,td)]:px-0.75 [&_:is(th,td)]:py-1 [&_:is(th,td)]:text-left [&_:is(th,td)]:align-middle [&_thead_th]:font-label [&_thead_th]:text-xs [&_thead_th]:font-bold [&_thead_th]:text-muted "
    + "[&_tbody_th]:font-bold [&_tbody_th]:[overflow-wrap:anywhere] [&_input[type=checkbox]]:size-4.5 [&_input[type=checkbox]]:accent-accent [&_input[type=number]]:w-full [&_input[type=number]]:min-w-11.5",
  /** A row left out of the fight. */
  setupOut: "[&_th]:opacity-55 [&_td:nth-child(3)]:opacity-55",

  /* The sheet of the picked token, next to the board (battle-map-sheet.tsx). */
  sheet: "gap-2!",
  sheetHead: "flex items-center gap-2 [&_h2]:min-w-0 [&_h2]:flex-1 [&_h2]:[overflow-wrap:anywhere]",
  sheetBody: "grid max-h-[min(75vh,900px)] gap-2.5 overflow-auto overscroll-contain",
  monsterSheet: "px-1 py-1.5",
  sheetLink: "grid gap-2 [&_label]:grid [&_label]:gap-1 [&_label]:font-label [&_label]:text-[13px] [&_label]:font-bold",
  heroSheet: "grid gap-2.5 text-[15px] [&_h3]:m-0 [&_h3]:font-label [&_h3]:text-xs [&_h3]:font-bold [&_h3]:tracking-[.1em] [&_h3]:text-muted [&_h3]:uppercase",
  heroSub: "m-0 font-bold [&_small]:block [&_small]:font-label [&_small]:text-[13px] [&_small]:font-medium [&_small]:text-muted",
  vitals: `${statGrid} grid-cols-[repeat(auto-fill,minmax(76px,1fr))]`,
  scores: `${statGrid} grid-cols-6 gap-1! [&_abbr]:no-underline [&_dd_small]:block [&_dd_small]:font-label [&_dd_small]:text-xs [&_dd_small]:font-medium [&_dd_small]:text-muted`,
  attacks: "m-0 grid list-none gap-1 p-0 [&_li]:rounded-control [&_li]:border [&_li]:border-line [&_li]:bg-paper [&_li]:px-2 [&_li]:py-1.25 [&_span]:font-bold [&_span]:text-accent [&_small]:block [&_small]:text-[13px] [&_small]:text-muted",
  heroLine: "m-0 text-[14px]",
  sheetDetails: "[&_summary]:flex [&_summary]:min-h-8 [&_summary]:cursor-pointer [&_summary]:items-center [&_summary]:gap-1 [&_summary]:font-label [&_summary]:text-[14px] [&_summary]:font-bold [&_summary_small]:font-medium [&_summary_small]:text-muted "
    + "[&_dl]:mt-1 [&_dl]:mb-0 [&_dl]:grid [&_dl]:gap-1.5 [&_dt]:text-[14px] [&_dt]:font-bold [&_dd]:m-0 [&_dd]:text-[13px] [&_dd]:text-muted",
  sheetFull: "font-label text-[14px] font-bold text-accent",
};
