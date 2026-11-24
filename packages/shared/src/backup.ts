/**
 * Account backup format (JSON, versioned) shared by the export route, the restore route and tests.
 * Nothing here touches the database: the API (apps/api/src/backup/backup.service.ts) plugs its queries into the
 * `SectionStore` interface and `runRestore` does the orchestration, so idempotence is testable.
 *
 * To add a new kind of data (e.g. homebrew monsters) register one `BackupSection` in `backupSections`
 * and one store in backup.service.ts: parsing, size limits, export, restore and de-duplication all
 * iterate the registry, so nothing else needs to change.
 *
 * Restore strategy (documented in docs/data-backup.md): restoring never deletes or overwrites.
 * Every item gets a fingerprint (its natural key); items whose fingerprint already exists in the
 * account are skipped, the rest are created, all inside one transaction. Importing the same file
 * twice therefore creates nothing the second time.
 *
 * The decisions behind each SQL store (how a row reads back as a fingerprintable item, which campaign
 * a restored item lands in, the per-section limits, the dates an encounter keeps) are also here, at
 * the end, so the stores themselves only run queries. The one-time import of data an old version kept
 * in the browser follows the same split: `parseLegacyImport` validates it and `runLegacyImport` drives a
 * `LegacyImportStore`.
 */
import {
  canCreateCampaign,
  characterFieldsOf,
  isCampaignRole,
  parseCampaignInput,
  parseCharacterInput,
  parseCreatureInput,
  parseEncounterInput,
  type AppUser,
  type CampaignRole,
  type CharacterData,
  type CharacterInput,
  type CreatureInput,
  type EncounterInput,
} from "./permissions.js";

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

// ---- Legacy import: the one-time move of data an old version kept in the browser ----

const LEGACY_MAX_ITEMS = 200;
const LEGACY_MAX_CREATURES = 500;

export interface LegacyCampaign { name: string; description: string; characterIds: string[] }
export interface LegacyImport {
  /** `localId` is the id the browser gave the character; legacy campaigns point at it. */
  characters: (CharacterInput & { localId: string })[];
  campaigns: LegacyCampaign[];
  creatures: CreatureInput[];
}

const optionalList = (value: unknown): unknown[] | null => value === undefined ? [] : Array.isArray(value) ? value : null;

/**
 * Validate the legacy browser payload (`{ characters, campaigns?, creatures? }`). Unlike a backup,
 * entries that do not validate are dropped one by one: the old browser data was never checked.
 */
export function parseLegacyImport(body: unknown): { ok: true; value: LegacyImport } | { ok: false; error: "invalid" | "too-many" } {
  if (!isRecord(body) || !Array.isArray(body.characters)) return { ok: false, error: "invalid" };
  const rawCampaigns = optionalList(body.campaigns);
  const rawCreatures = optionalList(body.creatures);
  if (!rawCampaigns || !rawCreatures) return { ok: false, error: "invalid" };
  if (body.characters.length > LEGACY_MAX_ITEMS || rawCampaigns.length > LEGACY_MAX_ITEMS || rawCreatures.length > LEGACY_MAX_CREATURES) {
    return { ok: false, error: "too-many" };
  }
  const characters = body.characters.flatMap((raw) => {
    const localId = isRecord(raw) && typeof raw.id === "string" ? raw.id : "";
    const input = parseCharacterInput({ ...(isRecord(raw) ? raw : {}), campaignId: null });
    return input && localId ? [{ ...input, localId }] : [];
  });
  const campaigns = rawCampaigns.flatMap((raw) => {
    const input = parseCampaignInput(raw);
    const ids = isRecord(raw) && Array.isArray(raw.characterIds) ? raw.characterIds : [];
    return input ? [{ ...input, characterIds: ids.slice(0, LEGACY_MAX_ITEMS).filter((id): id is string => typeof id === "string") }] : [];
  });
  const creatures = rawCreatures.flatMap((raw) => {
    const input = parseCreatureInput(raw);
    return input ? [input] : [];
  });
  return { ok: true, value: { characters, campaigns, creatures } };
}

/** Where the legacy import writes, one item per call. A store answers false/null when the account refused that item. */
export interface LegacyImportStore {
  createCreature(item: CreatureInput): Promise<boolean>;
  /** The new character's id. */
  createCharacter(item: CharacterInput): Promise<string | null>;
  /** The new campaign's id. */
  createCampaign(item: { name: string; description: string }): Promise<string | null>;
  /** Put characters that were just imported (their new ids) in a campaign. */
  placeCharacters(campaignId: string, characterIds: string[]): Promise<void>;
}

export interface LegacyImportCounts { characters: number; campaigns: number; creatures: number }

/**
 * Copy validated legacy data through the store: creatures, then characters outside any campaign
 * (remembering browser id -> new id), then, only for accounts that may create campaigns, each
 * campaign with the characters it pointed at. Refused items are left out and not counted.
 */
export async function runLegacyImport(
  { characters, campaigns, creatures }: LegacyImport, user: Pick<AppUser, "status">, store: LegacyImportStore,
): Promise<LegacyImportCounts> {
  let creatureCount = 0;
  for (const creature of creatures) {
    if (await store.createCreature(creature)) creatureCount += 1;
  }
  const idMap = new Map<string, string>();
  for (const character of characters) {
    const id = await store.createCharacter({ ...character, campaignId: null });
    if (id !== null) idMap.set(character.localId, id);
  }
  const campaignCount = canCreateCampaign(user) ? await importLegacyCampaigns(campaigns, idMap, store) : 0;
  return { characters: idMap.size, campaigns: campaignCount, creatures: creatureCount };
}

/** Create each legacy campaign and place in it the characters it pointed at that were imported; returns how many were created. */
async function importLegacyCampaigns(campaigns: LegacyCampaign[], idMap: Map<string, string>, store: LegacyImportStore): Promise<number> {
  let created = 0;
  for (const campaign of campaigns) {
    const id = await store.createCampaign(campaign);
    if (id === null) continue;
    created += 1;
    const ids = campaign.characterIds.flatMap((localId) => idMap.get(localId) ?? []);
    if (ids.length) await store.placeCharacters(id, ids);
  }
  return created;
}

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

// ---- Restore decisions the SQL stores in backup.service.ts delegate ----

const sectionByKey = (sectionKey: string) => {
  const found = backupSections.find((candidate) => candidate.key === sectionKey);
  if (!found) throw new Error(`Unknown backup section ${sectionKey}`);
  return found;
};

/** Existing rows are fingerprinted with their real ids, so no local->real mapping applies to them. */
const noMap: IdMap = {};

/**
 * Fingerprint -> id of the rows an account already has, for `SectionStore.existing`. `toItem` reads a
 * row as the section's item (the row itself by default). Rows come in the store's order and the first
 * one wins: with two campaigns of the same name, the oldest is the one reused.
 */
export function indexExisting<Row extends { id: string }>(
  sectionKey: string, rows: readonly Row[], toItem: (row: Row) => unknown = (row) => row,
): Map<string, string> {
  const section = sectionByKey(sectionKey);
  const found = new Map<string, string>();
  for (const row of rows) {
    const fingerprint = section.fingerprint(toItem(row), noMap);
    if (!found.has(fingerprint)) found.set(fingerprint, row.id);
  }
  return found;
}

/** A character row as the restore reads it. `data` is the jsonb column; quick-edit characters lack most of it. */
export interface StoredCharacterRow {
  name: string;
  level: number;
  data: CharacterData;
}

/** A stored character as the backup item it fingerprints like (see characterFieldsOf for the defaults). */
export function storedCharacter({ name, level, data }: StoredCharacterRow): Omit<BackupCharacter, "id" | "campaignId"> {
  return { name, level, ...characterFieldsOf(data) };
}

/** Real id of the campaign a restored item points at (a backup-local id), or null when it points at none or isn't mapped. */
export const restoredCampaignId = (localId: string | null | undefined, idMap: IdMap): string | null =>
  localId ? idMap.campaigns?.get(localId) ?? null : null;

/** Real id of the campaign a restored encounter lands in; an encounter always belongs to one, so an unmapped link is a bug. */
export function encounterCampaignId(item: BackupEncounter, idMap: IdMap): string {
  const campaignId = restoredCampaignId(item.campaignId, idMap);
  if (!campaignId) throw new Error("Encounter references an unknown campaign.");
  return campaignId;
}

/**
 * Per-restore count of what a section holds, per scope (the account, or one campaign). Stores `add`
 * what `existing` found and `take` a slot before each insert, which throws once the limit is reached.
 */
export class RestoreQuota {
  private readonly used = new Map<string, number>();
  constructor(readonly section: string, readonly max: number) {}

  add(scope: string, count = 1): void {
    this.used.set(scope, (this.used.get(scope) ?? 0) + count);
  }

  take(scope: string): void {
    if ((this.used.get(scope) ?? 0) >= this.max) throw new BackupRestoreError("limit", this.section);
    this.add(scope);
  }
}

/**
 * Dates a restored encounter is inserted with. Null leaves the date to the database clock (now), and
 * `playedAt` only counts when the encounter was played.
 */
export const encounterRestoreDates = (item: BackupEncounter) => ({
  played: item.status === "played", playedAt: item.playedAt ?? null, createdAt: item.createdAt ?? null,
});
