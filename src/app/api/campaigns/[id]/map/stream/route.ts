import { NextResponse } from "next/server";
import { dataErrorResponse, jsonError, requireUser, rateLimit } from "@/lib/access";
import { MAP_STREAM_LIMIT } from "@/lib/rate-limit";
import { readBattleMap, type MapAudience } from "@/lib/battle-map-data";
import { subscribeToMap } from "@/lib/battle-map-hub";
import { isUuid } from "@/lib/permissions";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

/** Comment lines keep proxies (Cloudflare closes idle connections after ~100 s) from dropping the stream. */
const HEARTBEAT_MS = 25_000;
/** Re-read now and then anyway, so a lost notification or a roster change shows up without a reload. */
const RESYNC_MS = 60_000;

/**
 * Server-Sent Events with the campaign's map: one `map` event on connect and another after every change.
 * Membership is checked again on each read, so someone taken out of the campaign stops receiving it.
 */
export async function GET(request: Request, { params }: Context) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const limited = rateLimit(user, MAP_STREAM_LIMIT);
  if (limited) return limited;
  const { id } = await params;
  if (!isUuid(id)) return jsonError(404, "Not found.");
  const audience: MapAudience = new URL(request.url).searchParams.get("audience") === "players" ? "players" : "auto";
  const first = await readBattleMap(user, id, audience);
  if (!first.ok) return dataErrorResponse(first.error);

  const encoder = new TextEncoder();
  let cleanup = () => {};
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      let reading = false;
      let again = false;
      let lastSent = "";
      const write = (chunk: string) => {
        if (closed) return;
        try { controller.enqueue(encoder.encode(chunk)); } catch { close(); }
      };
      const sendMap = (map: unknown) => {
        const data = JSON.stringify(map);
        if (data === lastSent) return;
        lastSent = data;
        write(`event: map\ndata: ${data}\n\n`);
      };
      const refresh = async () => {
        if (closed) return;
        if (reading) { again = true; return; }
        reading = true;
        try {
          do {
            again = false;
            const result = await readBattleMap(user, id, audience);
            if (!result.ok) { write("event: gone\ndata: {}\n\n"); close(); return; }
            sendMap(result.value);
          } while (again && !closed);
        } catch {
          // Database hiccup: keep the stream; the next notification or resync tries again.
        } finally {
          reading = false;
        }
      };
      const unsubscribe = subscribeToMap(id, () => { void refresh(); });
      const heartbeat = setInterval(() => write(": ping\n\n"), HEARTBEAT_MS);
      const resync = setInterval(() => { void refresh(); }, RESYNC_MS);
      function close() {
        if (closed) return;
        closed = true;
        unsubscribe();
        clearInterval(heartbeat);
        clearInterval(resync);
        request.signal.removeEventListener("abort", close);
        try { controller.close(); } catch { /* already closed */ }
      }
      cleanup = close;
      request.signal.addEventListener("abort", close);

      write("retry: 3000\n\n");
      sendMap(first.value);
    },
    cancel() { cleanup(); },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      // no-transform stops Next's gzip (and other proxies) from buffering the stream.
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
