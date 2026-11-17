import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { Router } from "@angular/router";
import { CampaignManagerComponent } from "../components/campaign-manager.component";
import { ToolkitStore } from "../core/toolkit.store";

/** `/campaigns`: the person's campaigns, their members, invitations and encounter journal. */
@Component({
  selector: "app-campaigns-page",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CampaignManagerComponent],
  host: { class: "contents" },
  template: `<app-campaign-manager [me]="store.me()!" [campaigns]="store.campaigns()" [characters]="store.characters()" [onChanged]="store.reloadData" [onOpenCharacter]="openCharacter" />`,
})
export class CampaignsPage {
  protected readonly store = inject(ToolkitStore);
  private readonly router = inject(Router);

  protected readonly openCharacter = (id: string): void => {
    void this.router.navigateByUrl(`/characters/${encodeURIComponent(id)}`);
  };
}
