/**
 * What a person reads when something fails. The API answers in English (`{ error }`, sometimes with a `code`),
 * better-auth answers with its own English messages and codes, and a dropped connection is a bare TypeError;
 * this module turns each of them into a text of i18n.ts in the interface language.
 *
 * Rule: nothing technical reaches the screen. A message this module doesn't know is never shown as it came:
 * it becomes the caller's own fallback, or a plain text chosen by the HTTP status.
 *
 * Not here: the texts themselves (i18n.ts) or how a component shows them.
 */
import { translate, type Locale } from "./i18n.js";

/** The fields of an error this module reads: ApiError, MonsterApiError, better-auth's `{ code, message, status }`. */
interface ErrorShape { status?: unknown; message?: unknown; code?: unknown; name?: unknown }

const shape = (error: unknown): ErrorShape => (error && typeof error === "object" ? error as ErrorShape : {});
const text = (value: unknown): string => (typeof value === "string" ? value : "");
const statusOf = (error: ErrorShape): number | undefined => (typeof error.status === "number" ? error.status : undefined);

/** `fetch` rejects with a TypeError when the server can't be reached at all (offline, server down, DNS). */
function isNetworkFailure(error: unknown): boolean {
  return error instanceof TypeError || (statusOf(shape(error)) === 0);
}

// ─── API errors ───────────────────────────────────────────────────────────────────────────────────────

/** Exact messages of apps/api (and the shared validators it answers with), by i18n key. */
const API_MESSAGES: Record<string, string> = {
  "Not found.": "error.notFound",
  "Sign in to continue.": "error.signIn",
  "Your account is waiting for approval.": "error.pending",
  "Your account has been blocked.": "error.blocked",
  "You don't have permission for that.": "error.forbidden",
  "Internal server error.": "error.server",
  "Too many requests. Please wait a moment and try again.": "error.tooMany",
  "That change isn't valid.": "error.invalid",
  "Invalid creature.": "error.invalid",
  "Invalid character.": "error.invalid",
  "Invalid preferences.": "error.invalid",
  "Invalid campaign.": "error.invalid",
  "Invalid member.": "error.invalid",
  "Invalid encounter.": "error.invalid",
  "Invalid map change.": "error.invalid",
  "Invalid change.": "error.invalid",
  "Invalid role.": "error.invalid",
  "Invalid status.": "error.invalid",
  "Nothing to change.": "error.invalid",
  "That's the most this campaign can keep.": "error.limit",
  "A wall or a closed door is in the way.": "error.mapBlocked",
  "It isn't this creature's turn.": "error.mapTurn",
  "That's further than this creature can move this turn.": "error.mapMovement",
  "Send a PNG, JPEG, WebP or GIF picture of 5 MB or less.": "error.mapPictureSize",
  "Use a PNG, JPEG, WebP or GIF picture.": "error.mapPictureType",
  "You can't change or delete your own account from the admin panel.": "error.adminSelf",
  "Grimoire needs at least one approved admin.": "error.lastAdmin",
  "No account matches that email or name.": "error.memberNotFound",
  "Several accounts have that name. Use their email instead.": "error.memberAmbiguous",
  "That person is already in this campaign.": "error.alreadyMember",
  "That monster is too large.": "error.monsterTooLarge",
  "Monster not found.": "error.monsterNotFound",
  "Invalid monster identifier.": "error.monsterNotFound",
  "Spell not found.": "error.spellNotFound",
  "Invalid spell identifier.": "error.spellNotFound",
  "Search text is too long.": "error.searchTooLong",
  "Too many items to import at once.": "error.importTooMany",
  "Invalid import, or the data is too large.": "error.importInvalid",
};

/** Messages with a value inside, and the key plus the values they translate to. */
const API_PATTERNS: Array<[RegExp, (match: RegExpMatchArray) => [string, Record<string, string>?]]> = [
  [/^Give the map a name of up to (\d+) characters\.$/, (match) => ["error.mapSaveName", { max: match[1] }]],
  // Open5e failing or answering nonsense (monster-upstream.ts, spells.service.ts, monster-api.ts).
  [/^(The|Could not reach the) (monster|creature|spell) (service|API|index)\b/, () => ["error.bestiaryDown"]],
  [/^The (bestiary|monster index) returned\b/, () => ["error.bestiaryDown"]],
];

/** The text for a status when the message itself isn't one this module knows. */
function statusKey(status: number | undefined): string | null {
  if (status === 401) return "error.signIn";
  if (status === 403) return "error.forbidden";
  if (status === 413) return "error.tooLarge";
  if (status === 429) return "error.tooMany";
  if (status !== undefined && status >= 500) return "error.server";
  return null;
}

/**
 * The text to show for a failed API call (ApiError, MonsterApiError, a fetch TypeError, anything thrown).
 * `fallback` is the caller's own, already translated text for "this action failed"; it wins over the plain
 * per-status texts except where the status says something more useful (signed out, too many tries, server down).
 */
export function apiErrorText(locale: Locale, error: unknown, fallback?: string): string {
  if (isNetworkFailure(error)) return translate(locale, "error.network");
  const found = shape(error);
  const message = text(found.message);
  const known = API_MESSAGES[message];
  if (known) return translate(locale, known);
  for (const [pattern, toKey] of API_PATTERNS) {
    const match = message.match(pattern);
    if (match) { const [key, values] = toKey(match); return translate(locale, key, values); }
  }
  const homebrew = homebrewIssueText(locale, message);
  if (homebrew) return homebrew;
  const status = statusOf(found);
  const byStatus = statusKey(status);
  if (byStatus && (!fallback || status === 401 || status === 429 || (status ?? 0) >= 500)) return translate(locale, byStatus);
  if (fallback) return fallback;
  if (status === 404) return translate(locale, "error.notFound");
  return translate(locale, "error.generic");
}

// ─── Homebrew validation (homebrew.ts writes these in English) ────────────────────────────────────────

const ENTRY_KEYS: Record<string, string> = {
  Trait: "homebrewField.trait", Action: "homebrewField.action", Reaction: "homebrewField.reaction",
  "Legendary action": "homebrewField.legendaryAction", Proficiency: "homebrewField.proficiency",
};
const PART_KEYS: Record<string, string> = { name: "homebrewField.partName", description: "homebrewField.partDescription", "attack bonus": "homebrewField.partAttackBonus" };
const FIELD_KEYS: Record<string, string> = {
  Name: "homebrewField.name", Size: "homebrewField.size", Type: "homebrewField.type", Alignment: "homebrewField.alignment",
  "Armor class": "homebrewField.armorClass", "Armor type": "homebrewField.armorType", "Hit points": "homebrewField.hitPoints",
  "Hit dice": "homebrewField.hitDice", "Passive perception": "homebrewField.passivePerception", Languages: "homebrewField.languages",
  Proficiencies: "homebrewField.proficiencies", "Proficiency name": "homebrewField.proficiencyName", "Proficiency bonus": "homebrewField.proficiencyBonus",
  "Damage vulnerabilities": "homebrewField.damageVulnerabilities", "Damage resistances": "homebrewField.damageResistances",
  "Damage immunities": "homebrewField.damageImmunities", "Condition immunities": "homebrewField.conditionImmunities",
  Traits: "homebrewField.traits", Actions: "homebrewField.actions", Reactions: "homebrewField.reactions", "Legendary actions": "homebrewField.legendaryActions",
};
const ABILITY_KEYS: Record<string, string> = {
  strength: "ability.str", dexterity: "ability.dex", constitution: "ability.con", intelligence: "ability.int", wisdom: "ability.wis", charisma: "ability.cha",
};

/** A field name of homebrew.ts ("Armor class", "Action 2 name", "Ability strength") in the interface language. */
function homebrewField(locale: Locale, field: string): string | null {
  if (FIELD_KEYS[field]) return translate(locale, FIELD_KEYS[field]);
  const ability = field.match(/^Ability (\w+)$/);
  if (ability && ABILITY_KEYS[ability[1]]) return translate(locale, ABILITY_KEYS[ability[1]]);
  if (/^Speed \w+$/.test(field)) return translate(locale, "homebrewField.speed");
  if (/^Sense \w+$/.test(field)) return translate(locale, "homebrewField.senses");
  const entry = field.match(/^(Trait|Action|Reaction|Legendary action|Proficiency) (\d+)(?: (name|description|attack bonus))?$/);
  if (!entry) return null;
  const label = translate(locale, ENTRY_KEYS[entry[1]], { n: entry[2] });
  return entry[3] ? translate(locale, PART_KEYS[entry[3]], { entry: label }) : label;
}

/**
 * A validation message of parseHomebrewInput, translated; null when it isn't one. The messages that only a
 * hand-made request can trigger (wrong JSON types, unknown visibility) all read as "some details aren't valid".
 */
export function homebrewIssueText(locale: Locale, message: string): string | null {
  if (message.startsWith("Challenge rating must be")) return translate(locale, "homebrewIssue.rating");
  if (message === "Pick at least one campaign to share with.") return translate(locale, "homebrewIssue.noCampaign");
  if (message === "The stat block is too large.") return translate(locale, "error.monsterTooLarge");
  if (message.startsWith("Visibility must be") || message.startsWith("campaignIds must be")) return translate(locale, "error.invalid");
  const rules: Array<[RegExp, string]> = [
    [/^(.+) is required\.$/, "homebrewIssue.required"],
    [/^(.+) is too long \(max (\d+)\)\.$/, "homebrewIssue.tooLong"],
    [/^(.+) must be a whole number from (-?\d+) to (-?\d+)\.$/, "homebrewIssue.range"],
    [/^(.+) has too many entries \(max (\d+)\)\.$/, "homebrewIssue.tooMany"],
    [/^(.+) must be (text|a list|an object)\.$/, "error.invalid"],
  ];
  for (const [pattern, key] of rules) {
    const match = message.match(pattern);
    if (!match) continue;
    if (key === "error.invalid") return translate(locale, key);
    const field = homebrewField(locale, match[1]);
    if (!field) return translate(locale, "error.invalid");
    return key === "homebrewIssue.range"
      ? translate(locale, key, { field, min: match[2], max: match[3] })
      : translate(locale, key, { field, max: match[2] ?? "" });
  }
  return null;
}

// ─── Backups ──────────────────────────────────────────────────────────────────────────────────────────

const BACKUP_SECTIONS = new Set(["characters", "campaigns", "creatures", "encounters"]);

/** A path of a backup error ("characters", "characters[3]") as words: "personajes", "personaje n.º 4". */
export function backupPathText(locale: Locale, path: string | undefined): string {
  if (!path) return "";
  const item = path.match(/^(\w+)\[(\d+)\]$/);
  if (item && BACKUP_SECTIONS.has(item[1])) return translate(locale, `backupPath.${item[1]}.item`, { n: Number(item[2]) + 1 });
  if (BACKUP_SECTIONS.has(path)) return translate(locale, `backupPath.${path}`);
  return path;
}

// ─── Sign-in and account security (better-auth) ───────────────────────────────────────────────────────

export type AuthErrorKind =
  | "credentials" | "wrongPassword" | "email" | "exists" | "passwordShort" | "passwordLong" | "resetLink" | "reauth" | "blocked"
  | "invalidCode" | "expired" | "tooManyRequests" | "accountLocked" | "twoFactorOff"
  | "passkeyCancelled" | "passkeyExists" | "passkeyUnknown" | "passkeyFailed";

/** better-auth's error codes (core, two-factor and passkey plugins, plus the WebAuthn browser codes). */
const AUTH_CODES: Record<string, AuthErrorKind> = {
  INVALID_EMAIL_OR_PASSWORD: "credentials", USER_NOT_FOUND: "credentials", CREDENTIAL_ACCOUNT_NOT_FOUND: "credentials",
  INVALID_PASSWORD: "wrongPassword",
  INVALID_EMAIL: "email",
  USER_ALREADY_EXISTS: "exists", USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: "exists",
  PASSWORD_TOO_SHORT: "passwordShort", PASSWORD_TOO_LONG: "passwordLong",
  INVALID_TOKEN: "resetLink", TOKEN_EXPIRED: "resetLink",
  SESSION_EXPIRED: "reauth", SESSION_NOT_FRESH: "reauth",
  // Our own: the session hook of apps/api/src/auth/auth.ts refuses blocked accounts with this code.
  ACCOUNT_BLOCKED: "blocked",
  INVALID_CODE: "invalidCode", INVALID_BACKUP_CODE: "invalidCode", OTP_HAS_EXPIRED: "invalidCode",
  INVALID_TWO_FACTOR_COOKIE: "expired", TOO_MANY_ATTEMPTS_REQUEST_NEW_CODE: "expired",
  ACCOUNT_TEMPORARILY_LOCKED: "accountLocked",
  TWO_FACTOR_NOT_ENABLED: "twoFactorOff", TOTP_NOT_ENABLED: "twoFactorOff",
  AUTH_CANCELLED: "passkeyCancelled", REGISTRATION_CANCELLED: "passkeyCancelled", ERROR_CEREMONY_ABORTED: "passkeyCancelled",
  PREVIOUSLY_REGISTERED: "passkeyExists", ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED: "passkeyExists",
  PASSKEY_NOT_FOUND: "passkeyUnknown", AUTHENTICATION_FAILED: "passkeyUnknown",
};

/** What went wrong with a better-auth call, or null when it's nothing this module recognises. */
export function authErrorKind(error: unknown): AuthErrorKind | null {
  const found = shape(error);
  const code = text(found.code);
  if (AUTH_CODES[code]) return AUTH_CODES[code];
  // Any other WebAuthn failure in the browser (unsupported device, wrong domain, security key error).
  if (code.startsWith("ERROR_") || text(found.name) === "NotAllowedError") return "passkeyFailed";
  return statusOf(found) === 429 ? "tooManyRequests" : null;
}

/** The text to show for a failed better-auth call; `fallback` (already translated) when nothing more precise fits. */
export function authErrorText(locale: Locale, error: unknown, fallback: string): string {
  if (isNetworkFailure(error)) return translate(locale, "error.network");
  const kind = authErrorKind(error);
  if (kind) return translate(locale, `authError.${kind}`);
  return (statusOf(shape(error)) ?? 0) >= 500 ? translate(locale, "error.server") : fallback;
}
