import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { RouterOutlet } from "@angular/router";
import { CrashScreenComponent } from "./components/crash-screen.component";
import { FeedbackHostComponent } from "./components/feedback.component";
import { CrashService } from "./core/crash.service";

/** The root: the routed page, the app-wide dialog and toasts, and the crash screen when rendering broke. */
@Component({
  selector: "app-root",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, CrashScreenComponent, FeedbackHostComponent],
  host: { class: "contents" },
  template: `
    @if (crash.crashed()) {
      <div class="gate-shell text-ink"><app-crash-screen [reset]="crash.reset" /></div>
    } @else {
      <router-outlet />
    }
    <app-feedback-host />
  `,
})
export class AppComponent {
  protected readonly crash = inject(CrashService);
}
