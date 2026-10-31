/**
 * Fixed-window request limiter kept in this process's memory, no dependencies.
 *
 * Scope: only the data API routes (/api/characters, /api/campaigns (and their battle maps), /api/creatures, /api/homebrew, /api/import), keyed by
 * signed-in user. Sign-in, sign-up and password reset are already limited by better-auth (see `rateLimit`
 * in auth.ts), so they are not repeated here.
 *
 * Multiple instances: counters are per process. Running N replicas behind a load balancer allows up to
 * N times the limits, and a restart resets them. Compose runs one `app` container, so that is exact today;
 * with replicas, move the counters to Redis/Postgres (or enforce limits at the proxy).
 */

export interface RateLimitPolicy {
  /** Counter name; different policies never share a budget. */
  name: string;
  max: number;
  windowMs: number;
}

/** Create/update/delete on characters, campaigns, creatures, homebrew monsters, encounters and roster. */
export const WRITE_LIMIT: RateLimitPolicy = { name: "write", max: 60, windowMs: 60_000 };
/** Moving tokens on a campaign's battle map: a busy combat round sends many small changes. */
export const MAP_LIMIT: RateLimitPolicy = { name: "map", max: 300, windowMs: 60_000 };
/** Opening the live map stream (each reconnect counts). */
export const MAP_STREAM_LIMIT: RateLimitPolicy = { name: "map-stream", max: 30, windowMs: 60_000 };
/** Invite links are bearer tokens for joining a campaign: keep minting them slow. */
export const INVITE_LIMIT: RateLimitPolicy = { name: "invite", max: 10, windowMs: 60_000 };
/** Adding members by email/name tells the caller whether an account exists. */
export const MEMBER_LOOKUP_LIMIT: RateLimitPolicy = { name: "member-lookup", max: 20, windowMs: 60_000 };
/** Bulk import of up to 200+ rows per call. */
export const IMPORT_LIMIT: RateLimitPolicy = { name: "import", max: 5, windowMs: 10 * 60_000 };

const MAX_ENTRIES = 50_000;

export type RateLimitResult = { ok: true } | { ok: false; retryAfterSeconds: number };

export function createRateLimiter(now: () => number = Date.now) {
  const entries = new Map<string, { count: number; resetAt: number }>();

  function prune(at: number) {
    for (const [key, entry] of entries) if (entry.resetAt <= at) entries.delete(key);
    // Still over the cap (many distinct users in one window): drop the oldest-inserted keys.
    for (const key of entries.keys()) {
      if (entries.size <= MAX_ENTRIES) break;
      entries.delete(key);
    }
  }

  return {
    consume(policy: RateLimitPolicy, subject: string): RateLimitResult {
      const at = now();
      const key = `${policy.name}:${subject}`;
      const entry = entries.get(key);
      if (!entry || entry.resetAt <= at) {
        if (entries.size >= MAX_ENTRIES) prune(at);
        entries.set(key, { count: 1, resetAt: at + policy.windowMs });
        return { ok: true };
      }
      if (entry.count >= policy.max) return { ok: false, retryAfterSeconds: Math.max(1, Math.ceil((entry.resetAt - at) / 1000)) };
      entry.count += 1;
      return { ok: true };
    },
    reset: () => entries.clear(),
  };
}

export const rateLimiter = createRateLimiter();
