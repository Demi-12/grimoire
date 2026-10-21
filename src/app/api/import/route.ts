import { NextResponse } from "next/server";
import { jsonError, readJson, requireUser, rateLimit } from "@/lib/access";
import { BackupRestoreError, looksLikeBackup, MAX_BACKUP_BYTES, parseBackup } from "@/lib/backup";
import { importBackup } from "@/lib/backup-data";
import { IMPORT_LIMIT } from "@/lib/rate-limit";
import { importLocalData } from "@/lib/data";
import { parseCampaignInput, parseCharacterInput, parseCreatureInput, type AppUser, type CharacterInput, type CreatureInput } from "@/lib/permissions";

export const dynamic = "force-dynamic";

const MAX_ITEMS = 200;

const backupError = (status: number, error: string, code: string, path?: string) =>
  NextResponse.json({ error, code, ...(path ? { path } : {}) }, { status });

/** Restore a versioned backup (see src/lib/backup.ts): strict validation, then a duplicate-free insert. */
async function restoreBackup(user: AppUser, body: Record<string, unknown>) {
  const parsed = parseBackup(body);
  if (!parsed.ok) {
    const { code, path } = parsed.error;
    return backupError(code === "too-many" ? 413 : 400, `Invalid backup (${code}${path ? `: ${path}` : ""}).`, code, path);
  }
  try {
    const result = await importBackup(user, parsed.value);
    const imported: Record<string, number> = {};
    const skipped: Record<string, number> = {};
    for (const [name, counts] of Object.entries(result)) { imported[name] = counts.created; skipped[name] = counts.skipped; }
    return NextResponse.json({ imported, skipped, ignored: parsed.value.ignored });
  } catch (error) {
    if (error instanceof BackupRestoreError) return backupError(409, `Backup exceeds the account limit for ${error.section}.`, "limit", error.section);
    throw error;
  }
}

/**
 * POST a backup file (`{ version: 1, ... }`) to restore it, or the legacy browser-storage payload
 * (`{ characters, campaigns, creatures }`) for the one-time import of data saved in the browser.
 */
export async function POST(request: Request) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const limited = rateLimit(user, IMPORT_LIMIT);
  if (limited) return limited;
  // Backups can be larger than the legacy browser import; item counts still cap the legacy payload.
  const parsedBody = await readJson(request, MAX_BACKUP_BYTES);
  if (looksLikeBackup(parsedBody)) return restoreBackup(user, parsedBody);
  const body = parsedBody as { characters?: unknown; campaigns?: unknown; creatures?: unknown } | null;
  if (!body || !Array.isArray(body.characters) || (body.campaigns !== undefined && !Array.isArray(body.campaigns)) || (body.creatures !== undefined && !Array.isArray(body.creatures))) {
    return jsonError(400, "Invalid import, or the data is too large.");
  }
  if (body.characters.length > MAX_ITEMS || (Array.isArray(body.campaigns) && body.campaigns.length > MAX_ITEMS) || (Array.isArray(body.creatures) && body.creatures.length > 500)) {
    return jsonError(413, "Too many items to import at once.");
  }

  const characters: (CharacterInput & { localId: string })[] = [];
  for (const raw of body.characters as unknown[]) {
    const localId = raw && typeof raw === "object" && typeof (raw as { id?: unknown }).id === "string" ? (raw as { id: string }).id : "";
    const input = parseCharacterInput({ ...(raw as object), campaignId: null });
    if (input && localId) characters.push({ ...input, localId });
  }
  const campaigns: { name: string; description: string; characterIds: string[] }[] = [];
  for (const raw of (body.campaigns ?? []) as unknown[]) {
    const input = parseCampaignInput(raw);
    const ids = raw && typeof raw === "object" ? (raw as { characterIds?: unknown }).characterIds : undefined;
    if (input) campaigns.push({ ...input, characterIds: Array.isArray(ids) ? ids.slice(0, MAX_ITEMS).filter((id): id is string => typeof id === "string") : [] });
  }

  const creatures: CreatureInput[] = [];
  for (const raw of (body.creatures ?? []) as unknown[]) {
    const input = parseCreatureInput(raw);
    if (input) creatures.push(input);
  }

  const imported = await importLocalData(user, characters, campaigns, creatures);
  return NextResponse.json({ imported });
}
