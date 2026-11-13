"use client";

import { useRef, useState } from "react";
import { api, ApiError } from "@/lib/api-client";
import { backupFilename, MAX_BACKUP_BYTES, parseBackup, type BackupError, type ParsedBackup } from "@/lib/backup";
import { translate, type Locale } from "@/lib/i18n";
import { Spinner } from "./skeleton";
import { useConfirm, useToast } from "./feedback";
import styles from "./data-backup.module.css";

type RestoreResponse = { imported: Record<string, number>; skipped: Record<string, number> };

/** Download / restore a JSON backup of the account's data (account view). */
export default function DataBackup({ locale, onRestored }: { locale: Locale; onRestored?: () => void | Promise<void> }) {
  const t = (key: string, values?: Record<string, string | number>) => translate(locale, key, values);
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<"download" | "restore" | null>(null);
  const confirm = useConfirm();
  const toast = useToast();

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
      toast.success(t("backup.downloaded", { file: fileName }));
    } catch {
      toast.error(t("backup.downloadError"));
    } finally {
      setBusy(null);
    }
  }

  /** Reads and validates the file with the same strict parser the server runs, so mistakes show up before asking. */
  async function readFile(file: File): Promise<{ raw: unknown; backup: ParsedBackup } | string> {
    if (file.size > MAX_BACKUP_BYTES) return errorText("too-large");
    let raw: unknown;
    try { raw = JSON.parse(await file.text()); } catch { return t("backup.error.json"); }
    if (!raw || typeof raw !== "object" || !("version" in raw)) return t("backup.error.format");
    const parsed = parseBackup(raw);
    return parsed.ok ? { raw, backup: parsed.value } : backupErrorText(parsed.error);
  }

  async function chooseFile(file: File | undefined) {
    if (inputRef.current) inputRef.current.value = "";
    if (!file) return;
    const read = await readFile(file);
    if (typeof read === "string") { toast.error(read); return; }
    const sectionCount = (name: string) => read.backup.sections[name]?.length ?? 0;
    const confirmed = await confirm({
      title: t("backup.confirm.title", { file: file.name }),
      message: t("backup.confirm.body", {
        date: new Date(read.backup.exportedAt).toLocaleDateString(locale === "es" ? "es-ES" : "en-US"),
        characters: sectionCount("characters"), campaigns: sectionCount("campaigns"), creatures: sectionCount("creatures"), encounters: sectionCount("encounters"),
      }),
      confirmLabel: t("backup.confirm.action"),
      cancelLabel: t("backup.confirm.cancel"),
    });
    if (confirmed) await restore(read.raw);
  }

  async function restore(raw: unknown) {
    setBusy("restore");
    try {
      const { imported, skipped } = await api<RestoreResponse>("/api/import", { method: "POST", body: raw });
      const count = (name: string) => imported[name] ?? 0;
      toast.success(t("backup.done", {
        characters: count("characters"), campaigns: count("campaigns"), creatures: count("creatures"), encounters: count("encounters"),
        skipped: Object.values(skipped).reduce((sum, value) => sum + value, 0),
      }));
      await Promise.resolve(onRestored?.()).catch(() => undefined);
    } catch (error) {
      toast.error(error instanceof ApiError ? errorText(error.code, error.path) : t("backup.error.generic"));
    } finally {
      setBusy(null);
    }
  }

  const locked = busy !== null;

  return <section className={styles.panel} aria-labelledby="backup-title">
    <h2 id="backup-title">{t("backup.title")}</h2>
    <p>{t("backup.description")}</p>
    <div className={styles.actions}>
      <button type="button" className={`button button-primary ${styles.action}`} disabled={locked} onClick={() => void download()}>
        {busy === "download" && <Spinner />}{t(busy === "download" ? "backup.downloading" : "backup.download")}
      </button>
      <button type="button" className={`button button-quiet ${styles.action}`} disabled={locked} onClick={() => inputRef.current?.click()}>
        {busy === "restore" && <Spinner />}{t(busy === "restore" ? "backup.restoring" : "backup.restore")}
      </button>
      <input ref={inputRef} className={styles.fileInput} type="file" accept="application/json,.json" tabIndex={-1} aria-hidden="true"
        onChange={(event) => void chooseFile(event.target.files?.[0])} />
    </div>
  </section>;
}
