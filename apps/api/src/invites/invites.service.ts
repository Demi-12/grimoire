/** Invite links from the invitee's side: what a link points at, and joining its campaign. */
import { Injectable } from "@nestjs/common";
import type { AppUser } from "@grimoire/shared/permissions";
import { fail, type DataResult } from "../common/data-result.js";
import { pool } from "../database/db.js";

export interface InvitePreview { campaignId: string; campaignName: string; description: string; ownerName: string; alreadyMember: boolean }

@Injectable()
export class InvitesService {
  /** What an invite link points at, or null when the link is unknown, expired or revoked. */
  async readInvite(user: AppUser, token: string): Promise<InvitePreview | null> {
    const result = await pool.query<{ campaignId: string; campaignName: string; description: string; ownerName: string; alreadyMember: boolean }>(
      `SELECT k."id" AS "campaignId", k."name" AS "campaignName", k."description", o."name" AS "ownerName",
              EXISTS (SELECT 1 FROM "campaign_member" m WHERE m."campaignId" = k."id" AND m."userId" = $2) AS "alreadyMember"
         FROM "campaign_invite" i
         JOIN "campaign" k ON k."id" = i."campaignId"
         JOIN "user" o ON o."id" = k."ownerId"
        WHERE i."token" = $1 AND i."expiresAt" > now()`,
      [token, user.id],
    );
    return result.rows[0] ?? null;
  }

  /** Join the invite's campaign as a player; existing members keep their current role. */
  async acceptInvite(user: AppUser, token: string): Promise<DataResult<{ campaignId: string; joined: boolean }>> {
    const invite = await this.readInvite(user, token);
    if (!invite) return fail("not-found");
    const inserted = await pool.query(
      'INSERT INTO "campaign_member" ("campaignId", "userId", "role") VALUES ($1, $2, \'player\') ON CONFLICT ("campaignId", "userId") DO NOTHING',
      [invite.campaignId, user.id],
    );
    // `joined` is false when the account was already a member (the insert did nothing).
    return { ok: true, value: { campaignId: invite.campaignId, joined: (inserted.rowCount ?? 0) > 0 } };
  }
}
