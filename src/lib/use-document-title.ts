"use client";

import { useEffect } from "react";

/**
 * Keeps the tab title on `title` for client-rendered views. Next re-applies the static metadata title
 * whenever a navigation settles, so a one-off `document.title =` gets overwritten; this puts ours back.
 */
export function useDocumentTitle(title: string | null) {
  useEffect(() => {
    if (!title) return;
    const apply = () => { if (document.title !== title) document.title = title; };
    apply();
    const observer = new MutationObserver(apply);
    observer.observe(document.head, { subtree: true, childList: true, characterData: true });
    return () => observer.disconnect();
  }, [title]);
}
