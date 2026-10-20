import { NextResponse } from "next/server";
import { requireApproved } from "@/lib/access";
import { listDirectory } from "@/lib/data";

export const dynamic = "force-dynamic";

/** Approved accounts that a campaign manager can add to a campaign (names only, no emails). */
export async function GET() {
  const user = await requireApproved();
  if (user instanceof NextResponse) return user;
  return NextResponse.json({ users: await listDirectory() });
}
