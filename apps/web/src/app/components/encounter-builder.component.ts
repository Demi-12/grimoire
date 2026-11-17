import { ChangeDetectionStrategy, Component, input } from "@angular/core";
import type { Creature } from "@grimoire/shared/rules";
import type { Campaign, Character } from "../core/api-client";
/** STUB: placeholder with the final selector, class name and inputs. To be replaced by the real port of src/components/encounter-builder.tsx. */
@Component({ selector: "app-encounter-builder", changeDetection: ChangeDetectionStrategy.OnPush, host: { class: "contents" }, template: "" })
export class EncounterBuilderComponent {
  readonly partyLevels = input<number[]>();
  readonly creatures = input<Creature[]>();
  readonly characters = input<Character[]>();
  readonly campaigns = input<Campaign[]>();
}
