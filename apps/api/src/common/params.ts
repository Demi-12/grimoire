/**
 * Handler parameters shared by every controller:
 *
 *   @JsonBody() body: unknown             the parsed JSON body, or null when it is missing, malformed,
 *   @JsonBody(MAX_BACKUP_BYTES) body      too large or not sent as JSON (the route's parser then rejects it)
 *   @Param("id", UuidParam) id: string    a path id that must be a UUID (otherwise 404, like an unknown row)
 *   @QueryText("page") page: string | null   a query parameter as text: its first value, or null when absent
 */
import { createParamDecorator, Injectable, type ExecutionContext, type PipeTransform } from "@nestjs/common";
import { isUuid } from "@grimoire/shared/permissions";
import { ApiError } from "./api-error.js";
import type { AppRequest } from "./current-user.js";
import { readJsonLimited } from "./request-body.js";

export const JsonBody = createParamDecorator((maxBytes: number | undefined, context: ExecutionContext): Promise<unknown> =>
  readJsonLimited(context.switchToHttp().getRequest<AppRequest>(), maxBytes));

/** The first value of a query parameter, or null when it is absent or not plain text (`?a[b]=1`). */
export function queryText(request: AppRequest, name: string): string | null {
  const value = request.query[name];
  const first = Array.isArray(value) ? value[0] : value;
  return typeof first === "string" ? first : null;
}

export const QueryText = createParamDecorator((name: string, context: ExecutionContext): string | null =>
  queryText(context.switchToHttp().getRequest<AppRequest>(), name));

@Injectable()
export class UuidParam implements PipeTransform<string, string> {
  transform(value: string): string {
    if (!isUuid(value)) throw new ApiError(404, "Not found.");
    return value;
  }
}
