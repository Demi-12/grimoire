import { ChangeDetectionStrategy, Component, ElementRef, inject, input, signal, viewChild } from "@angular/core";
import { backupFilename, MAX_BACKUP_BYTES, parseBackup, type BackupError, type ParsedBackup } from "@grimoire/shared/backup";
import { backupPathText } from "@grimoire/shared/error-text";
import { api, ApiError } from "../core/api-client";
import { FeedbackService } from "../core/feedback.service";
import { I18nService } from "../core/i18n.service";
import { SpinnerComponent } from "./skeleton.component";

type RestoreResponse = { imported: Record<string, number>; skipped: Record<string, number> };

/** Download / restore a JSON backup of the account's data (account view). */
@Component({
  selector: "app-data-backup",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SpinnerComponent],
  styleUrl: "./data-backup.component.css",
  host: { class: "contents" },
  template: `
    <section class="backupPanel" aria-labelledby="backup-title">
      <h2 id="backup-title">{{ t("backup.title") }}</h2>
      <p>{{ t("backup.description") }}</p>
      <div class="actions">
        <button type="button" class="button button-primary action" [disabled]="busy() !== null" (click)="download()">
          @if (busy() === "download") { <span appSpinner></span> }{{ t(busy() === "download" ? "backup.downloading" : "backup.download") }}</button>
        <button type="button" class="button button-quiet action" [disabled]="busy() !== null" (click)="fileInput().nativeElement.click()">
          @if (busy() === "restore") { <span appSpinner></span> }{{ t(busy() === "restore" ? "backup.restoring" : "backup.restore") }}</button>
        <input #file class="fileInput" type="file" accept="application/json,.json" tabindex="-1" aria-hidden="true"
          (change)="chooseFile(file.files?.[0])" />
      </div>
    </section>
  `,
})
export class DataBackupComponent {
  private readonly i18n = inject(I18nService);
  private readonly feedback = inject(FeedbackService);
  protected readonly t = this.i18n.t;

  readonly onRestored = input<() => void | Promise<void>>();

  protected readonly fileInput = viewChild.required<ElementRef<HTMLInputElement>>("file");
  protected readonly busy = signal<"download" | "restore" | null>(null);

  private errorText(code: string | undefined, rawPath?: string): string {
    // "characters[3]" reads as "personaje n.º 4".
    const path = backupPathText(this.i18n.locale(), rawPath);
    switch (code) {
      case "version": return this.t("backup.error.version");
      case "item": return this.t("backup.error.item", { path });
      case "section": return this.t("backup.error.section", { path });
      case "too-many": return this.t("backup.error.tooMany", { path });
      case "too-large": return this.t("backup.error.tooLarge", { size: MAX_BACKUP_BYTES / 1024 / 1024 });
      case "limit": return this.t("backup.error.limit", { path });
      case "invalid": return this.t("backup.error.invalid");
      default: return this.t("backup.error.generic");
    }
  }

  private backupErrorText(error: BackupError): string {
    return this.errorText(error.code, error.path);
  }

  protected async download(): Promise<void> {
    this.busy.set("download");
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
      this.feedback.toast.success(this.t("backup.downloaded", { file: fileName }));
    } catch {
      this.feedback.toast.error(this.t("backup.downloadError"));
    } finally {
      this.busy.set(null);
    }
  }

  /** Reads and validates the file with the same strict parser the server runs, so mistakes show up before asking. */
  private async readFile(file: File): Promise<{ raw: unknown; backup: ParsedBackup } | string> {
    if (file.size > MAX_BACKUP_BYTES) return this.errorText("too-large");
    let raw: unknown;
    try { raw = JSON.parse(await file.text()); } catch { return this.t("backup.error.json"); }
    if (!raw || typeof raw !== "object" || !("version" in raw)) return this.t("backup.error.format");
    const parsed = parseBackup(raw);
    return parsed.ok ? { raw, backup: parsed.value } : this.backupErrorText(parsed.error);
  }

  protected async chooseFile(file: File | null | undefined): Promise<void> {
    this.fileInput().nativeElement.value = "";
    if (!file) return;
    const read = await this.readFile(file);
    if (typeof read === "string") { this.feedback.toast.error(read); return; }
    const sectionCount = (name: string) => read.backup.sections[name]?.length ?? 0;
    const confirmed = await this.feedback.confirm({
      title: this.t("backup.confirm.title", { file: file.name }),
      message: this.t("backup.confirm.body", {
        date: new Date(read.backup.exportedAt).toLocaleDateString(this.i18n.locale() === "es" ? "es-ES" : "en-US"),
        characters: sectionCount("characters"), campaigns: sectionCount("campaigns"), creatures: sectionCount("creatures"), encounters: sectionCount("encounters"),
      }),
      confirmLabel: this.t("backup.confirm.action"),
      cancelLabel: this.t("backup.confirm.cancel"),
    });
    if (confirmed) await this.restore(read.raw);
  }

  private async restore(raw: unknown): Promise<void> {
    this.busy.set("restore");
    try {
      const { imported, skipped } = await api<RestoreResponse>("/api/import", { method: "POST", body: raw });
      const count = (name: string) => imported[name] ?? 0;
      this.feedback.toast.success(this.t("backup.done", {
        characters: count("characters"), campaigns: count("campaigns"), creatures: count("creatures"), encounters: count("encounters"),
        skipped: Object.values(skipped).reduce((sum, value) => sum + value, 0),
      }));
      await Promise.resolve(this.onRestored()?.()).catch(() => undefined);
    } catch (error) {
      this.feedback.toast.error(error instanceof ApiError && error.code ? this.errorText(error.code, error.path) : this.i18n.errorText(error, this.t("backup.error.generic")));
    } finally {
      this.busy.set(null);
    }
  }
}
