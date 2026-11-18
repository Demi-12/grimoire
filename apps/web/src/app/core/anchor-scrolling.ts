import { inject } from "@angular/core";
import { Router, Scroll } from "@angular/router";
import { filter } from "rxjs";

/**
 * `#fragment` links (`/campaigns#campaign-name`) scroll their target into view, unless its top is already on
 * screen. Only scroll: Angular's own anchor scrolling also focuses the target, and a focused text field opens
 * the keyboard on a phone. Called once, from an app initializer (see app.config.ts).
 *
 * The router emits `Scroll` once the new page has painted, right after its own scroll restoration has put the
 * page at the top, so the target is in the DOM and this runs last.
 */
export function scrollToAnchors(): void {
  inject(Router).events.pipe(filter((event): event is Scroll => event instanceof Scroll && event.anchor !== null && event.position === null)).subscribe((event) => {
    const target = document.getElementById(event.anchor ?? "");
    if (!target) return;
    const top = target.getBoundingClientRect().top;
    if (top < 0 || top > window.innerHeight) target.scrollIntoView();
  });
}
