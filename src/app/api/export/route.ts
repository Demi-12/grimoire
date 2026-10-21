import { NextResponse } from "next/server";
import { requireUser } from "@/lib/access";
import { backupFilename } from "@/lib/backup";
import { exportBackup } from "@/lib/backup-data";

export const dynamic = "force-dynamic";

/** Download a JSON backup of the signed-in user's own data (characters, owned campaigns, creatures, encounter journal). */
export async function GET() {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const now = new Date();
  const backup = await exportBackup(user, now);
  return new NextResponse(JSON.stringify(backup, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${backupFilename(now)}"`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
