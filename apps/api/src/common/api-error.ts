/**
 * The API's error vocabulary. Every failure leaves as `{ error, code? }` JSON with its status; the
 * browser translates or replaces the English message. Nothing here knows about a particular domain.
 */
import { HttpException } from "@nestjs/common";

/** An error response: `throw new ApiError(404, "Not found.")`. `extra` adds fields next to `error`. */
export class ApiError extends HttpException {
  constructor(status: number, error: string, code?: string, extra: Record<string, unknown> = {}, readonly headers: Record<string, string> = {}) {
    super({ error, ...(code ? { code } : {}), ...extra }, status);
  }
}

export type DataError = "not-found" | "forbidden" | "invalid" | "blocked" | "turn" | "movement" | "limit";

/** Map a data-layer failure to the HTTP error it leaves as. */
export function dataError(error: DataError): ApiError {
  if (error === "not-found") return new ApiError(404, "Not found.");
  if (error === "forbidden") return new ApiError(403, "You don't have permission for that.");
  if (error === "blocked") return new ApiError(409, "A wall or a closed door is in the way.", "blocked");
  if (error === "turn") return new ApiError(409, "It isn't this creature's turn.", "turn");
  if (error === "movement") return new ApiError(409, "That's further than this creature can move this turn.", "movement");
  if (error === "limit") return new ApiError(409, "That's the most this campaign can keep.");
  return new ApiError(400, "That change isn't valid.");
}

/** The value of a data-layer result, or its failure thrown as the matching HTTP error. */
export function unwrap<T>(result: { ok: true; value: T } | { ok: false; error: DataError }): T {
  if (!result.ok) throw dataError(result.error);
  return result.value;
}
