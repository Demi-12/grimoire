/** /api/characters: the caller's characters plus those of the campaigns they belong to. */
import { Controller, Delete, Get, HttpCode, Param, Post, Put } from "@nestjs/common";
import { parseCharacterInput, type AppUser } from "@grimoire/shared/permissions";
import { ApiError, unwrap } from "../common/api-error.js";
import { Approved, CurrentUser } from "../common/auth.guard.js";
import { JsonBody, UuidParam } from "../common/params.js";
import { RateLimit } from "../common/rate-limit.guard.js";
import { WRITE_LIMIT } from "../common/rate-limit.js";
import { recordEvent } from "../data/analytics-server.js";
import { CharactersService } from "./characters.service.js";

@Controller("characters")
@Approved()
export class CharactersController {
  constructor(private readonly characters: CharactersService) {}

  @Get()
  async list(@CurrentUser() user: AppUser) {
    return { characters: await this.characters.listCharacters(user) };
  }

  @Post()
  @RateLimit(WRITE_LIMIT)
  async create(@CurrentUser() user: AppUser, @JsonBody() body: unknown) {
    const input = parseCharacterInput(body);
    if (!input) throw new ApiError(400, "Invalid character.");
    const character = unwrap(await this.characters.createCharacter(user, input));
    await recordEvent(user.id, "character.created", { mode: input.build ? "creator" : "manual", level: input.level });
    return { character };
  }

  @Put(":id")
  @RateLimit(WRITE_LIMIT)
  async update(@CurrentUser() user: AppUser, @Param("id", UuidParam) id: string, @JsonBody() body: unknown) {
    const input = parseCharacterInput(body);
    if (!input) throw new ApiError(400, "Invalid character.");
    return { character: unwrap(await this.characters.updateCharacter(user, id, input)) };
  }

  @Delete(":id")
  @HttpCode(204)
  @RateLimit(WRITE_LIMIT)
  async remove(@CurrentUser() user: AppUser, @Param("id", UuidParam) id: string): Promise<void> {
    unwrap(await this.characters.deleteCharacter(user, id));
    await recordEvent(user.id, "character.deleted");
  }
}
