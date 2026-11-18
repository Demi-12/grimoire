/**
 * /api/campaigns/:id/map: the live battle map of a campaign. Any member reads it and sends changes; what a
 * DM alone may do (monsters, background, saved maps, reset) is refused by the rules, not here.
 * `?audience=players` asks for the players' view even as a DM (the table display).
 */
import { Controller, Delete, Get, HttpCode, Param, Post, Put, Req, Res } from "@nestjs/common";
import type { Response } from "express";
import { parseMapOps, sniffImageType } from "@grimoire/shared/battle-map";
import type { AppUser } from "@grimoire/shared/permissions";
import { ApiError, unwrap } from "../common/api-error.js";
import { Approved, CurrentUser } from "../common/auth.guard.js";
import type { AppRequest } from "../common/current-user.js";
import { JsonBody, queryText, UuidParam } from "../common/params.js";
import { RateLimit } from "../common/rate-limit.guard.js";
import { MAP_LIMIT, MAP_STREAM_LIMIT, WRITE_LIMIT } from "../common/rate-limit.js";
import { MAX_IMAGE_BYTES, readBytesLimited } from "../common/request-body.js";
import { subscribeToMap } from "./battle-map-hub.js";
import { openMapStream } from "./map-stream.js";
import { MAP_SAVE_NAME_MAX, MapService, type MapAudience } from "./map.service.js";

/** The audience a map request asks for: `?audience=players`, otherwise "auto". */
const audienceOf = (request: AppRequest): MapAudience => queryText(request, "audience") === "players" ? "players" : "auto";

@Controller("campaigns/:id/map")
@Approved()
export class MapController {
  constructor(private readonly maps: MapService) {}

  /** The campaign's battle map as the caller may see it (any member). */
  @Get()
  async read(@CurrentUser() user: AppUser, @Param("id", UuidParam) id: string, @Req() request: AppRequest) {
    return { map: unwrap(await this.maps.readBattleMap(user, id, audienceOf(request))) };
  }

  /** Apply a batch of changes: `{ ops: [{ type: "move", tokenId, x, y }, …] }`. */
  @Post()
  @HttpCode(200)
  @RateLimit(MAP_LIMIT)
  async change(@CurrentUser() user: AppUser, @Param("id", UuidParam) id: string, @JsonBody() body: unknown, @Req() request: AppRequest) {
    const ops = parseMapOps(body);
    if (!ops) throw new ApiError(400, "Invalid map change.");
    return { map: unwrap(await this.maps.changeBattleMap(user, id, ops, audienceOf(request))) };
  }

  /**
   * Server-Sent Events with the campaign's map: one `map` event on connect and another after every change.
   * Membership is checked again on each read, so someone taken out of the campaign stops receiving it.
   */
  @Get("stream")
  @RateLimit(MAP_STREAM_LIMIT)
  async stream(@CurrentUser() user: AppUser, @Param("id", UuidParam) id: string, @Req() request: AppRequest, @Res() response: Response): Promise<void> {
    const audience = audienceOf(request);
    const first = unwrap(await this.maps.readBattleMap(user, id, audience));

    response.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      // no-transform stops the compression middleware (and other proxies) from buffering the stream.
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });
    response.flushHeaders();
    const close = openMapStream({
      first,
      read: () => this.maps.readBattleMap(user, id, audience),
      subscribe: (listener) => subscribeToMap(id, listener),
      write: (chunk) => {
        if (response.destroyed || response.writableEnded) return false;
        response.write(chunk);
        return true;
      },
      end: () => { response.end(); },
    });
    // The client may have left while the map was being read: its "close" has then already fired.
    if (request.destroyed || response.destroyed) close();
    else request.on("close", close);
  }

  /** The map's background picture (any member). The page asks for it with `?k=<key>`, so a new upload gets a new URL. */
  @Get("background")
  async background(@CurrentUser() user: AppUser, @Param("id", UuidParam) id: string, @Res() response: Response): Promise<void> {
    const picture = unwrap(await this.maps.readBattleMapBackground(user, id));
    if (!picture) throw new ApiError(404, "Not found.");
    response.status(200).set({
      "Content-Type": picture.mimeType,
      "Cache-Control": "private, max-age=86400",
      ETag: `"${picture.key}"`,
      // An uploaded file is only ever a picture: opened on its own, it may load and run nothing.
      "Content-Security-Policy": "default-src 'none'; sandbox",
    });
    // end(), not send(): Express's send() would answer a matching If-None-Match with a 304 of its own.
    response.end(picture.image);
  }

  /** Upload a new background (DMs): the raw PNG, JPEG, WebP or GIF as the request body, up to 5 MB. */
  @Put("background")
  @RateLimit(WRITE_LIMIT)
  async setBackground(@CurrentUser() user: AppUser, @Param("id", UuidParam) id: string, @Req() request: AppRequest) {
    const bytes = await readBytesLimited(request, MAX_IMAGE_BYTES);
    if (!bytes) throw new ApiError(413, "Send a PNG, JPEG, WebP or GIF picture of 5 MB or less.");
    const mimeType = sniffImageType(bytes);
    if (!mimeType) throw new ApiError(415, "Use a PNG, JPEG, WebP or GIF picture.");
    return { map: unwrap(await this.maps.setBattleMapBackground(user, id, { bytes, mimeType }, audienceOf(request))) };
  }

  /** Remove the background (DMs). */
  @Delete("background")
  @RateLimit(WRITE_LIMIT)
  async removeBackground(@CurrentUser() user: AppUser, @Param("id", UuidParam) id: string, @Req() request: AppRequest) {
    return { map: unwrap(await this.maps.setBattleMapBackground(user, id, null, audienceOf(request))) };
  }

  /** Saved maps of the campaign (DMs). */
  @Get("saves")
  async saves(@CurrentUser() user: AppUser, @Param("id", UuidParam) id: string) {
    return { saves: unwrap(await this.maps.listMapSaves(user, id)) };
  }

  /** Save the map as it is now under a name: `{ name }` (DMs). */
  @Post("saves")
  @HttpCode(200)
  @RateLimit(WRITE_LIMIT)
  async save(@CurrentUser() user: AppUser, @Param("id", UuidParam) id: string, @JsonBody() raw: unknown) {
    const body = raw as { name?: unknown } | null;
    const name = typeof body?.name === "string" ? body.name.replace(/\s+/g, " ").trim() : "";
    if (!name || name.length > MAP_SAVE_NAME_MAX) throw new ApiError(400, `Give the map a name of up to ${MAP_SAVE_NAME_MAX} characters.`);
    return { saves: unwrap(await this.maps.createMapSave(user, id, name)) };
  }

  /** Put this saved map on the table, replacing the current one (DMs). */
  @Post("saves/:saveId")
  @HttpCode(200)
  @RateLimit(WRITE_LIMIT)
  async load(@CurrentUser() user: AppUser, @Param("id", UuidParam) id: string, @Param("saveId", UuidParam) saveId: string, @Req() request: AppRequest) {
    return { map: unwrap(await this.maps.loadMapSave(user, id, saveId, audienceOf(request))) };
  }

  /** Delete a saved map (DMs). */
  @Delete("saves/:saveId")
  @RateLimit(WRITE_LIMIT)
  async removeSave(@CurrentUser() user: AppUser, @Param("id", UuidParam) id: string, @Param("saveId", UuidParam) saveId: string) {
    return { saves: unwrap(await this.maps.deleteMapSave(user, id, saveId)) };
  }

  /** Start a new, empty map (DMs). Save the current one first if it should come back. */
  @Post("reset")
  @HttpCode(200)
  @RateLimit(WRITE_LIMIT)
  async reset(@CurrentUser() user: AppUser, @Param("id", UuidParam) id: string, @Req() request: AppRequest) {
    return { map: unwrap(await this.maps.loadMapSave(user, id, null, audienceOf(request))) };
  }
}
