/** /api/campaigns/:id/encounters: the campaign's encounter journal, for the people who can manage it. */
import { Controller, Delete, Get, HttpCode, Param, Patch, Post } from "@nestjs/common";
import { encounterStatuses, parseEncounterInput, type AppUser, type EncounterStatus } from "@grimoire/shared/permissions";
import { ApiError, unwrap } from "../common/api-error.js";
import { Approved, CurrentUser } from "../common/auth.guard.js";
import { JsonBody, UuidParam } from "../common/params.js";
import { RateLimit } from "../common/rate-limit.guard.js";
import { WRITE_LIMIT } from "../common/rate-limit.js";
import { recordEvent } from "../data/analytics-server.js";
import { EncountersService } from "./encounters.service.js";

@Controller("campaigns/:id/encounters")
@Approved()
export class EncountersController {
  constructor(private readonly encounters: EncountersService) {}

  @Get()
  async list(@CurrentUser() user: AppUser, @Param("id", UuidParam) id: string) {
    return { encounters: unwrap(await this.encounters.listEncounters(user, id)) };
  }

  @Post()
  @RateLimit(WRITE_LIMIT)
  async create(@CurrentUser() user: AppUser, @Param("id", UuidParam) id: string, @JsonBody() body: unknown) {
    const input = parseEncounterInput(body);
    if (!input) throw new ApiError(400, "Invalid encounter.");
    const encounter = unwrap(await this.encounters.createEncounter(user, id, input));
    await recordEvent(user.id, "encounter.saved", { status: encounter.status, difficulty: encounter.difficulty });
    return { encounter };
  }

  /**
   * Edit title, notes or status (planned/played) of a saved encounter. The encounter id alone names it:
   * the service finds its campaign and checks the caller against that one, whatever `:id` says.
   */
  @Patch(":encounterId")
  @RateLimit(WRITE_LIMIT)
  async update(@CurrentUser() user: AppUser, @Param("encounterId", UuidParam) encounterId: string, @JsonBody() raw: unknown) {
    const body = raw as { title?: unknown; notes?: unknown; status?: unknown } | null;
    if (!body || typeof body !== "object") throw new ApiError(400, "Invalid encounter.");
    const title = body.title === undefined ? undefined : typeof body.title === "string" ? body.title.trim() : null;
    const notes = body.notes === undefined ? undefined : typeof body.notes === "string" ? body.notes.trim() : null;
    const status = body.status === undefined ? undefined : encounterStatuses.includes(body.status as EncounterStatus) ? body.status as EncounterStatus : null;
    if (title === null || notes === null || status === null || title === "" || (title?.length ?? 0) > 80 || (notes?.length ?? 0) > 2000
      || (title === undefined && notes === undefined && status === undefined)) throw new ApiError(400, "Invalid encounter.");
    return { encounter: unwrap(await this.encounters.updateEncounter(user, encounterId, { title, notes, status })) };
  }

  @Delete(":encounterId")
  @HttpCode(204)
  @RateLimit(WRITE_LIMIT)
  async remove(@CurrentUser() user: AppUser, @Param("encounterId", UuidParam) encounterId: string): Promise<void> {
    unwrap(await this.encounters.deleteEncounter(user, encounterId));
  }
}
