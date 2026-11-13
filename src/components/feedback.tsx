"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import styles from "./feedback.module.css";

/**
 * App-wide confirmation dialogs and toasts, in place of window.confirm / alert / prompt.
 *
 *   const confirm = useConfirm();
 *   if (!(await confirm({ title: "Delete Iria?", confirmLabel: "Delete", tone: "danger" }))) return;
 *
 *   const toast = useToast();
 *   toast.success("Character saved.");
 *   toast.error("That change couldn't be saved.");
 *
 * The provider lives in the root layout, so the toolkit and the stand-alone battle map share it.
 * Dialogs use a native modal <dialog>: the browser traps focus, makes the page behind inert and
 * closes it on Escape. Toasts sit in one polite live region; errors are announced as alerts.
 */

export type ConfirmOptions = {
  title: string;
  message?: ReactNode;
  confirmLabel?: string;
  /** Hide the cancel button (an acknowledgement rather than a question). */
  acknowledge?: boolean;
  cancelLabel?: string;
  /** "danger" paints the confirm button red and puts focus on Cancel. */
  tone?: "default" | "danger";
};

export type ToastKind = "success" | "error" | "info";
type Toast = { id: number; kind: ToastKind; text: string; duration: number };
type ToastApi = {
  (text: string, options?: { kind?: ToastKind; duration?: number }): void;
  success: (text: string) => void;
  error: (text: string) => void;
  info: (text: string) => void;
};
type Request = ConfirmOptions & { id: number; resolve: (value: boolean) => void };

const FeedbackContext = createContext<{ confirm: (options: ConfirmOptions) => Promise<boolean>; toast: ToastApi } | null>(null);

const labels = {
  en: { confirm: "Confirm", cancel: "Cancel", ok: "Got it", dismiss: "Dismiss notification", region: "Notifications" },
  es: { confirm: "Confirmar", cancel: "Cancelar", ok: "Entendido", dismiss: "Cerrar aviso", region: "Avisos" },
};
/** The toolkit keeps <html lang> in sync with the chosen language (the battle map reads it the same way). */
const currentLabels = () => labels[typeof document !== "undefined" && document.documentElement.lang.startsWith("es") ? "es" : "en"];

const MAX_TOASTS = 4;
/** Ids for dialogs and toasts; they only exist on the client, after an action, so a module counter is enough. */
let lastId = 0;
const DEFAULT_DURATION = 4500;
const ERROR_DURATION = 8000;

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<Request | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const confirm = useCallback((options: ConfirmOptions) => new Promise<boolean>((resolve) => {
    setRequest((previous) => {
      previous?.resolve(false); // a newer question replaces an unanswered one
      return { ...options, id: ++lastId, resolve };
    });
  }), []);

  const answer = useCallback((value: boolean) => {
    setRequest((current) => {
      current?.resolve(value);
      return null;
    });
  }, []);

  const dismiss = useCallback((id: number) => setToasts((current) => current.filter((toast) => toast.id !== id)), []);

  const toast = useMemo(() => {
    const push = (text: string, options: { kind?: ToastKind; duration?: number } = {}) => {
      const kind = options.kind ?? "info";
      const id = ++lastId;
      const duration = options.duration ?? (kind === "error" ? ERROR_DURATION : DEFAULT_DURATION);
      // The same message twice in a row (a double click, a retry) refreshes the toast instead of stacking a copy.
      setToasts((current) => [...current.filter((item) => !(item.text === text && item.kind === kind)), { id, kind, text, duration }].slice(-MAX_TOASTS));
    };
    return Object.assign(push, {
      success: (text: string) => push(text, { kind: "success" }),
      error: (text: string) => push(text, { kind: "error" }),
      info: (text: string) => push(text, { kind: "info" }),
    });
  }, []);

  const value = useMemo(() => ({ confirm, toast }), [confirm, toast]);

  return <FeedbackContext.Provider value={value}>
    {children}
    {request && <ConfirmDialog key={request.id} request={request} onAnswer={answer} />}
    <Toaster toasts={toasts} onDismiss={dismiss} />
  </FeedbackContext.Provider>;
}

function useFeedback() {
  const context = useContext(FeedbackContext);
  if (!context) throw new Error("useConfirm/useToast need <FeedbackProvider> (mounted in the root layout).");
  return context;
}

/** Ask a yes/no question in a modal dialog; resolves true only when the person confirms. */
export function useConfirm() {
  return useFeedback().confirm;
}

export function useToast() {
  return useFeedback().toast;
}

function ConfirmDialog({ request, onAnswer }: { request: Request; onAnswer: (value: boolean) => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const t = currentLabels();
  const danger = request.tone === "danger";

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (!dialog.open) dialog.showModal();
    // A destructive action never gets the default focus: Enter should not delete by accident.
    (danger && !request.acknowledge ? cancelRef.current : confirmRef.current)?.focus();
    return () => {
      if (dialog.open) dialog.close();
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, [danger, request.acknowledge]);

  const titleId = `confirm-title-${request.id}`;
  const messageId = `confirm-message-${request.id}`;

  return <dialog ref={dialogRef} className={styles.dialog} aria-labelledby={titleId} aria-describedby={request.message ? messageId : undefined}
    // Escape fires "cancel"; keep React in charge of closing so the promise always settles.
    onCancel={(event) => { event.preventDefault(); onAnswer(false); }}
    // A click on the backdrop lands on the <dialog> element itself.
    onClick={(event) => { if (event.target === event.currentTarget) onAnswer(false); }}>
    <div className={`${styles.card} ${danger ? styles.cardDanger : ""}`}>
      <span className={styles.sigil} aria-hidden="true">{danger ? "⚠" : "✦"}</span>
      <h2 id={titleId} className={styles.title}>{request.title}</h2>
      {request.message && <div id={messageId} className={styles.message}>{request.message}</div>}
      <div className={styles.actions}>
        {!request.acknowledge && <button ref={cancelRef} type="button" className="button button-quiet" onClick={() => onAnswer(false)}>{request.cancelLabel ?? t.cancel}</button>}
        <button ref={confirmRef} type="button" className={`button button-primary ${danger ? styles.dangerButton : ""}`} onClick={() => onAnswer(true)}>
          {request.confirmLabel ?? (request.acknowledge ? t.ok : t.confirm)}
        </button>
      </div>
    </div>
  </dialog>;
}

function Toaster({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: number) => void }) {
  const [t, setT] = useState(labels.en);
  useEffect(() => { setT(currentLabels()); }, [toasts]);
  // Always rendered so screen readers register the live region before the first toast arrives.
  return <section className={styles.toaster} aria-label={t.region} aria-live="polite" aria-relevant="additions">
    {toasts.map((toast) => <ToastItem key={toast.id} toast={toast} dismissLabel={t.dismiss} onDismiss={onDismiss} />)}
  </section>;
}

function ToastItem({ toast, dismissLabel, onDismiss }: { toast: Toast; dismissLabel: string; onDismiss: (id: number) => void }) {
  const [paused, setPaused] = useState(false);
  const remaining = useRef(toast.duration);

  useEffect(() => {
    if (paused) return;
    const started = Date.now();
    const timer = window.setTimeout(() => onDismiss(toast.id), remaining.current);
    return () => {
      window.clearTimeout(timer);
      remaining.current = Math.max(1200, remaining.current - (Date.now() - started));
    };
  }, [paused, toast.id, onDismiss]);

  const icon = toast.kind === "success" ? "✓" : toast.kind === "error" ? "!" : "✦";
  return <div className={`${styles.toast} ${styles[toast.kind]}`} role={toast.kind === "error" ? "alert" : undefined}
    onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}
    onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}>
    <span className={styles.toastIcon} aria-hidden="true">{icon}</span>
    <p className={styles.toastText}>{toast.text}</p>
    <button type="button" className={styles.toastClose} aria-label={dismissLabel} onClick={() => onDismiss(toast.id)}>×</button>
  </div>;
}
