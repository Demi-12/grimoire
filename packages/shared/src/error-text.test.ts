import { describe, expect, it } from "vitest";
import { backupSections } from "./backup.js";
import { apiErrorText, authErrorKind, authErrorText, backupPathText, homebrewIssueText } from "./error-text.js";
import { parseHomebrewInput } from "./homebrew.js";
import { translate } from "./i18n.js";

const FALLBACK = "«fallback»";

describe("apiErrorText", () => {
  it("translates the API's known messages", () => {
    expect(apiErrorText("es", { status: 404, message: "Not found." })).toBe(translate("es", "error.notFound"));
    expect(apiErrorText("es", { status: 409, message: "That person is already in this campaign." }, FALLBACK)).toBe("Esa persona ya está en la campaña.");
    expect(apiErrorText("en", { status: 409, message: "Grimoire needs at least one approved admin." }, FALLBACK)).toBe("Grimoire needs at least one approved admin.");
    expect(apiErrorText("es", { status: 400, message: "Give the map a name of up to 60 characters." })).toBe("Ponle al mapa un nombre de hasta 60 caracteres.");
    expect(apiErrorText("es", { status: 502, message: "Could not reach the monster service. Check the server's internet connection." })).toBe(translate("es", "error.bestiaryDown"));
  });

  it("never shows an unknown message: the caller's fallback, or a text for the status", () => {
    expect(apiErrorText("es", { status: 400, message: "Expected { locked: boolean }." }, FALLBACK)).toBe(FALLBACK);
    expect(apiErrorText("en", { status: 400, message: "Bad Request" })).toBe(translate("en", "error.generic"));
    expect(apiErrorText("es", { status: 404, message: "Cannot GET /api/x" })).toBe(translate("es", "error.notFound"));
    expect(apiErrorText("es", new Error("boom"), FALLBACK)).toBe(FALLBACK);
    expect(apiErrorText("es", "boom")).toBe(translate("es", "error.generic"));
  });

  it("lets the status speak when it says more than the fallback", () => {
    expect(apiErrorText("es", { status: 429, message: "slow down" }, FALLBACK)).toBe(translate("es", "error.tooMany"));
    expect(apiErrorText("es", { status: 503, message: "Service Unavailable" }, FALLBACK)).toBe(translate("es", "error.server"));
    expect(apiErrorText("es", { status: 401, message: "Unauthorized" }, FALLBACK)).toBe(translate("es", "error.signIn"));
    expect(apiErrorText("es", { status: 403, message: "Forbidden" }, FALLBACK)).toBe(FALLBACK);
  });

  it("explains a dropped connection", () => {
    expect(apiErrorText("es", new TypeError("Failed to fetch"), FALLBACK)).toBe(translate("es", "error.network"));
    expect(apiErrorText("en", new TypeError("NetworkError when attempting to fetch resource."))).toBe(translate("en", "error.network"));
  });
});

describe("homebrewIssueText", () => {
  const block = {
    name: "Ash Drake", armor_class: 15, hit_points: 52, challenge_rating: 3,
    strength: 16, dexterity: 12, constitution: 17, intelligence: 6, wisdom: 12, charisma: 8,
  };
  const failure = (statBlock: Record<string, unknown>, extra: Record<string, unknown> = {}) => {
    const parsed = parseHomebrewInput({ statBlock: { ...block, ...statBlock }, ...extra });
    if (parsed.ok) throw new Error("expected a validation error");
    return parsed.error;
  };

  it("translates what parseHomebrewInput actually says, field names included", () => {
    expect(homebrewIssueText("es", failure({ name: " " }))).toBe("Rellena «Nombre».");
    expect(homebrewIssueText("es", failure({ hit_points: 0 }))).toBe("«Puntos de golpe» debe ser un número entero entre 1 y 10000.");
    expect(homebrewIssueText("es", failure({ wisdom: undefined }))).toBe("Rellena «Sabiduría».");
    expect(homebrewIssueText("es", failure({ actions: [{ name: "Bite" }, { name: "" }] }))).toBe("Rellena «Acción 2 · nombre».");
    expect(homebrewIssueText("en", failure({ special_abilities: [{ name: "x".repeat(81) }] }))).toBe("“Trait 1 · name” is too long (max 80 characters).");
    expect(homebrewIssueText("es", failure({ challenge_rating: 0.3 }))).toBe(translate("es", "homebrewIssue.rating"));
    expect(homebrewIssueText("es", failure({}, { visibility: "campaign", campaignIds: [] }))).toBe(translate("es", "homebrewIssue.noCampaign"));
    expect(homebrewIssueText("es", failure({ speed: { walk: "x".repeat(21) } }))).toBe("«Velocidad» es demasiado largo (máximo 20 caracteres).");
  });

  it("reads requests no form can send as plain invalid data", () => {
    expect(homebrewIssueText("es", failure({ name: 5 }))).toBe(translate("es", "error.invalid"));
    expect(homebrewIssueText("es", failure({}, { visibility: "public" }))).toBe(translate("es", "error.invalid"));
    expect(homebrewIssueText("es", "Something else.")).toBeNull();
  });
});

describe("backupPathText", () => {
  it("names every backup section and item in words", () => {
    for (const section of backupSections) {
      expect(backupPathText("es", section.key)).not.toBe(section.key);
      expect(backupPathText("en", `${section.key}[0]`)).toMatch(/#1$/);
    }
    expect(backupPathText("es", "characters[3]")).toBe("personaje n.º 4");
    expect(backupPathText("es", undefined)).toBe("");
  });
});

describe("authErrorText", () => {
  it("translates better-auth's codes instead of showing its English message", () => {
    const signIn = { code: "INVALID_EMAIL_OR_PASSWORD", message: "Invalid email or password", status: 401 };
    expect(authErrorText("es", signIn, FALLBACK)).toBe("El correo o la contraseña no son correctos.");
    expect(authErrorText("en", signIn, FALLBACK)).toBe("The email or password is incorrect.");
    expect(authErrorText("es", { code: "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL", status: 422 }, FALLBACK)).toBe(translate("es", "authError.exists"));
    expect(authErrorText("es", { code: "ACCOUNT_BLOCKED", status: 403 }, FALLBACK)).toBe(translate("es", "authError.blocked"));
    expect(authErrorText("es", { code: "AUTH_CANCELLED", message: "Auth cancelled", status: 400 }, FALLBACK)).toBe(translate("es", "authError.passkeyCancelled"));
  });

  it("covers the browser's WebAuthn failures, rate limits and dropped connections", () => {
    expect(authErrorKind({ code: "ERROR_INVALID_RP_ID", message: "The RP ID is invalid for this domain" })).toBe("passkeyFailed");
    expect(authErrorKind({ status: 429, message: "Too many requests. Please try again later." })).toBe("tooManyRequests");
    expect(authErrorText("es", new TypeError("Failed to fetch"), FALLBACK)).toBe(translate("es", "error.network"));
  });

  it("keeps the 2FA states the sign-in flow acts on", () => {
    expect(authErrorKind({ code: "INVALID_TWO_FACTOR_COOKIE" })).toBe("expired");
    expect(authErrorKind({ code: "INVALID_BACKUP_CODE" })).toBe("invalidCode");
    expect(authErrorKind({ code: "ACCOUNT_TEMPORARILY_LOCKED" })).toBe("accountLocked");
  });

  it("falls back instead of showing anything it doesn't know", () => {
    expect(authErrorText("es", { code: "FAILED_TO_CREATE_USER", message: "Failed to create user", status: 422 }, FALLBACK)).toBe(FALLBACK);
    expect(authErrorText("es", { message: "Internal Server Error", status: 500 }, FALLBACK)).toBe(translate("es", "error.server"));
  });

  it("has a text in both languages for every kind", () => {
    const kinds = ["credentials", "wrongPassword", "email", "exists", "passwordShort", "passwordLong", "resetLink", "reauth", "blocked", "invalidCode",
      "expired", "tooManyRequests", "accountLocked", "twoFactorOff", "passkeyCancelled", "passkeyExists", "passkeyUnknown", "passkeyFailed"];
    for (const kind of kinds) for (const locale of ["es", "en"] as const) expect(translate(locale, `authError.${kind}`)).not.toBe(`authError.${kind}`);
  });
});
