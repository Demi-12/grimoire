/** /api/creatures: the account's own creature catalog. */
import { Controller, Delete, Get, HttpCode, Param, Post } from "@nestjs/common";
import { parseCreatureInput, type AppUser } from "@grimoire/shared/permissions";
import { ApiError, unwrap } from "../common/api-error.js";
import { Approved, CurrentUser } from "../common/auth.guard.js";
import { JsonBody, UuidParam } from "../common/params.js";
import { RateLimit } from "../common/rate-limit.guard.js";
import { WRITE_LIMIT } from "../common/rate-limit.js";
import { CreaturesService } from "./creatures.service.js";

@Controller("creatures")
@Approved()
export class CreaturesController {
  constructor(private readonly creatures: CreaturesService) {}

  @Get()
  async list(@CurrentUser() user: AppUser) {
    return { creatures: await this.creatures.listCreatures(user) };
  }

  @Post()
  @RateLimit(WRITE_LIMIT)
  async create(@CurrentUser() user: AppUser, @JsonBody() body: unknown) {
    const input = parseCreatureInput(body);
    if (!input) throw new ApiError(400, "Invalid creature.");
    return { creature: unwrap(await this.creatures.createCreature(user, input)) };
  }

  @Delete(":id")
  @HttpCode(204)
  @RateLimit(WRITE_LIMIT)
  async remove(@CurrentUser() user: AppUser, @Param("id", UuidParam) id: string): Promise<void> {
    unwrap(await this.creatures.deleteCreature(user, id));
  }
}
