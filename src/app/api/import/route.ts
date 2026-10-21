import { NextResponse } from "next/server";
import { jsonError, readJson, requireUser, rateLimit } from "@/lib/access";
import { IMPORT_LIMIT } from "@/lib/rate-limit";
import { MAX_IMPORT_BYTES } from "@/lib/request-body";
import { importLocalData } from "@/lib/data";
import { parseCampaignInput, parseCharacterInput, parseCreatureInput, type CharacterInput, type CreatureInput } from "@/lib/permissions";

export const dynamic = "force-dynamic";

const MAX_ITEMS = 200;

/** One-time copy of characters/campaigns/creatures saved in the browser into the signed-in account. */
export async function POST(request: Request) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const limited = rateLimit(user, IMPORT_LIMIT);
  if (limited) return limited;
  const body = await readJson(request, MAX_IMPORT_BYTES) as { characters?: unknown; campaigns?: unknown; creatures?: unknown } | null;
  if (!body || !Array.isArray(body.characters) || (body.campaigns !== undefined && !Array.isArray(body.campaigns)) || (body.creatures !== undefined && !Array.isArray(body.creatures))) {
    return jsonError(400, "Invalid import, or the data is too large.");
  }
  if (body.characters.length > MAX_ITEMS || (Array.isArray(body.campaigns) && body.campaigns.length > MAX_ITEMS) || (Array.isArray(body.creatures) && body.creatures.length > 500)) {
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
    if (input) campaigns.push({ ...input, characterIds: Array.isArray(ids) ? ids.slice(0, MAX_ITEMS).filter((id): id is string => typeof id === "string") : [] });
  }

  const creatures: CreatureInput[] = [];
  for (const raw of (body.creatures ?? []) as unknown[]) {
    const input = parseCreatureInput(raw);
    if (input) creatures.push(input);
  }

  const imported = await importLocalData(user, characters, campaigns, creatures);
  return NextResponse.json({ imported });
}
