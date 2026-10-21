/**
 * Accessibility violations that already existed when the checks were added. Each entry is matched against
 * "<axe rule id> <css selector>"; anything not matching fails the test, so only NEW violations break the build.
 * Fix one in the app, then delete its line here.
 */
export const knownA11yViolations: RegExp[] = [];
