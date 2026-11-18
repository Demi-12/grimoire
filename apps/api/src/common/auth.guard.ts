/**
 * Access control for controllers, as decorators:
 *
 *   @Approved()            an approved account (the normal case for every data route)
 *   @Approved("admin")     an approved account with one of these site roles
 *   @SignedIn()            any signed-in account, even one still waiting for approval (/api/me)
 *   @CurrentUser() user    the account the guard resolved, as a handler parameter
 *
 * DM and player are per campaign, not per account: the data layer checks those against the campaign.
 */
import {
  applyDecorators, createParamDecorator, Injectable, SetMetadata, UseGuards, type CanActivate, type ExecutionContext,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { AppUser, SiteRole } from "@grimoire/shared/permissions";
import { ApiError } from "./api-error.js";
import { getCurrentUser, type AppRequest } from "./current-user.js";

const ROLES_KEY = "grimoire:roles";

/** Lets through any signed-in account, whatever its approval status. */
@Injectable()
export class SignedInGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const user = await getCurrentUser(context.switchToHttp().getRequest<AppRequest>());
    if (!user) throw new ApiError(401, "Sign in to continue.");
    return true;
  }
}

/** Lets through approved accounts only, optionally limited to the roles given to `@Approved(...)`. */
@Injectable()
export class ApprovedGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const roles = this.reflector.getAllAndOverride<SiteRole[] | undefined>(ROLES_KEY, [context.getHandler(), context.getClass()]);
    await requireApproved(context.switchToHttp().getRequest<AppRequest>(), roles);
    return true;
  }
}

/**
 * The approved account behind a request (optionally with one of `roles`), or the 401/403 it is turned away
 * with. What `@Approved()` runs; call it directly only where a route needs an account on one of its branches.
 */
export async function requireApproved(request: AppRequest, roles?: SiteRole[]): Promise<AppUser> {
  const user = await getCurrentUser(request);
  if (!user) throw new ApiError(401, "Sign in to continue.");
  if (user.status === "pending") throw new ApiError(403, "Your account is waiting for approval.");
  if (user.status !== "approved") throw new ApiError(403, "Your account has been blocked.");
  if (roles?.length && !roles.includes(user.role)) throw new ApiError(403, "You don't have permission for that.");
  return user;
}

/** Require an approved account (optionally with one of `roles`) for a controller or a handler. */
export const Approved = (...roles: SiteRole[]) => applyDecorators(SetMetadata(ROLES_KEY, roles), UseGuards(ApprovedGuard));

/** Require a signed-in account, approved or not. */
export const SignedIn = () => applyDecorators(UseGuards(SignedInGuard));

/** The account resolved by `@Approved()` / `@SignedIn()`. */
export const CurrentUser = createParamDecorator((_data: unknown, context: ExecutionContext): AppUser => {
  const user = context.switchToHttp().getRequest<AppRequest>().grimoireUser;
  // Reaching a handler without a guard is a wiring mistake, not something a caller can trigger.
  if (!user) throw new ApiError(401, "Sign in to continue.");
  return user;
});
