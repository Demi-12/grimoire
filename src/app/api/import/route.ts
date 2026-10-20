import { NextResponse } from "next/server";
import { jsonError, readJson, requireApproved } from "@/lib/access";
import { importLocalData } from "@/lib/data";
import { parseCampaignInput, parseCharacterInput, type CharacterInput } from "@/lib/permissions";

export const dynamic = "force-dynamic";

const MAX_ITEMS = 200;

/** One-time copy of characters/campaigns saved in the browser into the signed-in account. */
export async function POST(request: Request) {
  const user = await requireApproved();
  if (user instanceof NextResponse) return user;
  const body = await readJson(request) as { characters?: unknown; campaigns?: unknown } | null;
  if (!body || !Array.isArray(body.characters) || (body.campaigns !== undefined && !Array.isArray(body.campaigns))) {
    return jsonError(400, "Invalid import.");
  }
  if (body.characters.length > MAX_ITEMS || (Array.isArray(body.campaigns) && body.campaigns.length > MAX_ITEMS)) {
    return jsonError(413, "Too many items to import at once.");
  }

  const characters: (CharacterInput & { localId: string })[] = [];
  for (const raw of body.characters as unknown[]) {
    const localId = raw && typeof raw === "object" && typeof (raw as { id?: unknown }).id === "string" ? (raw as { id: string }).id : "";
    const input = parseCharacterInput({ ...(raw as object), campaignId: null });
    if (input && localId) characters.push({ ...input, localId });
  }
  const campaigns: { name: string; description: string; characterIds: string[] }[] = [];
  for (const raw of (body.campaigns ?? []) as unknown[]) {
    const input = parseCampaignInput(raw);
    const ids = raw && typeof raw === "object" ? (raw as { characterIds?: unknown }).characterIds : undefined;
    if (input) campaigns.push({ ...input, characterIds: Array.isArray(ids) ? ids.filter((id): id is string => typeof id === "string") : [] });
  }

  const imported = await importLocalData(user, characters, campaigns);
  return NextResponse.json({ imported });
}
