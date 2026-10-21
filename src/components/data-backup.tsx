"use client";

import { useRef, useState } from "react";
import { api, ApiError } from "@/lib/api-client";
import { backupFilename, MAX_BACKUP_BYTES, parseBackup, type BackupError, type ParsedBackup } from "@/lib/backup";
import { translate, type Locale } from "@/lib/i18n";
import { Spinner } from "./skeleton";
import styles from "./data-backup.module.css";

type Status = { kind: "info" | "error"; text: string } | null;
type Pending = { fileName: string; raw: unknown; backup: ParsedBackup };
type RestoreResponse = { imported: Record<string, number>; skipped: Record<string, number> };

/** Download / restore a JSON backup of the account's data (account view). */
export default function DataBackup({ locale, onRestored }: { locale: Locale; onRestored?: () => void | Promise<void> }) {
  const t = (key: string, values?: Record<string, string | number>) => translate(locale, key, values);
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<"download" | "read" | "restore" | null>(null);
  const [status, setStatus] = useState<Status>(null);
  const [pending, setPending] = useState<Pending | null>(null);

  const errorText = (code: string | undefined, path?: string) => {
    switch (code) {
      case "version": return t("backup.error.version");
      case "item": return t("backup.error.item", { path: path ?? "" });
      case "section": return t("backup.error.section", { path: path ?? "" });
      case "too-many": return t("backup.error.tooMany", { path: path ?? "" });
      case "too-large": return t("backup.error.tooLarge", { size: MAX_BACKUP_BYTES / 1024 / 1024 });
      case "limit": return t("backup.error.limit", { path: path ?? "" });
      case "invalid": return t("backup.error.invalid");
      default: return t("backup.error.generic");
    }
  };
  const backupErrorText = (error: BackupError) => errorText(error.code, error.path);

  async function download() {
    setBusy("download");
    setPending(null);
    setStatus({ kind: "info", text: t("backup.downloading") });
    try {
      const response = await fetch("/api/export", { credentials: "same-origin", cache: "no-store" });
      if (!response.ok) throw new Error(String(response.status));
      const fileName = /filename="([^"]+)"/.exec(response.headers.get("content-disposition") ?? "")?.[1] ?? backupFilename();
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.append(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setStatus({ kind: "info", text: t("backup.downloaded", { file: fileName }) });
    } catch {
      setStatus({ kind: "error", text: t("backup.downloadError") });
    } finally {
      setBusy(null);
    }
  }

  async function chooseFile(file: File | undefined) {
    if (!file) return;
    setPending(null);
    if (file.size > MAX_BACKUP_BYTES) { setStatus({ kind: "error", text: errorText("too-large") }); return; }
    setBusy("read");
    setStatus({ kind: "info", text: t("backup.reading") });
    try {
      let raw: unknown;
      try { raw = JSON.parse(await file.text()); } catch { setStatus({ kind: "error", text: t("backup.error.json") }); return; }
      if (!raw || typeof raw !== "object" || !("version" in raw)) { setStatus({ kind: "error", text: t("backup.error.format") }); return; }
      // Same strict validator the server runs, so mistakes show up before asking for confirmation.
      const parsed = parseBackup(raw);
      if (!parsed.ok) { setStatus({ kind: "error", text: backupErrorText(parsed.error) }); return; }
      setStatus(null);
      setPending({ fileName: file.name, raw, backup: parsed.value });
    } finally {
      setBusy(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function restore() {
    if (!pending) return;
    setBusy("restore");
    setStatus({ kind: "info", text: t("backup.restoring") });
    try {
      const { imported, skipped } = await api<RestoreResponse>("/api/import", { method: "POST", body: pending.raw });
      const count = (name: string) => imported[name] ?? 0;
      setPending(null);
      setStatus({ kind: "info", text: t("backup.done", {
        characters: count("characters"), campaigns: count("campaigns"), creatures: count("creatures"), encounters: count("encounters"),
        skipped: Object.values(skipped).reduce((sum, value) => sum + value, 0),
      }) });
      await Promise.resolve(onRestored?.()).catch(() => undefined);
    } catch (error) {
      setStatus({ kind: "error", text: error instanceof ApiError ? errorText(error.code, error.path) : t("backup.error.generic") });
    } finally {
      setBusy(null);
    }
  }

  const sectionCount = (name: string) => pending?.backup.sections[name]?.length ?? 0;
  const locked = busy !== null;

  return <section className={styles.panel} aria-labelledby="backup-title">
    <h2 id="backup-title">{t("backup.title")}</h2>
    <p>{t("backup.description")}</p>
    <div className={styles.actions}>
      <button type="button" className={`button button-primary ${styles.action}`} disabled={locked} onClick={() => void download()}>
        {busy === "download" && <Spinner />}{t("backup.download")}
      </button>
      <button type="button" className={`button button-quiet ${styles.action}`} disabled={locked} onClick={() => inputRef.current?.click()}>
        {busy === "read" && <Spinner />}{t("backup.restore")}
      </button>
      <input ref={inputRef} className={styles.fileInput} type="file" accept="application/json,.json" tabIndex={-1} aria-hidden="true"
        onChange={(event) => void chooseFile(event.target.files?.[0])} />
    </div>
    {pending && <div className={styles.confirm} role="group" aria-labelledby="backup-confirm-title">
      <h3 id="backup-confirm-title">{t("backup.confirm.title", { file: pending.fileName })}</h3>
      <p>{t("backup.confirm.body", {
        date: new Date(pending.backup.exportedAt).toLocaleDateString(locale === "es" ? "es-ES" : "en-US"),
        characters: sectionCount("characters"), campaigns: sectionCount("campaigns"), creatures: sectionCount("creatures"), encounters: sectionCount("encounters"),
      })}</p>
      <div className={styles.actions}>
        <button type="button" className={`button button-primary ${styles.action}`} disabled={locked} onClick={() => void restore()}>
          {busy === "restore" && <Spinner />}{t(busy === "restore" ? "backup.restoring" : "backup.confirm.action")}
        </button>
        <button type="button" className={`button button-quiet ${styles.action}`} disabled={locked} onClick={() => { setPending(null); setStatus(null); }}>{t("backup.confirm.cancel")}</button>
      </div>
    </div>}
    {status && <p className={`${styles.status} ${status.kind === "error" ? styles.statusError : ""}`} role={status.kind === "error" ? "alert" : "status"}>{status.text}</p>}
  </section>;
}
