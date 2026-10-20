import { NextResponse } from "next/server";
import { getCurrentUser, jsonError } from "@/lib/access";

export const dynamic = "force-dynamic";

/** The signed-in account with its current role and approval status. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return jsonError(401, "Sign in to continue.");
  return NextResponse.json({ user });
}
