/**
 * The life of one open map stream (Server-Sent Events): a `map` event on connect and another after every
 * change, comment lines that keep proxies from dropping it, and a `gone` event when the viewer loses the
 * campaign. It knows nothing about HTTP or PostgreSQL: the controller hands it how to read the map, how to
 * hear about changes and where to write.
 */

/** Comment lines keep proxies (Cloudflare closes idle connections after ~100 s) from dropping the stream. */
export const HEARTBEAT_MS = 25_000;
/** Re-read now and then anyway, so a lost notification or a roster change shows up without a reload. */
export const RESYNC_MS = 60_000;

export interface MapStreamSource<T> {
  /** The map already read to answer the request. */
  first: T;
  /** The map as the viewer may see it now; not ok once they can't see the campaign any more. */
  read(): Promise<{ ok: true; value: T } | { ok: false }>;
  /** Call `listener` whenever the map may have changed; returns the unsubscribe function. */
  subscribe(listener: () => void): () => void;
  /** Send a chunk to the client; false when the connection is gone. */
  write(chunk: string): boolean;
  /** Finish the response. */
  end(): void;
}

/** Start the stream. Returns the function that stops it and releases everything; calling it twice is fine. */
export function openMapStream<T>(source: MapStreamSource<T>): () => void {
  let closed = false;
  let reading = false;
  let again = false;
  let lastSent = "";
  const write = (chunk: string) => {
    if (closed) return;
    let sent = false;
    try { sent = source.write(chunk); } catch { /* treated like a closed connection */ }
    if (!sent) close();
  };
  const sendMap = (map: T) => {
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
        const result = await source.read();
        if (!result.ok) { write("event: gone\ndata: {}\n\n"); close(); return; }
        sendMap(result.value);
      } while (again && !closed);
    } catch {
      // Database hiccup: keep the stream; the next notification or resync tries again.
    } finally {
      reading = false;
    }
  };
  const unsubscribe = source.subscribe(() => { void refresh(); });
  const heartbeat = setInterval(() => write(": ping\n\n"), HEARTBEAT_MS);
  const resync = setInterval(() => { void refresh(); }, RESYNC_MS);
  function close() {
    if (closed) return;
    closed = true;
    unsubscribe();
    clearInterval(heartbeat);
    clearInterval(resync);
    try { source.end(); } catch { /* already closed */ }
  }

  write("retry: 3000\n\n");
  sendMap(source.first);
  return close;
}
