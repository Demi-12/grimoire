/** /api/invites/:token: an invite link as the invitee meets it: a preview of the campaign, then joining it. */
import { Controller, Get, HttpCode, Param, Post } from "@nestjs/common";
import { isInviteToken, type AppUser } from "@grimoire/shared/permissions";
import { ApiError, unwrap } from "../common/api-error.js";
import { Approved, CurrentUser } from "../common/auth.guard.js";
import { RateLimit } from "../common/rate-limit.guard.js";
import { WRITE_LIMIT } from "../common/rate-limit.js";
import { recordEvent } from "../data/analytics-server.js";
import { InvitesService } from "./invites.service.js";

@Controller("invites")
@Approved()
export class InvitesController {
  constructor(private readonly invites: InvitesService) {}

  /** Which campaign an invite link opens, so the invitee can confirm before joining. */
  @Get(":token")
  async preview(@CurrentUser() user: AppUser, @Param("token") token: string) {
    if (!isInviteToken(token)) throw new ApiError(404, "Not found.");
    const invite = await this.invites.readInvite(user, token);
    if (!invite) throw new ApiError(404, "Not found.");
    return { invite };
  }

  /** Join the campaign as a player. */
  @Post(":token")
  @HttpCode(200)
  @RateLimit(WRITE_LIMIT)
  async accept(@CurrentUser() user: AppUser, @Param("token") token: string) {
    if (!isInviteToken(token)) throw new ApiError(404, "Not found.");
    const result = unwrap(await this.invites.acceptInvite(user, token));
    if (result.joined) await recordEvent(user.id, "campaign.joined", { via: "invite" });
    return result;
  }
}
