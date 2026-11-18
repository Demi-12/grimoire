import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { DmHubComponent } from "../components/dm-hub.component";
import { ToolkitStore } from "../core/toolkit.store";

/** `/dm`: the phone's "Run" tab. */
@Component({
  selector: "app-dm-page",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DmHubComponent],
  host: { class: "contents" },
  template: `<app-dm-hub [campaignCount]="store.campaigns().length" />`,
})
export class DmPage {
  protected readonly store = inject(ToolkitStore);
}
