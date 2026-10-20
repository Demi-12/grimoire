import { NextResponse } from "next/server";
import { requireApproved } from "@/lib/access";
import { listUsersForAdmin } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await requireApproved(["admin"]);
  if (user instanceof NextResponse) return user;
  return NextResponse.json({ users: await listUsersForAdmin() });
}
