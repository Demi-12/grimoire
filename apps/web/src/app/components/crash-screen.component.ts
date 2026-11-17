import { ChangeDetectionStrategy, Component, computed, inject, input } from "@angular/core";
import { I18nService } from "../core/i18n.service";

const copy = {
  en: { title: "Something went wrong", body: "The error has been logged for the site admin. Try again, or reload the page.", retry: "Try again", reload: "Reload" },
  es: { title: "Algo ha fallado", body: "El error ha quedado registrado para el admin del sitio. Vuelve a intentarlo o recarga la página.", retry: "Reintentar", reload: "Recargar" },
};

/**
 * Shown by AppComponent in place of the whole app when rendering broke (see core/crash.service.ts, which
 * also reports the error). `reset` is called by "Try again".
 */
@Component({
  selector: "app-crash-screen",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: "contents" },
  template: `
    <main class="gate-main" id="main">
      <section class="gate-card" role="alert">
        <h1>{{ t().title }}</h1>
        <p>{{ t().body }}</p>
        <div class="gate-actions">
          <button type="button" class="button button-primary" (click)="reset()()">{{ t().retry }}</button>
          <button type="button" class="button button-quiet" (click)="reload()">{{ t().reload }}</button>
        </div>
      </section>
    </main>
  `,
})
export class CrashScreenComponent {
  private readonly locale = inject(I18nService).locale;

  readonly reset = input.required<() => void>();
  protected readonly t = computed(() => copy[this.locale()]);

  protected reload(): void { window.location.reload(); }
}
