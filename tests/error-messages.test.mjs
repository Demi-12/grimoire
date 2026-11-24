import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { apiErrorText } from "../packages/shared/dist/error-text.js";

/**
 * Every error message the API writes by hand must have its own text in both languages in
 * packages/shared/src/error-text.ts. Without one, the browser still never shows the English message
 * (it shows a generic text), but the person loses the reason; this test catches a new message early.
 */

const root = new URL("..", import.meta.url).pathname;

async function sources(dir) {
  const entries = await readdir(join(root, dir), { withFileTypes: true, recursive: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts"))
    .map((entry) => join(entry.parentPath, entry.name));
}

/** Messages only a hand-made request (not the app) can trigger, or that carry a `code` the browser reads instead. */
const GENERIC_ON_PURPOSE = new Set([
  "Send JSON.", "Unknown telemetry.", "Expected { locked: boolean }.",
  "Invalid book filter.", "Invalid challenge rating filter.", "Invalid pagination values.",
  // The backup's errors: data-backup.component reads their `code` and `path`.
  "Invalid backup (", "Backup exceeds the account limit for ",
]);
const onPurpose = (message) => [...GENERIC_ON_PURPOSE].some((known) => message === known || (known.endsWith(" ") || known.endsWith("(")) && message.startsWith(known));

const patterns = [
  /new ApiError\(\d+, "([^"]+)"/g,
  /new ApiError\(\d+, `([^`]+)`/g,
  /backupError\([^,]+, `([^`]+)`/g,
  /(?:Upstream|MonsterApi)Error\("([^"]+)"/g,
  /\[\d{3}, "([^"]+)"\]/g,
  /^\s+[\w"-]+: "([A-Z][^"]+\.)",?$/gm,
  /error: "([A-Z][^"]+\.)"/g,
];

const files = [
  ...await sources("apps/api/src"),
  join(root, "packages/shared/src/open5e.ts"), join(root, "packages/shared/src/permissions.ts"), join(root, "packages/shared/src/monster-api.ts"),
];

const messages = new Set();
for (const file of files) {
  const source = await readFile(file, "utf8");
  if (!/ApiError|UpstreamError|MonsterApiError|ok: false/.test(source)) continue;
  for (const pattern of patterns) for (const match of source.matchAll(pattern)) messages.add(match[1]);
}

describe("API error messages", () => {
  it("finds the messages it guards", () => {
    expect(messages.size).toBeGreaterThan(30);
  });

  it("gives each one its own text in Spanish and English", () => {
    const missing = [];
    for (const message of messages) {
      if (onPurpose(message)) continue;
      // A template literal reads like the message it writes, with its value as a number.
      const written = message.replace(/\$\{[^}]+\}/g, "20");
      for (const locale of ["es", "en"]) {
        if (apiErrorText(locale, { status: 400, message: written }, "FALLBACK") === "FALLBACK") missing.push(`${locale}: ${message}`);
      }
    }
    expect(missing).toEqual([]);
  });
});
