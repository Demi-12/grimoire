import { ChangeDetectionStrategy, Component, input } from "@angular/core";

/** STUB: placeholder with the final selector, class name and inputs. To be replaced by the real port of src/components/data-backup.tsx. */
@Component({ selector: "app-data-backup", changeDetection: ChangeDetectionStrategy.OnPush, host: { class: "contents" }, template: "" })
export class DataBackupComponent {
  readonly onRestored = input<() => void | Promise<void>>();
}
