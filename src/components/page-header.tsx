import type { ReactNode } from "react";

/** Shared with the loading skeleton, so the placeholder header has the real one's size and rule. */
export const pageHeaderClass = "relative mb-7 flex flex-wrap items-end justify-between gap-x-5 gap-y-3 pb-4 after:absolute after:inset-x-0 after:bottom-0 after:h-1 after:bg-accent after:[clip-path:polygon(0_0,100%_50%,0_100%)]";
export const pageTitleClass = "m-0 font-display text-[clamp(30px,4vw,42px)] leading-[1.08] font-medium text-ink";
export const pageDescriptionClass = "mt-2 mb-0 text-base leading-normal text-muted";

/**
 * The one page header every section uses: an optional small-caps kicker, the page's <h1>, a line of description and,
 * on the right, the page's actions. The tapered violet rule underneath marks where the page itself starts.
 */
export function PageHeader({ kicker, title, description, actions, titleId, hidden = false }: {
  kicker?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  titleId?: string;
  /** Keep the header for screen readers only (e.g. while a character sheet, with its own heading, is open). */
  hidden?: boolean;
}) {
  return <header className={hidden ? "sr-only" : pageHeaderClass}>
    <div className="min-w-0 max-w-[68ch]">
      {kicker && <p className="eyebrow">{kicker}</p>}
      <h1 id={titleId} className={pageTitleClass}>{title}</h1>
      {description && <p className={pageDescriptionClass}>{description}</p>}
    </div>
    {actions && <div className="flex flex-wrap gap-2 max-[650px]:w-full">{actions}</div>}
  </header>;
}
