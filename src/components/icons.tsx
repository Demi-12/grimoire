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
  users: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><path d="M15.5 4.6a3.5 3.5 0 0 1 0 6.8M18 14.2a6.5 6.5 0 0 1 3.5 5.8" /></>,
  analytics: <><path d="M4 20V4" /><path d="M4 20h16" /><path d="M8 16v-4M12 16V8M16 16v-6M20 16v-9" /></>,
  map: <><path d="M3 6.5 9 4l6 2.5L21 4v13.5L15 20l-6-2.5L3 20z" /><path d="M9 4v13.5M15 6.5V20" /></>,
  bestiary: <><path d="M12 6.5C10 5 7 4.5 3.5 5v13.5c3.5-.5 6.5 0 8.5 1.5 2-1.5 5-2 8.5-1.5V5C17 4.5 14 5 12 6.5z" /><path d="M12 6.5V20" /></>,
  /** A d20, for the "Run the game" group. */
  dm: <><path d="M12 2.5 20.5 7.5v9L12 21.5 3.5 16.5v-9z" /><path d="M12 2.5 7 15h10zM3.5 7.5 7 15M20.5 7.5 17 15M7 15l5 6.5 5-6.5" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  chevron: <path d="m9 6 6 6-6 6" />,
  link: <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />,
};

export type IconName = keyof typeof paths;

export function Icon({ name }: { name: IconName }) {
  return <svg className="icon" viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{paths[name]}</svg>;
}
