import { ChangeDetectionStrategy, Component, computed, inject } from "@angular/core";
import { HomeDashboardComponent } from "../components/home-dashboard.component";
import { SpinnerComponent } from "../components/skeleton.component";
import { I18nService } from "../core/i18n.service";
import { ToolkitStore } from "../core/toolkit.store";

/** `/`: the overview, with the one-time offer to import what an old version saved in this browser. */
@Component({
  selector: "app-home-page",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [HomeDashboardComponent, SpinnerComponent],
  host: { class: "contents" },
  template: `
    @if (store.localImport(); as local) {
      <div class="import-banner" role="status">
        <span aria-hidden="true">✦</span>
        <p><b>{{ t("import.title") }}</b> {{ t("import.description", { characters: local.characters.length, campaigns: local.campaigns.length, creatures: local.creatures.length }) }}</p>
        <div>
          <button class="button button-primary" [disabled]="store.importBusy()" (click)="store.runImport()">
            @if (store.importBusy()) { <span appSpinner></span> }{{ t(store.importBusy() ? "common.saving" : "import.action") }}
          </button>
          <button class="button button-quiet" [disabled]="store.importBusy()" (click)="store.finishImport()">{{ t("import.dismiss") }}</button>
        </div>
      </div>
    }
    <app-home-dashboard [characters]="store.ownCharacters()" [campaigns]="store.memberCampaigns()" [mapShortcut]="mapShortcut()" />
  `,
})
export class HomePage {
  protected readonly store = inject(ToolkitStore);
  protected readonly t = inject(I18nService).t;

  /** The table whose map was opened last, or the picker when the person sits at none. */
  protected readonly mapShortcut = computed(() => {
    const first = this.store.tables()[0];
    return first ? { href: `/map/${encodeURIComponent(first.id)}`, campaignName: first.name } : { href: "/map" };
  });
}
