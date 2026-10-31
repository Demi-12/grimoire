import "server-only";
import { Client } from "pg";
import { BATTLE_MAP_CHANNEL } from "@/lib/battle-map-data";

/**
 * Fan-out of "this campaign's map changed" to the open map streams of this process.
 *
 * Changes are announced with PostgreSQL NOTIFY (battle-map-data.ts), so every app instance hears them, not
 * only the one that saved the change. One dedicated connection per process LISTENs; it is opened with the
 * first stream and reconnects with backoff. After a reconnect every stream is told to re-read, since
 * notifications sent while the connection was down are lost.
 */
type Listener = () => void;

interface Hub {
  listeners: Map<string, Set<Listener>>;
  client: Client | null;
  connecting: boolean;
  retryMs: number;
}

const globalForHub = globalThis as typeof globalThis & { grimoireMapHub?: Hub };
const hub: Hub = globalForHub.grimoireMapHub ??= { listeners: new Map(), client: null, connecting: false, retryMs: 1_000 };

function notifyAll(campaignId?: string) {
  const targets = campaignId ? [hub.listeners.get(campaignId) ?? new Set<Listener>()] : [...hub.listeners.values()];
  for (const set of targets) for (const listener of set) {
    try { listener(); } catch { /* one broken stream must not stop the others */ }
  }
}

function scheduleReconnect() {
  const wait = hub.retryMs;
  hub.retryMs = Math.min(hub.retryMs * 2, 30_000);
  setTimeout(() => { void connect(); }, wait).unref?.();
}

async function connect() {
  if (hub.client || hub.connecting) return;
  hub.connecting = true;
  const client = new Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5_000 });
  const drop = () => {
    if (hub.client !== client) return;
    hub.client = null;
    client.removeAllListeners();
    client.end().catch(() => undefined);
    scheduleReconnect();
  };
  try {
    await client.connect();
    client.on("notification", (message) => {
      if (message.channel === BATTLE_MAP_CHANNEL && message.payload) notifyAll(message.payload);
    });
    client.on("error", drop);
    client.on("end", drop);
    await client.query(`LISTEN ${BATTLE_MAP_CHANNEL}`);
    const reconnected = hub.retryMs > 1_000;
    hub.client = client;
    hub.retryMs = 1_000;
    if (reconnected) notifyAll();
  } catch {
    client.end().catch(() => undefined);
    scheduleReconnect();
    // Bump the backoff so the next successful connection knows it is a reconnect.
    hub.retryMs = Math.max(hub.retryMs, 2_000);
  } finally {
    hub.connecting = false;
  }
}

/** Call `listener` whenever the campaign's map may have changed. Returns the unsubscribe function. */
export function subscribeToMap(campaignId: string, listener: Listener): () => void {
  void connect();
  let set = hub.listeners.get(campaignId);
  if (!set) hub.listeners.set(campaignId, set = new Set());
  set.add(listener);
  return () => {
    set.delete(listener);
    if (!set.size) hub.listeners.delete(campaignId);
  };
}
