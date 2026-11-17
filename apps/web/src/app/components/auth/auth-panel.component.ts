import { ChangeDetectionStrategy, Component, input } from "@angular/core";
export type AuthMode = "sign-in" | "sign-up";
/** STUB: placeholder with the final selector, class name and inputs. To be replaced by the real port of src/components/auth/auth-panel.tsx. */
@Component({ selector: "app-auth-panel", changeDetection: ChangeDetectionStrategy.OnPush, host: { class: "contents" }, template: "" })
export class AuthPanelComponent {
  readonly initialMode = input<AuthMode>("sign-in");
}
