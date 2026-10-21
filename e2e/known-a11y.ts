/**
 * Accessibility violations that already existed when the checks were added. Each entry is matched against
 * "<axe rule id> <css selector>"; anything not matching fails the test, so only NEW violations break the build.
 * Fix one in the app, then delete its line here.
 */
export const knownA11yViolations: RegExp[] = [
  // The workspace <header>/<footer> sit inside a <section>, so they are not banner/contentinfo landmarks and
  // the brand, breadcrumb, edition badge, header selects and the footer text are "content outside landmarks" (moderate impact).
  /^region (\.mobile-brand|\.breadcrumb|\.edition-badge|\.header-select|label|footer|\.app-footer)$/,
  // The encounter-journal kicker text is too faint on the dark theme (serious impact).
  /^color-contrast \.\w+_kicker$/,
];
