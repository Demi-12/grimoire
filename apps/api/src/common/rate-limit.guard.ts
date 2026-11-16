/**
 * `@RateLimit(WRITE_LIMIT)` on a handler: counts the request against that policy for the signed-in account
 * and answers 429 with Retry-After once the budget is spent. Put it below `@Approved()` (a controller-level
 * `@Approved()` always runs first), so the account is known. The counters live in rate-limit.ts.
 */
import {
  applyDecorators, Injectable, SetMetadata, UseGuards, type CanActivate, type ExecutionContext,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ApiError } from "./api-error.js";
import { getCurrentUser, type AppRequest } from "./current-user.js";
import { rateLimiter, type RateLimitPolicy } from "./rate-limit.js";

const POLICY_KEY = "grimoire:rate-limit";

/** Count one request against `policy` for `subject`; throws the 429 when it is over the limit. */
export function consumeRateLimit(subject: string, policy: RateLimitPolicy): void {
  const result = rateLimiter.consume(policy, subject);
  if (result.ok) return;
  throw new ApiError(429, "Too many requests. Please wait a moment and try again.", undefined, {}, { "Retry-After": String(result.retryAfterSeconds) });
}

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const policy = this.reflector.get<RateLimitPolicy | undefined>(POLICY_KEY, context.getHandler());
    if (!policy) return true;
    const user = await getCurrentUser(context.switchToHttp().getRequest<AppRequest>());
    // Anonymous callers are turned away by the access guard; nothing to count here.
    if (user) consumeRateLimit(user.id, policy);
    return true;
  }
}

export const RateLimit = (policy: RateLimitPolicy) => applyDecorators(SetMetadata(POLICY_KEY, policy), UseGuards(RateLimitGuard));
