import { NextResponse } from "next/server";
import { getCurrentUser, jsonError, readJson } from "@/lib/access";
import { readPreferences, updatePreferences } from "@/lib/data";
import { parsePreferencesInput } from "@/lib/permissions";

export const dynamic = "force-dynamic";

/** The signed-in account with its current role, approval status and saved preferences. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return jsonError(401, "Sign in to continue.");
  return NextResponse.json({ user: { ...user, preferences: await readPreferences(user.id) } });
}

/** Save language/theme, or `{ legacyImported: true }` once browser-saved data was dealt with. */
export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user) return jsonError(401, "Sign in to continue.");
  const body = await readJson(request);
  if (body && typeof body === "object" && (body as { legacyImported?: unknown }).legacyImported === true) {
    await updatePreferences(user.id, { legacyImported: true });
    return new NextResponse(null, { status: 204 });
  }
  const input = parsePreferencesInput(body);
  if (!input) return jsonError(400, "Invalid preferences.");
  await updatePreferences(user.id, input);
  return new NextResponse(null, { status: 204 });
}
