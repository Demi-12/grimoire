/**
 * When each campaign's battle map was last opened in this browser, so the map picker and the
 * "Battle map" shortcut can put the table the person was at first. A per-browser convenience only:
 * when storage is unavailable everything still works, just in the campaigns' own order.
 */
const key = "grimoire.lastMaps.v1";

export function readLastMaps(): Record<string, number> {
  try {
    const saved = JSON.parse(window.localStorage.getItem(key) ?? "{}") as unknown;
    if (!saved || typeof saved !== "object" || Array.isArray(saved)) return {};
    return Object.fromEntries(Object.entries(saved).filter((entry): entry is [string, number] => typeof entry[1] === "number"));
  } catch {
    return {};
  }
}

export function rememberMap(campaignId: string, now = Date.now()) {
  try {
    window.localStorage.setItem(key, JSON.stringify({ ...readLastMaps(), [campaignId]: now }));
  } catch {
    // Storage disabled: the picker falls back to the campaigns' order.
  }
}

/** The campaigns sorted with the most recently opened map first; the rest keep their order. */
export function byLastMap<T extends { id: string }>(campaigns: T[], lastMaps: Record<string, number>): T[] {
  return campaigns
    .map((campaign, index) => ({ campaign, index }))
    .sort((a, b) => (lastMaps[b.campaign.id] ?? 0) - (lastMaps[a.campaign.id] ?? 0) || a.index - b.index)
    .map(({ campaign }) => campaign);
}
