import {
  afterRenderEffect, ChangeDetectionStrategy, Component, computed, effect, ElementRef, inject, input, OnDestroy, signal, viewChild,
} from "@angular/core";
import { FeedbackService, type ConfirmRequest, type Toast } from "../core/feedback.service";
import { I18nService } from "../core/i18n.service";

const labels = {
  en: { confirm: "Confirm", cancel: "Cancel", ok: "Got it", dismiss: "Dismiss notification", region: "Notifications" },
  es: { confirm: "Confirmar", cancel: "Cancelar", ok: "Entendido", dismiss: "Cerrar aviso", region: "Avisos" },
};

/**
 * One confirmation, as a native modal <dialog>: the browser traps focus, makes the page behind inert and
 * closes it on Escape. Created anew for each question (see FeedbackHostComponent), so opening and closing
 * are simply this component's creation and destruction.
 */
@Component({
  selector: "app-confirm-dialog",
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: "./feedback.component.css",
  host: { class: "contents" },
  template: `
    <!-- Escape fires "cancel"; the service stays in charge of closing so the promise always settles.
         A click on the backdrop lands on the <dialog> element itself. -->
    <dialog #dialog class="dialog" [attr.aria-labelledby]="titleId()" [attr.aria-describedby]="hasMessage() ? messageId() : null"
      (cancel)="$event.preventDefault(); feedback.answer(false)" (click)="$event.target === dialog && feedback.answer(false)">
      <div class="card" [class.cardDanger]="danger()">
        <span class="sigil" aria-hidden="true">{{ danger() ? "⚠" : "✦" }}</span>
        <h2 [id]="titleId()" class="title">{{ request().title }}</h2>
        @if (hasMessage()) {
          <div [id]="messageId()" class="message">
            @if (request().copyField; as field) {
              <p>{{ request().message }}</p>
              <input #copy readonly [value]="field.value" [attr.aria-label]="field.label" (focus)="copy.select()" />
            } @else {
              {{ request().message }}
            }
          </div>
        }
        <div class="actions">
          @if (!request().acknowledge) {
            <button #cancel type="button" class="button button-quiet" (click)="feedback.answer(false)">{{ request().cancelLabel ?? t().cancel }}</button>
          }
          <button #confirm type="button" class="button button-primary" [class.dangerButton]="danger()" (click)="feedback.answer(true)">
            {{ request().confirmLabel ?? (request().acknowledge ? t().ok : t().confirm) }}
          </button>
        </div>
      </div>
    </dialog>
  `,
})
export class ConfirmDialogComponent implements OnDestroy {
  protected readonly feedback = inject(FeedbackService);
  private readonly locale = inject(I18nService).locale;

  readonly request = input.required<ConfirmRequest>();

  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>("dialog");
  private readonly confirmButton = viewChild.required<ElementRef<HTMLButtonElement>>("confirm");
  private readonly cancelButton = viewChild<ElementRef<HTMLButtonElement>>("cancel");

  protected readonly t = computed(() => labels[this.locale()]);
  protected readonly danger = computed(() => this.request().tone === "danger");
  protected readonly hasMessage = computed(() => Boolean(this.request().message || this.request().copyField));
  protected readonly titleId = computed(() => `confirm-title-${this.request().id}`);
  protected readonly messageId = computed(() => `confirm-message-${this.request().id}`);

  /** What had focus before the dialog opened, to hand it back afterwards. */
  private opener: HTMLElement | null = null;
  private opened = false;

  constructor() {
    afterRenderEffect(() => {
      const dialog = this.dialog().nativeElement;
      if (this.opened) return;
      this.opened = true;
      this.opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      if (!dialog.open) dialog.showModal();
      // A destructive action never gets the default focus: Enter should not delete by accident.
      (this.danger() && !this.request().acknowledge ? this.cancelButton() : this.confirmButton())?.nativeElement.focus();
    });
  }

  ngOnDestroy(): void {
    const dialog = this.dialog().nativeElement;
    if (dialog.open) dialog.close();
    if (this.opener?.isConnected) this.opener.focus({ preventScroll: true });
  }
}

/** One toast: it leaves by itself after its duration, paused while hovered or focused. */
@Component({
  selector: "app-toast",
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: "./feedback.component.css",
  host: { class: "contents" },
  template: `
    <div class="toast" [class]="toast().kind" [attr.role]="toast().kind === 'error' ? 'alert' : null"
      (mouseenter)="paused.set(true)" (mouseleave)="paused.set(false)" (focusin)="paused.set(true)" (focusout)="paused.set(false)">
      <span class="toastIcon" aria-hidden="true">{{ icon() }}</span>
      <p class="toastText">{{ toast().text }}</p>
      <button type="button" class="toastClose" [attr.aria-label]="dismissLabel()" (click)="feedback.dismiss(toast().id)">×</button>
    </div>
  `,
})
export class ToastComponent {
  protected readonly feedback = inject(FeedbackService);

  readonly toast = input.required<Toast>();
  readonly dismissLabel = input.required<string>();

  protected readonly paused = signal(false);
  protected readonly icon = computed(() => this.toast().kind === "success" ? "✓" : this.toast().kind === "error" ? "!" : "✦");
  /** Time left on the clock; it only runs while the toast is not paused. */
  private remaining: number | null = null;

  constructor() {
    effect((onCleanup) => {
      const { id, duration } = this.toast();
      if (this.paused()) return;
      this.remaining ??= duration;
      const started = Date.now();
      const timer = window.setTimeout(() => this.feedback.dismiss(id), this.remaining);
      onCleanup(() => {
        window.clearTimeout(timer);
        this.remaining = Math.max(1200, (this.remaining ?? duration) - (Date.now() - started));
      });
    });
  }
}

/**
 * Draws what FeedbackService holds: the current confirmation dialog and the stack of toasts.
 * Mounted once, in AppComponent. Toasts sit in one polite live region; errors are announced as alerts.
 */
@Component({
  selector: "app-feedback-host",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ConfirmDialogComponent, ToastComponent],
  styleUrl: "./feedback.component.css",
  host: { class: "contents" },
  template: `
    @for (request of requests(); track request.id) { <app-confirm-dialog [request]="request" /> }
    <!-- Always rendered so screen readers register the live region before the first toast arrives. -->
    <section class="toaster" [attr.aria-label]="t().region" aria-live="polite" aria-relevant="additions">
      @for (toast of feedback.toasts(); track toast.id) { <app-toast [toast]="toast" [dismissLabel]="t().dismiss" /> }
    </section>
  `,
})
export class FeedbackHostComponent {
  protected readonly feedback = inject(FeedbackService);
  private readonly locale = inject(I18nService).locale;

  protected readonly t = computed(() => labels[this.locale()]);
  /** Zero or one request, as a list keyed by id: a new question gets a new dialog element. */
  protected readonly requests = computed(() => { const request = this.feedback.request(); return request ? [request] : []; });
}
