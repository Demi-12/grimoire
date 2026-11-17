import { ChangeDetectionStrategy, Component, input } from "@angular/core";
import type { Campaign, CatalogCreature, Me } from "../core/api-client";

export type HomebrewProps = { me: Me; campaigns: Campaign[]; onAddCreature: (creature: Omit<CatalogCreature, "id">) => void };
/** STUB: placeholder with the final selector, class name and inputs. To be replaced by the real port of src/components/bestiary-browser.tsx. */
@Component({ selector: "app-bestiary-browser", changeDetection: ChangeDetectionStrategy.OnPush, host: { class: "contents" }, template: "" })
export class BestiaryBrowserComponent {
  readonly onAddCreature = input.required<(creature: Omit<CatalogCreature, "id">) => void>();
  readonly homebrew = input<HomebrewProps>();
}
