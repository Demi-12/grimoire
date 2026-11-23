/**
 * /api/monsters: the Open5e bestiary (search, whole catalog, one stat block). Open like the SRD it serves:
 * no account needed, and shared caches may keep the answers. The one exception is a homebrew stat block
 * (`homebrew:<id>`), which is account data.
 */
import { Controller, Get, Param, Req, Res } from "@nestjs/common";
import type { Response } from "express";
import { isHomebrewId, parseHomebrewSlug } from "@grimoire/shared/homebrew";
import { parseMonsterSearch } from "@grimoire/shared/open5e";
import { ApiError } from "../common/api-error.js";
import { requireApproved } from "../common/auth.guard.js";
import type { AppRequest } from "../common/current-user.js";
import { QueryText } from "../common/params.js";
import { HomebrewService } from "../homebrew/homebrew.service.js";
import { upstreamErrorResponse } from "./monster-upstream.js";
import { MonstersService } from "./monsters.service.js";

const SHARED_CACHE = "public, s-maxage=86400, stale-while-revalidate=604800";

/** A failed call to Open5e as the error this API answers with. */
function upstreamFailure(cause: unknown): ApiError {
  const { error, status } = upstreamErrorResponse(cause);
  return new ApiError(status, error);
}

@Controller("monsters")
export class MonstersController {
  constructor(private readonly monsters: MonstersService, private readonly homebrew: HomebrewService) {}

  @Get()
  async search(
    @QueryText("challenge_rating") ratingParam: string | null, @QueryText("source") sourceParam: string | null,
    @QueryText("search") searchParam: string | null, @QueryText("page") pageParam: string | null, @QueryText("limit") limitParam: string | null,
    @Res({ passthrough: true }) response: Response,
  ) {
    const query = parseMonsterSearch({ challenge_rating: ratingParam, source: sourceParam, search: searchParam, page: pageParam, limit: limitParam });
    if (!query.ok) throw new ApiError(400, query.error);
    const found = await this.monsters.search(query.value).catch((cause: unknown) => { throw upstreamFailure(cause); });
    // Set only once there is an answer: an error must not be kept by a shared cache.
    response.setHeader("Cache-Control", SHARED_CACHE);
    return found;
  }

  /** Built at request time; the first call after a restart reads the whole Open5e bestiary. */
  @Get("catalog")
  async catalog(@Res({ passthrough: true }) response: Response) {
    const catalog = await this.monsters.catalog().catch((cause: unknown) => { throw upstreamFailure(cause); });
    response.setHeader("Cache-Control", "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800");
    return catalog;
  }

  @Get(":slug")
  async detail(@Param("slug") slug: string, @Req() request: AppRequest, @Res({ passthrough: true }) response: Response) {
    if (slug.length > 100) throw new ApiError(400, "Invalid monster identifier.");

    // Homebrew monsters are per-account data: signed-in users only, never cached by shared caches.
    const homebrewId = parseHomebrewSlug(slug);
    if (homebrewId !== null) {
      const user = await requireApproved(request);
      if (!isHomebrewId(homebrewId)) throw new ApiError(404, "Monster not found.");
      const monster = await this.homebrew.readHomebrewForUser(user, homebrewId);
      if (!monster) throw new ApiError(404, "Monster not found.");
      response.setHeader("Cache-Control", "private, no-store");
      return { ...monster.statBlock, index: slug, homebrew: { ownerName: monster.ownerName } };
    }

    if (!/^[a-z0-9][a-z0-9_-]*$/i.test(slug)) throw new ApiError(400, "Invalid monster identifier.");

    const monster = await this.monsters.detail(slug).catch((cause: unknown) => { throw upstreamFailure(cause); });
    if (!monster) throw new ApiError(404, "Monster not found.");
    response.setHeader("Cache-Control", SHARED_CACHE);
    return monster;
  }
}
