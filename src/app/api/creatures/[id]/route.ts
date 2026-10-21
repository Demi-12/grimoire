import { NextResponse } from "next/server";
import { dataErrorResponse, jsonError, requireUser, rateLimit } from "@/lib/access";
import { WRITE_LIMIT } from "@/lib/rate-limit";
import { deleteCreature } from "@/lib/data";
import { isUuid } from "@/lib/permissions";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export async function DELETE(_request: Request, { params }: Context) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const limited = rateLimit(user, WRITE_LIMIT);
  if (limited) return limited;
  const { id } = await params;
  if (!isUuid(id)) return jsonError(404, "Not found.");
  const result = await deleteCreature(user, id);
  return result.ok ? new NextResponse(null, { status: 204 }) : dataErrorResponse(result.error);
}
