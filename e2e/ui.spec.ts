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
  // Made with the step-by-step creator, so the full sheet has every section to lay out.
  build: {
    version: 1, classId: "fighter", useSubclass: true, backgroundId: "soldier", speciesId: "human",
    abilityMethod: "standard", baseScores: { str: 15, dex: 14, con: 13, int: 10, wis: 12, cha: 8 },
    bonusMode: "plus2plus1", bonusAbilities: ["str", "con"], classSkills: ["perception", "survival"],
    speciesSkills: ["insight"], speciesFeat: "alert", featSkills: [], expertise: [], languages: [1, 4],
    classEquipment: "A", backgroundEquipment: "A", alignment: 0, appearance: "A scarred veteran of the mines.",
  },
};

const adminUsers = [{
  id: admin.id, name: admin.name, email: admin.email, role: "admin", status: "approved",
  emailVerified: true, twoFactorEnabled: false, createdAt: "2026-01-01T00:00:00Z", campaignCount: 1, characterCount: 1,
}];

/** A month of made-up usage with a couple of grouped errors, for the analytics dashboard. */
const analyticsDays = Array.from({ length: 30 }, (_, index) => {
  const date = new Date(Date.UTC(2026, 9, 15 + index)).toISOString().slice(0, 10);
  return { date, activeUsers: [2, 3, 5, 4, 6, 8, 3][index % 7], characters: index % 4 === 0 ? 2 : index % 3 === 0 ? 1 : 0, encounters: [0, 3, 6, 1, 4, 9, 2][index % 7], campaigns: index % 9 === 0 ? 1 : 0, errors: index % 6 === 0 ? 3 : index === 28 ? 7 : 0 };
});
const analyticsReport = {
  range: { days: 30, timeZone: "UTC", from: analyticsDays[0].date, to: analyticsDays[29].date, generatedAt: "2026-11-13T18:00:00Z" },
  kpis: {
    activeUsers: { current: 9, previous: 7 }, activeToday: 3, approvedUsers: 12, newUsers: { current: 2, previous: 1 },
    charactersCreated: { current: 23, previous: 25, creator: 19, manual: 4 },
    encountersGenerated: { current: 112, previous: 80 }, encountersSaved: { current: 14, previous: 9 },
    campaignsCreated: { current: 4, previous: 4 }, campaignsJoined: { current: 7, previous: 2 },
    errors: { current: 22, previous: 30, users: 3, server: 15, client: 7 }, wizard: { started: 31, completed: 19 },
  },
  daily: analyticsDays,
  sections: [
    { section: "encounters", views: 240, users: 8 }, { section: "characters", views: 190, users: 9 }, { section: "character-sheet", views: 133, users: 7 },
    { section: "campaigns", views: 96, users: 6 }, { section: "map", views: 51, users: 5 }, { section: "home", views: 44, users: 9 }, { section: "account", views: 6, users: 3 },
  ],
  errors: [
    { fingerprint: "f1", source: "server", name: "error", message: "duplicate key value violates unique constraint \"campaign_member_pkey\" for a very long constraint name that has to wrap", route: "/api/campaigns/[id]/members", method: "POST", count: 15, users: 2, firstSeen: "2026-10-20T10:00:00Z", lastSeen: "2026-11-13T17:40:00Z", stack: "error: duplicate key value violates unique constraint\n    at Parser.parseErrorMessage (node_modules/pg-protocol/dist/parser.js:283:98)\n    at addCampaignMemberByQuery (src/lib/data.ts:260:5)", digest: "3201749273", userAgent: "Chrome 131 · Android" },
    { fingerprint: "f2", source: "client", name: "TypeError", message: "Cannot read properties of undefined (reading 'hitPoints')", route: "/characters/:id", method: null, count: 7, users: 1, firstSeen: "2026-11-02T10:00:00Z", lastSeen: "2026-11-11T09:00:00Z", stack: null, digest: null, userAgent: "Safari 18 · iOS" },
  ],
};

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
    if (pathname === "/api/admin/analytics") return json({ report: analyticsReport });
    return json({});
  });
}

const routes = ["/", "/characters", "/characters/ch1", "/campaigns", "/encounters", "/account", "/admin", "/admin/analytics"];
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

          if (route === "/characters/ch1") {
            // The sheet itself opened (not just the list), with derived stats, and the card list is hidden behind it.
            await expect(page.getByRole("heading", { name: "Thorin Oakenshield", level: 2 })).toBeVisible();
            await expect(page.getByRole("heading", { name: "Saving throws" })).toBeVisible();
            await expect(page.getByRole("heading", { name: "Skills" })).toBeVisible();
            await expect(page.getByRole("heading", { name: "Attacks" })).toBeVisible();
            await expect(page.locator(".character-grid")).toBeHidden();
          }

          if (route === "/admin/analytics") {
            // The dashboard rendered its figures, both charts and the grouped error log.
            await expect(page.getByRole("heading", { name: "Analytics", level: 1 })).toBeVisible();
            await expect(page.getByRole("link", { name: "Analytics" })).toHaveAttribute("aria-current", "page");
            await expect(page.getByRole("heading", { name: "Active accounts", level: 3 })).toBeVisible();
            await expect(page.getByRole("group", { name: "Active accounts per day" }).locator("svg")).toBeVisible();
            await expect(page.getByRole("group", { name: "Errors per day" }).locator("svg")).toBeVisible();
            await expect(page.getByText("Cannot read properties of undefined (reading 'hitPoints')")).toBeVisible();
          }

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
