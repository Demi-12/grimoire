import { ChangeDetectionStrategy, Component, input } from "@angular/core";
import type { Campaign, Character, Me } from "../core/api-client";
/** STUB: placeholder with the final selector, class name and inputs. To be replaced by the real port of src/components/campaign-manager.tsx. */
@Component({ selector: "app-campaign-manager", changeDetection: ChangeDetectionStrategy.OnPush, host: { class: "contents" }, template: "" })
export class CampaignManagerComponent {
  readonly me = input.required<Me>();
  readonly campaigns = input.required<Campaign[]>();
  readonly characters = input.required<Character[]>();
  readonly onChanged = input.required<() => Promise<void>>();
  readonly onOpenCharacter = input.required<(id: string) => void>();
}
