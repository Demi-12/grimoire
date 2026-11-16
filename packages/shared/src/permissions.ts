/**
 * Pure access rules and input validation shared by route handlers and tests.
 * Nothing here touches the database, so every rule can be unit tested.
 */

// Site-wide: admins manage accounts. DM/player is not an account property but a per-campaign role.
export const siteRoles = ["admin", "user"] as const;
export const accountStatuses = ["pending", "approved", "blocked"] as const;
export const campaignRoles = ["dm", "player"] as const;

export type SiteRole = (typeof siteRoles)[number];
export type AccountStatus = (typeof accountStatuses)[number];
export type CampaignRole = (typeof campaignRoles)[number];

export interface AppUser {
  id: string;
  name: string;
  email: string;
  role: SiteRole;
  status: AccountStatus;
}

export const isSiteRole = (value: unknown): value is SiteRole => siteRoles.includes(value as SiteRole);
export const isAccountStatus = (value: unknown): value is AccountStatus => accountStatuses.includes(value as AccountStatus);
export const isCampaignRole = (value: unknown): value is CampaignRole => campaignRoles.includes(value as CampaignRole);

/** Comma/space separated list of emails that are always admins (from GRIMOIRE_ADMIN_EMAILS). */
export function parseAdminEmails(raw: string | undefined): Set<string> {
  return new Set((raw ?? "").split(/[\s,;]+/).map((email) => email.trim().toLowerCase()).filter(Boolean));
}

/** Any approved account can open a campaign (becoming its DM) or join someone else's as a player. */
export function canCreateCampaign(user: Pick<AppUser, "status">): boolean {
  return user.status === "approved";
}

/** Who may rename/delete a campaign or manage its roster: its owner, a co-DM, or a site admin. */
export function canManageCampaign(
  user: Pick<AppUser, "id" | "role">,
  campaign: { ownerId: string; myRole?: CampaignRole | null },
): boolean {
  return user.role === "admin" || campaign.ownerId === user.id || campaign.myRole === "dm";
}

/** Invite links stay valid for a week. */
export const INVITE_TTL_DAYS = 7;

/** Invite tokens are 32 random bytes in base64url; reject anything else before touching the database. */
export const isInviteToken = (value: unknown): value is string => typeof value === "string" && /^[A-Za-z0-9_-]{43}$/.test(value);

export type AdminChange = { role?: SiteRole; status?: AccountStatus };

/**
 * Guard admin edits: an admin can't lock themselves out, and the site always keeps at least one
 * approved admin. Returns an error code, or null when the change is allowed.
 */
export function checkAdminChange(
  actor: Pick<AppUser, "id">,
  target: Pick<AppUser, "id" | "role" | "status">,
  change: AdminChange | "delete",
  approvedAdminCount: number,
): "self" | "last-admin" | null {
  if (target.id === actor.id) return "self";
  const targetIsActiveAdmin = target.role === "admin" && target.status === "approved";
  if (!targetIsActiveAdmin) return null;
  const losesAdmin = change === "delete"
    || (change.role !== undefined && change.role !== "admin")
    || (change.status !== undefined && change.status !== "approved");
  return losesAdmin && approvedAdminCount <= 1 ? "last-admin" : null;
}

const abilityKeys = ["str", "dex", "con", "int", "wis", "cha"] as const;
export type CharacterScores = Record<(typeof abilityKeys)[number], number>;

export interface CharacterInput {
  name: string;
  level: number;
  className: string;
  species: string;
  background: string;
  scores: CharacterScores;
  notes: string;
  campaignId: string | null;
  /** Choices from the 2024 step-by-step creator, stored as-is (shape owned by the client). */
  build?: Record<string, unknown>;
}

const MAX_BUILD_JSON = 16_000;

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (value: unknown): value is string => typeof value === "string" && uuidPattern.test(value);

function text(value: unknown, max: number): string | null {
  if (value === undefined || value === null) return "";
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length <= max ? trimmed : null;
}

/** Validate a character payload from the browser. Returns null when anything is out of bounds. */
export function parseCharacterInput(body: unknown): CharacterInput | null {
  if (!body || typeof body !== "object") return null;
  const value = body as Record<string, unknown>;
  const name = text(value.name, 50);
  const className = text(value.className, 40);
  const species = text(value.species, 40);
  const background = text(value.background, 50);
  const notes = text(value.notes, 500);
  if (!name || className === null || species === null || background === null || notes === null) return null;
  if (!Number.isInteger(value.level) || (value.level as number) < 1 || (value.level as number) > 20) return null;
  if (!value.scores || typeof value.scores !== "object") return null;
  const rawScores = value.scores as Record<string, unknown>;
  const scores = {} as CharacterScores;
  for (const key of abilityKeys) {
    const score = rawScores[key];
    if (!Number.isInteger(score) || (score as number) < 1 || (score as number) > 30) return null;
    scores[key] = score as number;
  }
  const campaignId = value.campaignId === undefined || value.campaignId === null || value.campaignId === "" ? null : value.campaignId;
  if (campaignId !== null && !isUuid(campaignId)) return null;
  let build: Record<string, unknown> | undefined;
  if (value.build !== undefined && value.build !== null) {
    if (typeof value.build !== "object" || Array.isArray(value.build)) return null;
    if (JSON.stringify(value.build).length > MAX_BUILD_JSON) return null;
    build = value.build as Record<string, unknown>;
  }
  return { name, level: value.level as number, className, species, background, scores, notes, campaignId, ...(build ? { build } : {}) };
}

/** Campaign name/description from the browser, trimmed and length-checked. */
export function parseCampaignInput(body: unknown): { name: string; description: string } | null {
  if (!body || typeof body !== "object") return null;
  const value = body as Record<string, unknown>;
  const name = text(value.name, 80);
  const description = text(value.description, 1000);
  if (!name || description === null) return null;
  return { name, description };
}

const roleTagValues = ["frontline", "damage", "support", "control", "scouting"] as const;

export interface CreatureInput {
  name: string;
  xp: number;
  source: string;
  monsterSlug: string | null;
  cr: number | null;
  type: string | null;
  roleTags: string[];
}

/** Validate a catalog creature from the browser; null when anything is out of bounds. */
export function parseCreatureInput(body: unknown): CreatureInput | null {
  if (!body || typeof body !== "object") return null;
  const value = body as Record<string, unknown>;
  const name = text(value.name, 60);
  const source = text(value.source, 60);
  if (!name || source === null) return null;
  if (!Number.isInteger(value.xp) || (value.xp as number) < 1 || (value.xp as number) > 100_000) return null;
  const monsterSlug = value.monsterSlug === undefined || value.monsterSlug === null || value.monsterSlug === "" ? null : text(value.monsterSlug, 100);
  const type = value.type === undefined || value.type === null || value.type === "" ? null : text(value.type, 40);
  if (monsterSlug === "" || type === "") return null;
  const cr = value.cr === undefined || value.cr === null ? null : value.cr;
  if (cr !== null && (typeof cr !== "number" || !Number.isFinite(cr) || cr < 0 || cr > 30)) return null;
  const rawTags = value.roleTags === undefined ? [] : value.roleTags;
  if (!Array.isArray(rawTags) || rawTags.length > roleTagValues.length || !rawTags.every((tag) => roleTagValues.includes(tag as never))) return null;
  return { name, xp: value.xp as number, source, monsterSlug, cr, type, roleTags: [...new Set(rawTags as string[])] };
}

export const encounterStatuses = ["planned", "played"] as const;
export type EncounterStatus = (typeof encounterStatuses)[number];

export interface EncounterLineInput {
  name: string;
  xp: number;
  count: number;
  monsterSlug?: string;
  cr?: number;
  type?: string;
  source?: string;
}

export interface EncounterInput {
  title: string;
  notes: string;
  status: EncounterStatus;
  difficulty: "low" | "moderate" | "high";
  budget: number;
  totalXp: number;
  partyLevels: number[];
  lines: EncounterLineInput[];
}

/** Validate an encounter payload (a saved suggestion plus title/notes/status). Null when invalid. */
export function parseEncounterInput(body: unknown): EncounterInput | null {
  if (!body || typeof body !== "object") return null;
  const value = body as Record<string, unknown>;
  const title = text(value.title, 80);
  const notes = text(value.notes, 2000);
  if (!title || notes === null) return null;
  const status = value.status === undefined ? "planned" : value.status;
  if (!encounterStatuses.includes(status as EncounterStatus)) return null;
  if (!["low", "moderate", "high"].includes(value.difficulty as string)) return null;
  const isCount = (n: unknown, min: number, max: number) => Number.isInteger(n) && (n as number) >= min && (n as number) <= max;
  if (!isCount(value.budget, 0, 10_000_000) || !isCount(value.totalXp, 0, 10_000_000)) return null;
  if (!Array.isArray(value.partyLevels) || value.partyLevels.length > 20 || !value.partyLevels.every((level) => isCount(level, 1, 20))) return null;
  if (!Array.isArray(value.lines) || value.lines.length < 1 || value.lines.length > 30) return null;
  const lines: EncounterLineInput[] = [];
  for (const raw of value.lines as unknown[]) {
    if (!raw || typeof raw !== "object") return null;
    const line = raw as Record<string, unknown>;
    const name = text(line.name, 60);
    const source = text(line.source, 60);
    const monsterSlug = text(line.monsterSlug, 100);
    const type = text(line.type, 40);
    if (!name || source === null || monsterSlug === null || type === null) return null;
    if (!isCount(line.xp, 0, 1_000_000) || !isCount(line.count, 1, 100)) return null;
    if (line.cr !== undefined && (typeof line.cr !== "number" || !Number.isFinite(line.cr) || line.cr < 0 || line.cr > 30)) return null;
    lines.push({
      name, xp: line.xp as number, count: line.count as number,
      ...(source ? { source } : {}), ...(monsterSlug ? { monsterSlug } : {}), ...(type ? { type } : {}),
      ...(line.cr !== undefined ? { cr: line.cr as number } : {}),
    });
  }
  return {
    title, notes, status: status as EncounterStatus, difficulty: value.difficulty as EncounterInput["difficulty"],
    budget: value.budget as number, totalXp: value.totalXp as number, partyLevels: value.partyLevels as number[], lines,
  };
}

export interface PreferencesInput { locale?: "en" | "es"; theme?: "light" | "dark" }

/** Partial update of account preferences; null when empty or invalid. */
export function parsePreferencesInput(body: unknown): PreferencesInput | null {
  if (!body || typeof body !== "object") return null;
  const value = body as Record<string, unknown>;
  const result: PreferencesInput = {};
  if (value.locale !== undefined) {
    if (value.locale !== "en" && value.locale !== "es") return null;
    result.locale = value.locale;
  }
  if (value.theme !== undefined) {
    if (value.theme !== "light" && value.theme !== "dark") return null;
    result.theme = value.theme;
  }
  return result.locale || result.theme ? result : null;
}
