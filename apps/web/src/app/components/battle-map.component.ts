import { ChangeDetectionStrategy, Component, input } from "@angular/core";

/** STUB: placeholder with the final selector, class name and inputs. To be replaced by the real port of src/components/battle-map.tsx. */
@Component({ selector: "app-battle-map", changeDetection: ChangeDetectionStrategy.OnPush, host: { class: "contents" }, template: "" })
export class BattleMapComponent {
  readonly campaignId = input.required<string>();
}
