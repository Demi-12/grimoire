/**
 * /api/campaigns: campaigns and what hangs directly off one: its roster, its invite links and taking a
 * character out. The encounter journal has its own controller next to this one; the map lives in map/.
 */
import { Controller, Delete, Get, HttpCode, Param, Patch, Post, Res } from "@nestjs/common";
import type { Response } from "express";
import { isAccountId, parseCampaignInput, parseMemberRequest, type AppUser } from "@grimoire/shared/permissions";
import { ApiError, dataError, unwrap } from "../common/api-error.js";
import { Approved, CurrentUser } from "../common/auth.guard.js";
import { JsonBody, UuidParam } from "../common/params.js";
import { RateLimit } from "../common/rate-limit.guard.js";
import { INVITE_LIMIT, MEMBER_LOOKUP_LIMIT, WRITE_LIMIT } from "../common/rate-limit.js";
import { recordEvent } from "../data/analytics-server.js";
import { CampaignsService } from "./campaigns.service.js";

const addMessages = {
  "no-user": [404, "No account matches that email or name."],
  ambiguous: [409, "Several accounts have that name. Use their email instead."],
  "already-member": [409, "That person is already in this campaign."],
} as const;

@Controller("campaigns")
@Approved()
export class CampaignsController {
  constructor(private readonly campaigns: CampaignsService) {}

  @Get()
  async list(@CurrentUser() user: AppUser) {
    return { campaigns: await this.campaigns.listCampaigns(user) };
  }

  @Post()
  @RateLimit(WRITE_LIMIT)
  async create(@CurrentUser() user: AppUser, @JsonBody() body: unknown) {
    const input = parseCampaignInput(body);
    if (!input) throw new ApiError(400, "Invalid campaign.");
    const campaign = unwrap(await this.campaigns.createCampaign(user, input));
    await recordEvent(user.id, "campaign.created");
    return { campaign };
  }

  @Patch(":id")
  @HttpCode(204)
  @RateLimit(WRITE_LIMIT)
  async update(@CurrentUser() user: AppUser, @Param("id", UuidParam) id: string, @JsonBody() body: unknown): Promise<void> {
    const input = parseCampaignInput(body);
    if (!input) throw new ApiError(400, "Invalid campaign.");
    unwrap(await this.campaigns.updateCampaign(user, id, input));
  }

  @Delete(":id")
  @HttpCode(204)
  @RateLimit(WRITE_LIMIT)
  async remove(@CurrentUser() user: AppUser, @Param("id", UuidParam) id: string): Promise<void> {
    unwrap(await this.campaigns.deleteCampaign(user, id));
  }

  /**
   * Add an account by exact email or name (`{ query, role }`), or change a member's role (`{ userId, role }`).
   * The two answer with different statuses (201 with the name, 204), so the response is written by hand.
   */
  @Post(":id/members")
  @RateLimit(MEMBER_LOOKUP_LIMIT)
  async addOrChangeMember(@CurrentUser() user: AppUser, @Param("id", UuidParam) id: string, @JsonBody() body: unknown, @Res() response: Response): Promise<void> {
    const member = parseMemberRequest(body);
    if (!member) throw new ApiError(400, "Invalid member.");

    if (member.kind === "add") {
      const added = await this.campaigns.addCampaignMemberByQuery(user, id, member.query, member.role);
      if (!added.ok) {
        if (added.error === "no-user" || added.error === "ambiguous" || added.error === "already-member") {
          const [status, message] = addMessages[added.error];
          throw new ApiError(status, message);
        }
        throw dataError(added.error);
      }
      await recordEvent(user.id, "campaign.joined", { via: "added" });
      response.status(201).json({ name: added.value.name });
      return;
    }

    unwrap(await this.campaigns.setCampaignMemberRole(user, id, member.userId, member.role));
    response.status(204).end();
  }

  /** Remove a member (managers) or leave the campaign (the member themselves). */
  @Delete(":id/members/:userId")
  @HttpCode(204)
  @RateLimit(WRITE_LIMIT)
  async removeMember(@CurrentUser() user: AppUser, @Param("id", UuidParam) id: string, @Param("userId") userId: string): Promise<void> {
    if (!isAccountId(userId)) throw new ApiError(404, "Not found.");
    unwrap(await this.campaigns.removeCampaignMember(user, id, userId));
  }

  /** Live invite links of the campaign (managers only). */
  @Get(":id/invites")
  async invites(@CurrentUser() user: AppUser, @Param("id", UuidParam) id: string) {
    return { invites: unwrap(await this.campaigns.listCampaignInvites(user, id)) };
  }

  /** Create a new invite link (managers only). */
  @Post(":id/invites")
  @RateLimit(INVITE_LIMIT)
  async createInvite(@CurrentUser() user: AppUser, @Param("id", UuidParam) id: string) {
    return { invite: unwrap(await this.campaigns.createCampaignInvite(user, id)) };
  }

  /** Revoke an invite link so it stops working immediately. */
  @Delete(":id/invites/:inviteId")
  @HttpCode(204)
  @RateLimit(WRITE_LIMIT)
  async revokeInvite(@CurrentUser() user: AppUser, @Param("id", UuidParam) id: string, @Param("inviteId", UuidParam) inviteId: string): Promise<void> {
    unwrap(await this.campaigns.revokeCampaignInvite(user, id, inviteId));
  }

  /** Take a character out of the campaign without deleting it. */
  @Delete(":id/characters/:characterId")
  @HttpCode(204)
  @RateLimit(WRITE_LIMIT)
  async removeCharacter(@CurrentUser() user: AppUser, @Param("id", UuidParam) id: string, @Param("characterId", UuidParam) characterId: string): Promise<void> {
    unwrap(await this.campaigns.removeCampaignCharacter(user, id, characterId));
  }
}
