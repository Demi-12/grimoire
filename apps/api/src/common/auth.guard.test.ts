import type { AppUser } from "@grimoire/shared/permissions";
import { describe, expect, it, vi } from "vitest";
import type { AppRequest } from "./current-user.js";

// Only the database edge is replaced: who the request's session belongs to.
const signedIn = vi.hoisted(() => ({ user: null as AppUser | null }));
vi.mock("./current-user.js", () => ({ getCurrentUser: vi.fn(async () => signedIn.user) }));

const { requireApproved } = await import("./auth.guard.js");

const request = {} as AppRequest;
const account = (status: AppUser["status"], role: AppUser["role"] = "user"): AppUser =>
  ({ id: "user-1", name: "Test", email: "test@example.invalid", role, status });

/** The status and message the request is turned away with, or the account it lets through. */
async function outcome(roles?: AppUser["role"][]): Promise<AppUser | { status: number; body: unknown }> {
  try {
    return await requireApproved(request, roles);
  } catch (error) {
    const thrown = error as { getStatus(): number; getResponse(): unknown };
    return { status: thrown.getStatus(), body: thrown.getResponse() };
  }
}

describe("requireApproved", () => {
  it("turns away a request without a session with 401", async () => {
    signedIn.user = null;
    expect(await outcome()).toEqual({ status: 401, body: { error: "Sign in to continue." } });
  });

  it("turns away pending and blocked accounts with 403, each with its own message", async () => {
    signedIn.user = account("pending");
    expect(await outcome()).toEqual({ status: 403, body: { error: "Your account is waiting for approval." } });
    signedIn.user = account("blocked", "admin");
    expect(await outcome(["admin"])).toEqual({ status: 403, body: { error: "Your account has been blocked." } });
  });

  it("lets an approved account through, and checks the role only when roles are given", async () => {
    signedIn.user = account("approved");
    expect(await outcome()).toBe(signedIn.user);
    expect(await outcome([])).toBe(signedIn.user);
    expect(await outcome(["admin"])).toEqual({ status: 403, body: { error: "You don't have permission for that." } });
    signedIn.user = account("approved", "admin");
    expect(await outcome(["admin"])).toBe(signedIn.user);
  });
});
