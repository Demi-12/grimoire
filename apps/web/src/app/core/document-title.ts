import { effect } from "@angular/core";

/**
 * Keeps the browser tab's title on whatever `title()` returns (a signal-reading function), for as long as
 * the calling component or service lives. Call it from a constructor or field initializer.
 */
export function useDocumentTitle(title: () => string | null): void {
  effect(() => {
    const value = title();
    if (value && document.title !== value) document.title = value;
  });
}
