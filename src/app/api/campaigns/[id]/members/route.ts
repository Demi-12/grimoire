import { NextResponse } from "next/server";
import { dataErrorResponse, jsonError, readJson, requireUser, rateLimit } from "@/lib/access";
import { MEMBER_LOOKUP_LIMIT } from "@/lib/rate-limit";
import { addCampaignMemberByQuery, setCampaignMemberRole } from "@/lib/data";
import { isCampaignRole, isUuid } from "@/lib/permissions";

export const dynamic = "force-dynamic";

const addMessages = {
  "no-user": [404, "No account matches that email or name."],
  ambiguous: [409, "Several accounts have that name. Use their email instead."],
  "already-member": [409, "That person is already in this campaign."],
} as const;

/** Add an account by exact email or name (`{ query, role }`), or change a member's role (`{ userId, role }`). */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const limited = rateLimit(user, MEMBER_LOOKUP_LIMIT);
  if (limited) return limited;
  const { id } = await params;
  if (!isUuid(id)) return jsonError(404, "Not found.");
  const body = await readJson(request) as { userId?: unknown; query?: unknown; role?: unknown } | null;
  if (!body || !isCampaignRole(body.role)) return jsonError(400, "Invalid member.");

  if (typeof body.query === "string") {
    const query = body.query.trim();
    if (!query || query.length > 254) return jsonError(400, "Invalid member.");
    const added = await addCampaignMemberByQuery(user, id, query, body.role);
    if (added.ok) return NextResponse.json({ name: added.value.name }, { status: 201 });
    if (added.error in addMessages) {
      const [status, message] = addMessages[added.error as keyof typeof addMessages];
      return jsonError(status, message);
    }
    return dataErrorResponse(added.error as "not-found" | "forbidden" | "invalid");
  }

  if (typeof body.userId !== "string" || !body.userId) return jsonError(400, "Invalid member.");
  const result = await setCampaignMemberRole(user, id, body.userId, body.role);
  return result.ok ? new NextResponse(null, { status: 204 }) : dataErrorResponse(result.error);
}
