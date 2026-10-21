import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { knownA11yViolations } from "./known-a11y";

const admin = { id: "u-admin", name: "Ada Admin", email: "ada@example.com", role: "admin", status: "approved", preferences: { locale: null, theme: null, legacyImported: true } };

const campaign = {
  id: "c1", name: "The Lost Mine", description: "A classic adventure", ownerId: admin.id, ownerName: admin.name,
  myRole: "dm", isOwner: true, canManage: true, members: [{ userId: admin.id, name: admin.name, role: "dm" }],
};

const character = {
  id: "ch1", ownerId: admin.id, ownerName: admin.name, campaignId: "c1", name: "Thorin Oakenshield", level: 3,
  className: "Fighter", species: "Dwarf", background: "Soldier", notes: "Carries a very long name and an even longer note to stress the layout of the card.",
  scores: { str: 16, dex: 12, con: 15, int: 10, wis: 11, cha: 8 }, editable: true,
};

const adminUsers = [{
  id: admin.id, name: admin.name, email: admin.email, role: "admin", status: "approved",
  emailVerified: true, twoFactorEnabled: false, createdAt: "2026-01-01T00:00:00Z", campaignCount: 1, characterCount: 1,
}];

/** Replaces every API call with canned data so the app runs without a database. */
async function mockApi(page: Page) {
  await page.route("**/api/**", async (route) => {
    const { pathname } = new URL(route.request().url());
    const json = (body: unknown) => route.fulfill({ json: body });
    if (pathname === "/api/auth/get-session") return json({ session: { id: "s1", userId: admin.id, token: "t", expiresAt: "2099-01-01T00:00:00Z", user: admin }, user: admin });
    if (pathname === "/api/auth/passkey/list-user-passkeys") return json([]);
    if (pathname.startsWith("/api/auth/")) return json({});
    if (pathname === "/api/me") return json({ user: admin });
    if (pathname === "/api/characters") return json({ characters: [character] });
    if (pathname === "/api/campaigns") return json({ campaigns: [campaign] });
    if (pathname === "/api/creatures") return json({ creatures: [] });
    if (/^\/api\/campaigns\/[^/]+\/invites$/.test(pathname)) return json({ invites: [] });
    if (/^\/api\/campaigns\/[^/]+\/encounters$/.test(pathname)) return json({ encounters: [] });
    if (pathname === "/api/admin/users") return json({ users: adminUsers });
    return json({});
  });
}

const routes = ["/", "/characters", "/campaigns", "/encounters", "/account", "/admin"];
const widths = [320, 360, 390, 1280];
const themes = ["light", "dark"] as const;

for (const theme of themes) {
  for (const width of widths) {
    test.describe(`${theme} theme, ${width}px`, () => {
      test.use({ viewport: { width, height: 800 }, colorScheme: theme });

      for (const route of routes) {
        test(route, async ({ page }) => {
          await mockApi(page);
          await page.addInitScript((value) => {
            localStorage.setItem("grimoire.theme.v1", value);
            localStorage.setItem("grimoire.locale.v1", "en");
          }, theme);
          await page.goto(route);
          await expect(page.locator(".workspace-header")).toBeVisible();
          await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
          await expect(page.locator(".page-content h1, .page-content h2").first()).toBeVisible();
          await page.evaluate(() => document.fonts.ready);

          // (a) No horizontal page scroll.
          const scroll = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth }));
          expect(scroll.scrollWidth, "document wider than the viewport").toBeLessThanOrEqual(scroll.clientWidth);

          // (b) Header contents stay inside the header.
          const header = await page.evaluate(() => {
            const el = document.querySelector(".workspace-header")!;
            const box = el.getBoundingClientRect();
            const escaped = [...el.children]
              .filter((child) => child.getClientRects().length)
              .map((child) => ({ name: child.className || child.tagName, right: child.getBoundingClientRect().right, left: child.getBoundingClientRect().left }))
              .filter((child) => child.right > box.right + 0.5 || child.left < box.left - 0.5);
            return { scrollWidth: el.scrollWidth, clientWidth: el.clientWidth, escaped };
          });
          expect(header.scrollWidth, "header content wider than the header").toBeLessThanOrEqual(header.clientWidth);
          expect(header.escaped, "header children outside the header").toEqual([]);

          // (c) The theme button shows an icon.
          const icon = page.locator(".theme-toggle .theme-glyph svg");
          await expect(icon).toBeVisible();
          const iconBox = await icon.boundingBox();
          expect(iconBox?.width ?? 0).toBeGreaterThan(8);
          expect(iconBox?.height ?? 0).toBeGreaterThan(8);

          // (d) No on-screen text smaller than 12px.
          const small = await page.evaluate(() => {
            const found = new Set<string>();
            const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
            for (let node = walker.nextNode(); node; node = walker.nextNode()) {
              if (!node.textContent?.trim()) continue;
              const el = node.parentElement;
              if (!el || el.closest("script,style,noscript")) continue;
              const style = getComputedStyle(el);
              if (style.display === "none" || style.visibility === "hidden" || !el.getClientRects().length) continue;
              const size = parseFloat(style.fontSize);
              if (size < 12) found.add(`${el.tagName.toLowerCase()}${el.className && typeof el.className === "string" ? "." + el.className.trim().split(/\s+/).join(".") : ""} ${size}px`);
            }
            // <select>/<input> text is not a text node of the element, so check the controls themselves.
            for (const el of document.querySelectorAll("select, input:not([type=hidden]), textarea")) {
              const size = parseFloat(getComputedStyle(el).fontSize);
              if (el.getClientRects().length && size < 12) found.add(`${el.tagName.toLowerCase()}${el.className && typeof el.className === "string" ? "." + el.className.trim().split(/\s+/).join(".") : ""} ${size}px`);
            }
            return [...found];
          });
          expect(small, "text under 12px").toEqual([]);

          // (e) Accessibility: color contrast and landmarks (minus documented known issues).
          const results = await new AxeBuilder({ page }).withRules(["color-contrast", "region", "landmark-one-main", "landmark-no-duplicate-main", "landmark-unique", "landmark-complementary-is-top-level", "landmark-banner-is-top-level", "landmark-contentinfo-is-top-level", "landmark-main-is-top-level", "landmark-no-duplicate-banner", "landmark-no-duplicate-contentinfo"]).analyze();
          const found = results.violations.flatMap((violation) => violation.nodes.map((node) => `${violation.id} ${node.target.join(" ")}`));
          const fresh = found.filter((entry) => !knownA11yViolations.some((known) => known.test(entry)));
          expect(fresh, "new accessibility violations").toEqual([]);
        });
      }
    });
  }
}
