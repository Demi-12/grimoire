import { ChangeDetectionStrategy, Component, input } from "@angular/core";
import { BattleMapComponent } from "../components/battle-map.component";

/**
 * `/map/<id>`: a campaign's live battle map. It has its own page (outside the toolkit shell) so it can fill
 * the screen of a tablet or TV in the middle of the table, and each player can open the same link on their phone.
 */
@Component({
  selector: "app-battle-map-page",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BattleMapComponent],
  host: { class: "contents" },
  template: `<app-battle-map [campaignId]="id()" />`,
})
export class BattleMapPage {
  /** The campaign id, from the route. */
  readonly id = input.required<string>();
}
