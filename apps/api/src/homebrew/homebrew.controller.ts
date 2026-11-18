/** /api/homebrew: homebrew monsters the caller may see; their owner edits them, an admin can lock them. */
import { Controller, Delete, Get, Headers, HttpCode, Injectable, Param, Patch, Post, Put, type PipeTransform } from "@nestjs/common";
import { isHomebrewId, parseHomebrewInput } from "@grimoire/shared/homebrew";
import type { AppUser } from "@grimoire/shared/permissions";
import { ApiError, unwrap } from "../common/api-error.js";
import { Approved, CurrentUser } from "../common/auth.guard.js";
import { JsonBody } from "../common/params.js";
import { RateLimit } from "../common/rate-limit.guard.js";
import { WRITE_LIMIT } from "../common/rate-limit.js";
import { recordEvent } from "../data/analytics-server.js";
import { HomebrewService } from "./homebrew.service.js";

/** A stat block with long descriptions outgrows the default 64 KB of a JSON body. */
const MAX_BODY_BYTES = 100_000;

/** A declared size over the limit gets its own answer, before the body is looked at. */
function refuseOversized(contentLength: string | undefined): void {
  if (Number(contentLength ?? 0) > MAX_BODY_BYTES) throw new ApiError(413, "That monster is too large.");
}

/** `@Param("id", HomebrewIdParam)`: anything that can't be a homebrew id is a 404, like an unknown monster. */
@Injectable()
class HomebrewIdParam implements PipeTransform<string, string> {
  transform(value: string): string {
    if (!isHomebrewId(value)) throw new ApiError(404, "Not found.");
    return value;
  }
}

@Controller("homebrew")
@Approved()
export class HomebrewController {
  constructor(private readonly homebrew: HomebrewService) {}

  @Get()
  async list(@CurrentUser() user: AppUser) {
    return { monsters: await this.homebrew.listHomebrew(user) };
  }

  @Post()
  @RateLimit(WRITE_LIMIT)
  async create(@CurrentUser() user: AppUser, @Headers("content-length") contentLength: string | undefined, @JsonBody(MAX_BODY_BYTES) body: unknown) {
    refuseOversized(contentLength);
    const parsed = parseHomebrewInput(body);
    if (!parsed.ok) throw new ApiError(400, parsed.error);
    const monster = unwrap(await this.homebrew.createHomebrew(user, parsed.value, parsed.summary));
    await recordEvent(user.id, "homebrew.created");
    return { monster };
  }

  @Get(":id")
  async read(@CurrentUser() user: AppUser, @Param("id", HomebrewIdParam) id: string) {
    const monster = await this.homebrew.readHomebrewForUser(user, id);
    if (!monster) throw new ApiError(404, "Not found.");
    return { monster };
  }

  @Put(":id")
  @RateLimit(WRITE_LIMIT)
  async update(
    @CurrentUser() user: AppUser, @Param("id", HomebrewIdParam) id: string,
    @Headers("content-length") contentLength: string | undefined, @JsonBody(MAX_BODY_BYTES) body: unknown,
  ) {
    refuseOversized(contentLength);
    const parsed = parseHomebrewInput(body);
    if (!parsed.ok) throw new ApiError(400, parsed.error);
    return { monster: unwrap(await this.homebrew.updateHomebrew(user, id, parsed.value, parsed.summary)) };
  }

  /** Admin moderation: `{ "locked": true }` pulls a published monster back to private and blocks republishing. */
  @Patch(":id")
  @Approved("admin")
  @RateLimit(WRITE_LIMIT)
  async lock(@CurrentUser() user: AppUser, @Param("id", HomebrewIdParam) id: string, @JsonBody() body: unknown) {
    if (!body || typeof body !== "object" || typeof (body as { locked?: unknown }).locked !== "boolean") throw new ApiError(400, "Expected { locked: boolean }.");
    return { monster: unwrap(await this.homebrew.setHomebrewLocked(user, id, (body as { locked: boolean }).locked)) };
  }

  @Delete(":id")
  @HttpCode(204)
  @RateLimit(WRITE_LIMIT)
  async remove(@CurrentUser() user: AppUser, @Param("id", HomebrewIdParam) id: string): Promise<void> {
    unwrap(await this.homebrew.deleteHomebrew(user, id));
  }
}
