import { NextResponse } from "next/server";
import { jsonError, readJson, requireApproved } from "@/lib/access";
import { applyAdminChange, countApprovedAdmins, deleteUser, readUserForAdmin, revokeUserSessions } from "@/lib/data";
import { checkAdminChange, isAccountStatus, isSiteRole, type AdminChange } from "@/lib/permissions";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

const guardMessages = {
  self: "You can't change or delete your own account from the admin panel.",
  "last-admin": "Grimoire needs at least one approved admin.",
} as const;

/** Change a user's role and/or status, or revoke their sessions with `{ "revokeSessions": true }`. */
export async function PATCH(request: Request, { params }: Context) {
  const user = await requireApproved(["admin"]);
  if (user instanceof NextResponse) return user;
  const { id } = await params;
  const target = await readUserForAdmin(id);
  if (!target) return jsonError(404, "Not found.");
  const body = await readJson(request) as { role?: unknown; status?: unknown; revokeSessions?: unknown } | null;
  if (!body) return jsonError(400, "Invalid change.");

  if (body.revokeSessions === true) {
    if (target.id === user.id) return jsonError(400, guardMessages.self);
    await revokeUserSessions(id);
    return new NextResponse(null, { status: 204 });
  }

  const change: AdminChange = {};
  if (body.role !== undefined) {
    if (!isSiteRole(body.role)) return jsonError(400, "Invalid role.");
    change.role = body.role;
  }
  if (body.status !== undefined) {
    if (!isAccountStatus(body.status)) return jsonError(400, "Invalid status.");
    change.status = body.status;
  }
  if (!change.role && !change.status) return jsonError(400, "Nothing to change.");

  const guard = checkAdminChange(user, target, change, await countApprovedAdmins());
  if (guard) return jsonError(409, guardMessages[guard]);
  await applyAdminChange(id, change);
  return new NextResponse(null, { status: 204 });
}

export async function DELETE(_request: Request, { params }: Context) {
  const user = await requireApproved(["admin"]);
  if (user instanceof NextResponse) return user;
  const { id } = await params;
  const target = await readUserForAdmin(id);
  if (!target) return jsonError(404, "Not found.");
  const guard = checkAdminChange(user, target, "delete", await countApprovedAdmins());
  if (guard) return jsonError(409, guardMessages[guard]);
  await deleteUser(id);
  return new NextResponse(null, { status: 204 });
}
