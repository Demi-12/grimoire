import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { MapPickerComponent } from "../components/map-picker.component";
import { ToolkitStore } from "../core/toolkit.store";

/** `/map`: pick which table's battle map to open (the shell skips this page when there is only one). */
@Component({
  selector: "app-map-page",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MapPickerComponent],
  host: { class: "contents" },
  template: `<app-map-picker [campaigns]="store.tables()" [characters]="store.ownCharacters()" />`,
})
export class MapPage {
  protected readonly store = inject(ToolkitStore);
}
