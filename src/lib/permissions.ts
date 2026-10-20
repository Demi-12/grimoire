/**
 * Pure access rules and input validation shared by route handlers and tests.
 * Nothing here touches the database, so every rule can be unit tested.
 */

export const siteRoles = ["admin", "dm", "player"] as const;
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

/** Comma/space separated list of emails that are always approved admins (from GRIMOIRE_ADMIN_EMAILS). */
export function parseAdminEmails(raw: string | undefined): Set<string> {
  return new Set((raw ?? "").split(/[\s,;]+/).map((email) => email.trim().toLowerCase()).filter(Boolean));
}

/** DMs and admins can open new campaigns; players join the ones they are invited to. */
export function canCreateCampaign(user: Pick<AppUser, "role" | "status">): boolean {
  return user.status === "approved" && (user.role === "admin" || user.role === "dm");
}

/** Who may rename/delete a campaign or manage its roster: its owner, a co-DM, or a site admin. */
export function canManageCampaign(
  user: Pick<AppUser, "id" | "role">,
  campaign: { ownerId: string; myRole?: CampaignRole | null },
): boolean {
  return user.role === "admin" || campaign.ownerId === user.id || campaign.myRole === "dm";
}

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
