/** /api/admin: the admin panel's accounts (approve, block, promote, sign out, delete) and the usage dashboard. */
import { Controller, Delete, Get, HttpCode, Param, Patch } from "@nestjs/common";
import { parseRange, parseTimeZone } from "@grimoire/shared/analytics";
import { checkAdminChange, parseAdminRequest, type AppUser } from "@grimoire/shared/permissions";
import { ApiError } from "../common/api-error.js";
import { Approved, CurrentUser } from "../common/auth.guard.js";
import { JsonBody, QueryText } from "../common/params.js";
import { RateLimit } from "../common/rate-limit.guard.js";
import { WRITE_LIMIT } from "../common/rate-limit.js";
import { countApprovedAdmins } from "./admin-count.js";
import { AdminService } from "./admin.service.js";
import { AnalyticsService } from "./analytics.service.js";

const guardMessages = {
  self: "You can't change or delete your own account from the admin panel.",
  "last-admin": "Grimoire needs at least one approved admin.",
} as const;

@Controller("admin")
@Approved("admin")
export class AdminController {
  constructor(private readonly admin: AdminService, private readonly analytics: AnalyticsService) {}

  @Get("users")
  async users() {
    return { users: await this.admin.listUsersForAdmin() };
  }

  /** Change a user's role and/or status, or revoke their sessions with `{ "revokeSessions": true }`. */
  @Patch("users/:id")
  @HttpCode(204)
  @RateLimit(WRITE_LIMIT)
  async change(@CurrentUser() user: AppUser, @Param("id") id: string, @JsonBody() body: unknown): Promise<void> {
    const target = await this.admin.readUserForAdmin(id);
    if (!target) throw new ApiError(404, "Not found.");
    const request = parseAdminRequest(body);
    if (!request.ok) throw new ApiError(400, request.error);
    if (request.value.kind === "revoke-sessions") {
      if (target.id === user.id) throw new ApiError(400, guardMessages.self);
      await this.admin.revokeUserSessions(id);
      return;
    }

    const { change } = request.value;
    const guard = checkAdminChange(user, target, change, await countApprovedAdmins());
    if (guard) throw new ApiError(409, guardMessages[guard]);
    await this.admin.applyAdminChange(id, change);
  }

  @Delete("users/:id")
  @HttpCode(204)
  @RateLimit(WRITE_LIMIT)
  async remove(@CurrentUser() user: AppUser, @Param("id") id: string): Promise<void> {
    const target = await this.admin.readUserForAdmin(id);
    if (!target) throw new ApiError(404, "Not found.");
    const guard = checkAdminChange(user, target, "delete", await countApprovedAdmins());
    if (guard) throw new ApiError(409, guardMessages[guard]);
    await this.admin.deleteUser(id);
  }

  /** Usage and error figures for the admin dashboard: `?days=7|30|90&tz=Europe/Madrid`. */
  @Get("analytics")
  async report(@QueryText("days") days: string | null, @QueryText("tz") timeZone: string | null) {
    return { report: await this.analytics.buildAnalyticsReport(parseRange(days), parseTimeZone(timeZone)) };
  }
}
