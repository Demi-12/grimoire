/** /api/spells/:id: the description of one SRD spell. Open and cacheable like the bestiary. */
import { Controller, Get, Param, Res } from "@nestjs/common";
import type { Response } from "express";
import { ApiError } from "../common/api-error.js";
import { upstreamErrorResponse } from "../monsters/monster-upstream.js";
import { SpellsService } from "./spells.service.js";

@Controller("spells")
export class SpellsController {
  constructor(private readonly spells: SpellsService) {}

  @Get(":id")
  async detail(@Param("id") id: string, @Res({ passthrough: true }) response: Response) {
    if (id.length > 80 || !/^[a-z0-9][a-z0-9-]*$/.test(id)) throw new ApiError(400, "Invalid spell identifier.");
    const spell = await this.spells.fetchSpellDetail(id).catch((cause: unknown) => {
      const { error, status } = upstreamErrorResponse(cause);
      throw new ApiError(status, error);
    });
    if (!spell) throw new ApiError(404, "Spell not found.");
    // Set only once there is an answer: an error must not be kept by a shared cache.
    response.setHeader("Cache-Control", "public, s-maxage=86400, stale-while-revalidate=604800");
    return spell;
  }
}
