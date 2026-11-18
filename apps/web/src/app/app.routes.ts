import { UrlSegment, type Routes, type UrlMatchResult } from "@angular/router";
import { AccountPage } from "./pages/account.page";
import { AdminPage } from "./pages/admin.page";
import { BattleMapPage } from "./pages/battle-map.page";
import { BestiaryPage } from "./pages/bestiary.page";
import { CampaignsPage } from "./pages/campaigns.page";
import { CharactersPage } from "./pages/characters.page";
import { DmPage } from "./pages/dm.page";
import { EncountersPage } from "./pages/encounters.page";
import { HomePage } from "./pages/home.page";
import { MapPage } from "./pages/map.page";
import { ShellComponent } from "./shell/shell.component";

/**
 * Matches `<base>` and `<base>/<one more segment>` as a single route, handing the extra segment to the page
 * as `param`. Angular keeps a page alive while the same route stays active, so `/characters`, `/characters/new`
 * and `/characters/<id>` share one page (and what it has open), as do the two admin tabs.
 */
function withOptionalSegment(base: string, param: string) {
  return (segments: UrlSegment[]): UrlMatchResult | null => {
    if (segments[0]?.path !== base || segments.length > 2) return null;
    return { consumed: segments, posParams: segments[1] ? { [param]: segments[1] } : {} };
  };
}

/**
 * Every address of the app. The live battle map is a page of its own; everything else is drawn inside the
 * shell (sidebar, header, sign-in gate). Adding a section: a page in pages/, a line here, and its entry in
 * `View`/`viewPaths` of shell.component.ts (see CLAUDE.md).
 */
export const routes: Routes = [
  { path: "map/:id", component: BattleMapPage },
  {
    path: "",
    component: ShellComponent,
    children: [
      { path: "", pathMatch: "full", component: HomePage },
      { matcher: withOptionalSegment("characters", "id"), component: CharactersPage },
      { path: "map", component: MapPage },
      { path: "dm", component: DmPage },
      { path: "campaigns", component: CampaignsPage },
      { path: "encounters", component: EncountersPage },
      { path: "bestiary", component: BestiaryPage },
      { path: "account", component: AccountPage },
      { matcher: withOptionalSegment("admin", "tab"), component: AdminPage },
      // Unknown addresses show the overview, as before.
      { path: "**", component: HomePage },
    ],
  },
];
