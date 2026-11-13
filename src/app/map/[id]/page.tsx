import type { Metadata } from "next";
import BattleMap from "@/components/battle-map";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Battle map · Grimoire" };

/**
 * A campaign's live battle map. It has its own page (outside the toolkit shell) so it can fill the screen
 * of a tablet or TV in the middle of the table, and each player can open the same link on their phone.
 */
export default async function MapPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <BattleMap campaignId={id} />;
}
