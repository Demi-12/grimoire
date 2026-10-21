import { NextResponse } from "next/server";
import { dataErrorResponse, jsonError, requireApproved } from "@/lib/access";
import { acceptInvite, readInvite } from "@/lib/data";
import { isInviteToken } from "@/lib/permissions";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ token: string }> };

/** Which campaign an invite link opens, so the invitee can confirm before joining. */
export async function GET(_request: Request, { params }: Context) {
  const user = await requireApproved();
  if (user instanceof NextResponse) return user;
  const { token } = await params;
  if (!isInviteToken(token)) return jsonError(404, "Not found.");
  const invite = await readInvite(user, token);
  return invite ? NextResponse.json({ invite }) : jsonError(404, "Not found.");
}

/** Join the campaign as a player. */
export async function POST(_request: Request, { params }: Context) {
  const user = await requireApproved();
  if (user instanceof NextResponse) return user;
  const { token } = await params;
  if (!isInviteToken(token)) return jsonError(404, "Not found.");
  const result = await acceptInvite(user, token);
  return result.ok ? NextResponse.json(result.value) : dataErrorResponse(result.error);
}
