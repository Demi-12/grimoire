import { Controller, Get, HttpCode, Patch } from "@nestjs/common";
import { parsePreferencesInput, type AppUser } from "@grimoire/shared/permissions";
import { ApiError } from "../common/api-error.js";
import { CurrentUser, SignedIn } from "../common/auth.guard.js";
import { JsonBody } from "../common/params.js";
import { RateLimit } from "../common/rate-limit.guard.js";
import { WRITE_LIMIT } from "../common/rate-limit.js";
import { MeService } from "./me.service.js";

/** The signed-in account: open to accounts still waiting for approval, which need to see their own status. */
@Controller("me")
@SignedIn()
export class MeController {
  constructor(private readonly me: MeService) {}

  /** The signed-in account with its current role, approval status and saved preferences. */
  @Get()
  async read(@CurrentUser() user: AppUser) {
    return { user: { ...user, preferences: await this.me.readPreferences(user.id) } };
  }

  /** Save language/theme, or `{ legacyImported: true }` once browser-saved data was dealt with. */
  @Patch()
  @HttpCode(204)
  @RateLimit(WRITE_LIMIT)
  async update(@CurrentUser() user: AppUser, @JsonBody() body: unknown): Promise<void> {
    if (body && typeof body === "object" && (body as { legacyImported?: unknown }).legacyImported === true) {
      await this.me.updatePreferences(user.id, { legacyImported: true });
      return;
    }
    const input = parsePreferencesInput(body);
    if (!input) throw new ApiError(400, "Invalid preferences.");
    await this.me.updatePreferences(user.id, input);
  }
}
