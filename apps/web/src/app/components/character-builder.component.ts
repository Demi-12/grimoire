import { ChangeDetectionStrategy, Component, input } from "@angular/core";
import type { Campaign, Character, CharacterDraft } from "../core/api-client";
/** STUB: placeholder with the final selector, class name and inputs. To be replaced by the real port of src/components/character-builder.tsx. */
@Component({ selector: "app-character-builder", changeDetection: ChangeDetectionStrategy.OnPush, host: { class: "contents" }, template: "" })
export class CharacterBuilderComponent {
  readonly characters = input.required<Character[]>();
  readonly campaigns = input.required<Campaign[]>();
  readonly onSave = input.required<(draft: CharacterDraft, id?: string) => Promise<void>>();
  readonly onDelete = input.required<(id: string) => Promise<void>>();
  readonly allCharacters = input<Character[]>();
  readonly selectedId = input<string | null>();
  readonly onSelect = input<(id: string | null) => void>();
  readonly startCreating = input<boolean>();
  readonly onCreatingStarted = input<() => void>();
}
