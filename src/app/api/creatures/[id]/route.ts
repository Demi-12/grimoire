import { NextResponse } from "next/server";
import { dataErrorResponse, jsonError, requireApproved } from "@/lib/access";
import { deleteCreature } from "@/lib/data";
import { isUuid } from "@/lib/permissions";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export async function DELETE(_request: Request, { params }: Context) {
  const user = await requireApproved();
  if (user instanceof NextResponse) return user;
  const { id } = await params;
  if (!isUuid(id)) return jsonError(404, "Not found.");
  const result = await deleteCreature(user, id);
  return result.ok ? new NextResponse(null, { status: 204 }) : dataErrorResponse(result.error);
}
