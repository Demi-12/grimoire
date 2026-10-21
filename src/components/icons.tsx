/**
 * Navigation icons as inline SVG. Unicode symbols (⌂ ♙ ⚿ …) depend on the system fonts and some
 * phones draw them as boxes or colour emoji; these follow `currentColor` and size to the font (1em).
 */
const paths = {
  home: <><path d="M3 10.5 12 3l9 7.5" /><path d="M5.5 9v11h5v-6h3v6h5V9" /></>,
  characters: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
  campaigns: <><path d="M5 21V3.5" /><path d="M5 4h12l-2.5 4.5L17 13H5" /></>,
  encounters: <><path d="M14.5 17.5 3 6V3h3l11.5 11.5M13 19l6-6M16 16l4 4M19 21l2-2" /><path d="M14.5 6.5 18 3h3v3l-3.5 3.5M5 14l4 4M7 17l-3 3M3 19l2 2" /></>,
  account: <><circle cx="8" cy="15" r="4.5" /><path d="M11.2 11.8 20 3M16.5 6.5l3 3M18.5 4.5l2 2" /></>,
  admin: <path d="M3 8l4.5 4.5L12 5l4.5 7.5L21 8l-2 11H5z" />,
};

export type IconName = keyof typeof paths;

export function Icon({ name }: { name: IconName }) {
  return <svg className="icon" viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{paths[name]}</svg>;
}
