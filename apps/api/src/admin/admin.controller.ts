/** /api/admin: the admin panel's accounts (approve, block, promote, sign out, delete) and the usage dashboard. */
import { Controller, Delete, Get, HttpCode, Param, Patch } from "@nestjs/common";
import { parseRange, parseTimeZone } from "@grimoire/shared/analytics";
import { checkAdminChange, isAccountStatus, isSiteRole, type AdminChange, type AppUser } from "@grimoire/shared/permissions";
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
  async change(@CurrentUser() user: AppUser, @Param("id") id: string, @JsonBody() raw: unknown): Promise<void> {
    const target = await this.admin.readUserForAdmin(id);
    if (!target) throw new ApiError(404, "Not found.");
    const body = raw as { role?: unknown; status?: unknown; revokeSessions?: unknown } | null;
    if (!body) throw new ApiError(400, "Invalid change.");

    if (body.revokeSessions === true) {
      if (target.id === user.id) throw new ApiError(400, guardMessages.self);
      await this.admin.revokeUserSessions(id);
      return;
    }

    const change: AdminChange = {};
    if (body.role !== undefined) {
      if (!isSiteRole(body.role)) throw new ApiError(400, "Invalid role.");
      change.role = body.role;
    }
    if (body.status !== undefined) {
      if (!isAccountStatus(body.status)) throw new ApiError(400, "Invalid status.");
      change.status = body.status;
    }
    if (!change.role && !change.status) throw new ApiError(400, "Nothing to change.");

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
