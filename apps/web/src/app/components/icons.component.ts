import { ChangeDetectionStrategy, Component, input } from "@angular/core";

/**
 * Navigation icons as inline SVG. Unicode symbols (⌂ ♙ ⚿ …) depend on the system fonts and some
 * phones draw them as boxes or colour emoji; these follow `currentColor` and size to the font (1em).
 *
 *   <svg appIcon="home"></svg>
 */
export type IconName =
  | "home" | "characters" | "campaigns" | "encounters" | "account" | "admin" | "users" | "analytics"
  | "map" | "bestiary" | "dm" | "plus" | "chevron" | "link";

@Component({
  selector: "svg[appIcon]",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: "icon",
    viewBox: "0 0 24 24",
    width: "1em",
    height: "1em",
    fill: "none",
    stroke: "currentColor",
    "stroke-width": "1.8",
    "stroke-linecap": "round",
    "stroke-linejoin": "round",
    "aria-hidden": "true",
    focusable: "false",
  },
  template: `
    @switch (name()) {
      @case ("home") { <svg:path d="M3 10.5 12 3l9 7.5" /><svg:path d="M5.5 9v11h5v-6h3v6h5V9" /> }
      @case ("characters") { <svg:circle cx="12" cy="8" r="4" /><svg:path d="M4 21a8 8 0 0 1 16 0" /> }
      @case ("campaigns") { <svg:path d="M5 21V3.5" /><svg:path d="M5 4h12l-2.5 4.5L17 13H5" /> }
      @case ("encounters") { <svg:path d="M14.5 17.5 3 6V3h3l11.5 11.5M13 19l6-6M16 16l4 4M19 21l2-2" /><svg:path d="M14.5 6.5 18 3h3v3l-3.5 3.5M5 14l4 4M7 17l-3 3M3 19l2 2" /> }
      @case ("account") { <svg:circle cx="8" cy="15" r="4.5" /><svg:path d="M11.2 11.8 20 3M16.5 6.5l3 3M18.5 4.5l2 2" /> }
      @case ("admin") { <svg:path d="M3 8l4.5 4.5L12 5l4.5 7.5L21 8l-2 11H5z" /> }
      @case ("users") { <svg:circle cx="9" cy="8" r="3.5" /><svg:path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><svg:path d="M15.5 4.6a3.5 3.5 0 0 1 0 6.8M18 14.2a6.5 6.5 0 0 1 3.5 5.8" /> }
      @case ("analytics") { <svg:path d="M4 20V4" /><svg:path d="M4 20h16" /><svg:path d="M8 16v-4M12 16V8M16 16v-6M20 16v-9" /> }
      @case ("map") { <svg:path d="M3 6.5 9 4l6 2.5L21 4v13.5L15 20l-6-2.5L3 20z" /><svg:path d="M9 4v13.5M15 6.5V20" /> }
      @case ("bestiary") { <svg:path d="M12 6.5C10 5 7 4.5 3.5 5v13.5c3.5-.5 6.5 0 8.5 1.5 2-1.5 5-2 8.5-1.5V5C17 4.5 14 5 12 6.5z" /><svg:path d="M12 6.5V20" /> }
      @case ("dm") { <svg:path d="M12 2.5 20.5 7.5v9L12 21.5 3.5 16.5v-9z" /><svg:path d="M12 2.5 7 15h10zM3.5 7.5 7 15M20.5 7.5 17 15M7 15l5 6.5 5-6.5" /> }
      @case ("plus") { <svg:path d="M12 5v14M5 12h14" /> }
      @case ("chevron") { <svg:path d="m9 6 6 6-6 6" /> }
      @case ("link") { <svg:path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /> }
    }
  `,
})
export class IconComponent {
  /** Which icon to draw. */
  readonly name = input.required<IconName>({ alias: "appIcon" });
}
