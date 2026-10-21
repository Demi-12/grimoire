/**
 * Account backup format (JSON, versioned) shared by the export route, the restore route and tests.
 * Nothing here touches the database: the data layer (backup-data.ts) plugs its queries into the
 * `SectionStore` interface and `runRestore` does the orchestration, so idempotence is testable.
 *
 * To add a new kind of data (e.g. homebrew monsters) register one `BackupSection` in `backupSections`
 * and one store in backup-data.ts: parsing, size limits, export, restore and de-duplication all
 * iterate the registry, so nothing else needs to change.
 *
 * Restore strategy (documented in docs/data-backup.md): restoring never deletes or overwrites.
 * Every item gets a fingerprint (its natural key); items whose fingerprint already exists in the
 * account are skipped, the rest are created, all inside one transaction. Importing the same file
 * twice therefore creates nothing the second time.
 */
import {
  isCampaignRole,
  parseCampaignInput,
  parseCharacterInput,
  parseCreatureInput,
  parseEncounterInput,
  type CampaignRole,
  type CharacterInput,
  type CreatureInput,
  type EncounterInput,
} from "./permissions";

export const BACKUP_VERSION = 1;
/** Largest backup file accepted by the restore route and the UI (bytes). */
export const MAX_BACKUP_BYTES = 12 * 1024 * 1024;

/** Items already restored/exported by earlier sections: section key -> local ids. */
export type RefIds = Record<string, Set<string>>;

export interface BackupSection<Item = unknown, View = unknown> {
  key: string;
  maxItems: number;
  /** Strictly validate one raw entry of a backup file; null rejects the whole file. */
  parse(raw: unknown, refs: RefIds): Item | null;
  /** Whitelist-map a data-layer view into the exported shape; null leaves it out. Never copy rows wholesale. */
  serialize(view: View, refs: RefIds): Item | null;
  /** Id other sections use to point at this item (backup-local, not a database id). */
  localId?(item: Item): string;
  /** Natural key used to skip items the account already has. */
  fingerprint(item: Item, idMap: IdMap): string;
}

type AnySection = BackupSection<any, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const defineSection = <Item, View>(section: BackupSection<Item, View>) => section as unknown as AnySection;

/** Section key -> (backup-local id -> id in the database). */
export type IdMap = Record<string, Map<string, string>>;

const norm = (value: string) => value.trim().replace(/\s+/g, " ").toLowerCase();
/** JSON with sorted object keys: PostgreSQL's jsonb reorders keys, so fingerprints must not depend on order. */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (isRecord(value)) return `{${Object.keys(value).sort().map((name) => `${JSON.stringify(name)}:${canonical(value[name])}`).join(",")}}`;
  return JSON.stringify(value) ?? "null";
}
const key = (...parts: unknown[]) => canonical(parts);
const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const isIsoDate = (value: unknown): value is string => typeof value === "string" && value.length <= 40 && /^\d{4}-\d{2}-\d{2}T/.test(value) && Number.isFinite(Date.parse(value));
const isLocalId = (value: unknown): value is string => typeof value === "string" && value.length > 0 && value.length <= 64;

// ---- Section: campaigns (owned by the exporting user) ----

export interface BackupCampaign {
  id: string;
  name: string;
  description: string;
  /** Informational only (name and role, nothing identifying); ignored on restore. */
  members: { name: string; role: CampaignRole }[];
}

const campaignsSection = defineSection<BackupCampaign, { id: string; name: string; description: string; members: { name: string; role: CampaignRole }[] }>({
  key: "campaigns",
  maxItems: 200,
  localId: (item) => item.id,
  parse(raw) {
    if (!isRecord(raw) || !isLocalId(raw.id)) return null;
    const input = parseCampaignInput(raw);
    if (!input) return null;
    const rawMembers = raw.members === undefined ? [] : raw.members;
    if (!Array.isArray(rawMembers) || rawMembers.length > 200) return null;
    const members: BackupCampaign["members"] = [];
    for (const member of rawMembers) {
      if (!isRecord(member) || typeof member.name !== "string" || member.name.length > 80 || !isCampaignRole(member.role)) return null;
      members.push({ name: member.name, role: member.role });
    }
    return { id: raw.id, ...input, members };
  },
  serialize: (view) => ({
    id: view.id, name: view.name, description: view.description,
    members: view.members.map((member) => ({ name: member.name, role: member.role })),
  }),
  fingerprint: (item) => key(norm(item.name)),
});

// ---- Section: characters (only the user's own) ----

export type BackupCharacter = CharacterInput & { id: string };

const charactersSection = defineSection<BackupCharacter, CharacterInput & { id: string }>({
  key: "characters",
  maxItems: 1000,
  localId: (item) => item.id,
  parse(raw, refs) {
    if (!isRecord(raw) || !isLocalId(raw.id)) return null;
    const campaignRef = raw.campaignId === undefined || raw.campaignId === null || raw.campaignId === "" ? null : raw.campaignId;
    // campaignId points at a campaign in this same file (backup-local id), not at a database row.
    if (campaignRef !== null && (typeof campaignRef !== "string" || !refs.campaigns?.has(campaignRef))) return null;
    const input = parseCharacterInput({ ...raw, campaignId: null });
    return input ? { ...input, campaignId: campaignRef as string | null, id: raw.id } : null;
  },
  serialize(view, refs) {
    const { id, name, level, className, species, background, scores, notes, campaignId, build } = view;
    return {
      id, name, level, className, species, background,
      scores: { ...scores }, notes,
      // Characters placed in someone else's campaign leave that link behind: the campaign isn't exported.
      campaignId: campaignId && refs.campaigns?.has(campaignId) ? campaignId : null,
      ...(build ? { build } : {}),
    };
  },
  fingerprint: (item) => key(norm(item.name), item.level, norm(item.className), norm(item.species), norm(item.background), item.scores, item.notes.trim(), item.build ?? null),
});

// ---- Section: personal creature catalog ----

export type BackupCreature = CreatureInput;

const creaturesSection = defineSection<BackupCreature, { name: string; xp: number; source: string; monsterSlug?: string; cr?: number; type?: string; roleTags?: string[] }>({
  key: "creatures",
  maxItems: 500,
  parse: (raw) => (isRecord(raw) ? parseCreatureInput(raw) : null),
  serialize: (view) => ({
    name: view.name, xp: view.xp, source: view.source,
    monsterSlug: view.monsterSlug ?? null, cr: view.cr ?? null, type: view.type ?? null, roleTags: view.roleTags ?? [],
  }),
  // The catalog already has a unique (owner, monsterSlug) index; custom creatures use name+source+xp.
  fingerprint: (item) => (item.monsterSlug ? key("slug", item.monsterSlug) : key("custom", norm(item.name), norm(item.source), item.xp)),
});

// ---- Section: encounter journal of the user's campaigns ----

export type BackupEncounter = EncounterInput & { campaignId: string; createdAt?: string; playedAt?: string | null };

const encountersSection = defineSection<BackupEncounter, EncounterInput & { campaignId: string; createdAt: string; playedAt: string | null }>({
  key: "encounters",
  maxItems: 5000,
  parse(raw, refs) {
    if (!isRecord(raw) || typeof raw.campaignId !== "string" || !refs.campaigns?.has(raw.campaignId)) return null;
    const input = parseEncounterInput(raw);
    if (!input) return null;
    if (raw.createdAt !== undefined && !isIsoDate(raw.createdAt)) return null;
    if (raw.playedAt !== undefined && raw.playedAt !== null && !isIsoDate(raw.playedAt)) return null;
    return {
      ...input, campaignId: raw.campaignId,
      ...(raw.createdAt !== undefined ? { createdAt: raw.createdAt as string } : {}),
      ...(raw.playedAt !== undefined ? { playedAt: raw.playedAt as string | null } : {}),
    };
  },
  serialize(view, refs) {
    if (!refs.campaigns?.has(view.campaignId)) return null;
    return {
      campaignId: view.campaignId, title: view.title, notes: view.notes, status: view.status, difficulty: view.difficulty,
      budget: view.budget, totalXp: view.totalXp, partyLevels: [...view.partyLevels],
      lines: view.lines.map((line) => ({ ...line })), createdAt: view.createdAt, playedAt: view.playedAt,
    };
  },
  // The fingerprint is scoped to the campaign the encounter lands in (its real id, once mapped).
  fingerprint: (item, idMap) => key(idMap.campaigns?.get(item.campaignId) ?? item.campaignId, norm(item.title), item.difficulty, item.budget, item.totalXp, item.partyLevels, item.lines, item.notes.trim()),
});

/** Order matters: later sections may reference ids of earlier ones (characters and encounters -> campaigns). */
export const backupSections: readonly AnySection[] = [campaignsSection, charactersSection, creaturesSection, encountersSection];

// ---- File shape ----

export interface BackupFile {
  version: typeof BACKUP_VERSION;
  exportedAt: string;
  [section: string]: unknown;
}

/** True when a JSON body is the versioned backup format rather than the legacy browser import. */
export const looksLikeBackup = (body: unknown): body is Record<string, unknown> => isRecord(body) && "version" in body;

export type BackupErrorCode = "invalid" | "version" | "section" | "item" | "too-many";
export interface BackupError { code: BackupErrorCode; /** e.g. "characters[3]" */ path?: string }

export interface ParsedBackup {
  version: typeof BACKUP_VERSION;
  exportedAt: string;
  /** Validated items per section key (only sections present in the file). */
  sections: Record<string, unknown[]>;
  /** Top-level keys this version doesn't know (e.g. sections added by a newer app); never imported. */
  ignored: string[];
}

/**
 * Strictly validate a backup file. Any invalid item rejects the whole file (nothing is partially
 * imported or silently dropped), and the error says which entry is wrong.
 */
export function parseBackup(body: unknown): { ok: true; value: ParsedBackup } | { ok: false; error: BackupError } {
  const bad = (code: BackupErrorCode, path?: string) => ({ ok: false as const, error: { code, ...(path ? { path } : {}) } });
  if (!isRecord(body)) return bad("invalid");
  if (body.version !== BACKUP_VERSION) return bad("version", "version");
  if (!isIsoDate(body.exportedAt)) return bad("invalid", "exportedAt");
  const sections: Record<string, unknown[]> = {};
  const refs: RefIds = {};
  for (const section of backupSections) {
    const raw = body[section.key];
    if (raw === undefined) continue;
    if (!Array.isArray(raw)) return bad("section", section.key);
    if (raw.length > section.maxItems) return bad("too-many", section.key);
    const items: unknown[] = [];
    const ids = new Set<string>();
    for (const [index, entry] of raw.entries()) {
      const item = section.parse(entry, refs);
      if (item === null) return bad("item", `${section.key}[${index}]`);
      const id = section.localId?.(item);
      if (id !== undefined) {
        if (ids.has(id)) return bad("item", `${section.key}[${index}]`);
        ids.add(id);
      }
      items.push(item);
    }
    sections[section.key] = items;
    refs[section.key] = ids;
  }
  const known = new Set<string>(["version", "exportedAt", ...backupSections.map((section) => section.key)]);
  return { ok: true, value: { version: BACKUP_VERSION, exportedAt: body.exportedAt, sections, ignored: Object.keys(body).filter((name) => !known.has(name)) } };
}

/** Build the exported file from data-layer views, keyed by section. Pure: the caller supplies the views. */
export function serializeBackup(views: Record<string, unknown[]>, now: Date = new Date()): BackupFile {
  const file: BackupFile = { version: BACKUP_VERSION, exportedAt: now.toISOString() };
  const refs: RefIds = {};
  for (const section of backupSections) {
    const items = (views[section.key] ?? []).map((view) => section.serialize(view, refs)).filter((item) => item !== null);
    file[section.key] = items;
    refs[section.key] = new Set(section.localId ? items.map((item) => section.localId!(item)) : []);
  }
  return file;
}

export const backupFilename = (now: Date = new Date()) => `grimoire-backup-${now.toISOString().slice(0, 10)}.json`;

// ---- Restore orchestration ----

export interface SectionStore {
  /** Fingerprint -> database id of what the account already has. Called after earlier sections ran. */
  existing(idMap: IdMap): Promise<Map<string, string>>;
  /** Insert one item and return its database id. May throw BackupRestoreError("limit"). */
  create(item: unknown, idMap: IdMap): Promise<string>;
}

export class BackupRestoreError extends Error {
  constructor(readonly code: "limit", readonly section: string) {
    super(`Backup restore failed: ${code} in ${section}`);
  }
}

export interface RestoreCounts { created: number; skipped: number }
export type RestoreResult = Record<string, RestoreCounts>;

/**
 * Apply a validated backup through the stores. Items already present (same fingerprint, including
 * duplicates inside the file itself) are skipped but still mapped, so later sections can reference them.
 */
export async function runRestore(backup: ParsedBackup, stores: Record<string, SectionStore>): Promise<RestoreResult> {
  const idMap: IdMap = {};
  const result: RestoreResult = {};
  for (const section of backupSections) {
    const items = backup.sections[section.key] ?? [];
    const map = new Map<string, string>();
    idMap[section.key] = map;
    const counts: RestoreCounts = { created: 0, skipped: 0 };
    result[section.key] = counts;
    if (!items.length) continue;
    const store = stores[section.key];
    const known = await store.existing(idMap);
    for (const item of items) {
      const fingerprint = section.fingerprint(item, idMap);
      let id = known.get(fingerprint);
      if (id === undefined) {
        id = await store.create(item, idMap);
        known.set(fingerprint, id);
        counts.created += 1;
      } else {
        counts.skipped += 1;
      }
      const localId = section.localId?.(item);
      if (localId !== undefined) map.set(localId, id);
    }
  }
  return result;
}
