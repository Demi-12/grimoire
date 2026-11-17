import { ChangeDetectionStrategy, Component, input } from "@angular/core";
import type { Me } from "../core/api-client";
/** STUB: placeholder with the final selector, class name and inputs. To be replaced by the real port of src/components/admin-users.tsx. */
@Component({ selector: "app-admin-users", changeDetection: ChangeDetectionStrategy.OnPush, host: { class: "contents" }, template: "" })
export class AdminUsersComponent {
  readonly me = input.required<Me>();
  readonly onPendingCount = input<(count: number) => void>();
}
