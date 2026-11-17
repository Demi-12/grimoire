import { Injectable, signal } from "@angular/core";

/**
 * App-wide confirmation dialogs and toasts, in place of window.confirm / alert / prompt.
 *
 *   private readonly feedback = inject(FeedbackService);
 *   if (!(await this.feedback.confirm({ title: "Delete Iria?", confirmLabel: "Delete", tone: "danger" }))) return;
 *   this.feedback.toast.success("Character saved.");
 *   this.feedback.toast.error("That change couldn't be saved.");
 *
 * This service only holds the state; <app-feedback-host> (mounted once in AppComponent, so the toolkit
 * and the stand-alone battle map share it) draws the dialog and the toasts.
 */

export type ConfirmOptions = {
  title: string;
  message?: string;
  /** A value shown under the message in a read-only field, selected on focus (e.g. a link to copy by hand). */
  copyField?: { value: string; label: string };
  confirmLabel?: string;
  /** Hide the cancel button (an acknowledgement rather than a question). */
  acknowledge?: boolean;
  cancelLabel?: string;
  /** "danger" paints the confirm button red and puts focus on Cancel. */
  tone?: "default" | "danger";
};

export type ToastKind = "success" | "error" | "info";
export type Toast = { id: number; kind: ToastKind; text: string; duration: number };
export type ConfirmRequest = ConfirmOptions & { id: number; resolve: (value: boolean) => void };

export type ToastApi = {
  (text: string, options?: { kind?: ToastKind; duration?: number }): void;
  success: (text: string) => void;
  error: (text: string) => void;
  info: (text: string) => void;
};

const MAX_TOASTS = 4;
const DEFAULT_DURATION = 4500;
const ERROR_DURATION = 8000;

@Injectable({ providedIn: "root" })
export class FeedbackService {
  /** Ids for dialogs and toasts. */
  private lastId = 0;

  /** The question on screen, if any. */
  readonly request = signal<ConfirmRequest | null>(null);
  readonly toasts = signal<Toast[]>([]);

  /** Ask a yes/no question in a modal dialog; resolves true only when the person confirms. */
  readonly confirm = (options: ConfirmOptions): Promise<boolean> => new Promise<boolean>((resolve) => {
    this.request()?.resolve(false); // a newer question replaces an unanswered one
    this.request.set({ ...options, id: ++this.lastId, resolve });
  });

  /** Settle the question on screen. */
  readonly answer = (value: boolean): void => {
    this.request()?.resolve(value);
    this.request.set(null);
  };

  readonly dismiss = (id: number): void => this.toasts.update((current) => current.filter((toast) => toast.id !== id));

  readonly toast: ToastApi = Object.assign(
    (text: string, options: { kind?: ToastKind; duration?: number } = {}) => {
      const kind = options.kind ?? "info";
      const id = ++this.lastId;
      const duration = options.duration ?? (kind === "error" ? ERROR_DURATION : DEFAULT_DURATION);
      // The same message twice in a row (a double click, a retry) refreshes the toast instead of stacking a copy.
      this.toasts.update((current) => [...current.filter((item) => !(item.text === text && item.kind === kind)), { id, kind, text, duration }].slice(-MAX_TOASTS));
    },
    {
      success: (text: string) => this.toast(text, { kind: "success" }),
      error: (text: string) => this.toast(text, { kind: "error" }),
      info: (text: string) => this.toast(text, { kind: "info" }),
    },
  );
}
