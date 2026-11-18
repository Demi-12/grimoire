import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HEARTBEAT_MS, openMapStream, RESYNC_MS } from "./map-stream.js";

type Map = { version: number };
type Read = { ok: true; value: Map } | { ok: false };

/** A stream wired to an in-memory client: what was written, whether it ended, and a way to announce changes. */
function harness(first: Map) {
  const written: string[] = [];
  const state = { ended: 0, subscribed: 0, connected: true, next: { ok: true, value: first } as Read | Error };
  let listener: (() => void) | undefined;
  const read = vi.fn(async (): Promise<Read> => {
    if (state.next instanceof Error) throw state.next;
    return state.next;
  });
  const close = openMapStream<Map>({
    first,
    read,
    subscribe: (heard) => {
      listener = heard;
      state.subscribed += 1;
      return () => { state.subscribed -= 1; };
    },
    write: (chunk) => {
      if (!state.connected) return false;
      written.push(chunk);
      return true;
    },
    end: () => { state.ended += 1; },
  });
  /** What a NOTIFY does: tell the stream to read again, then let that read finish. */
  const changed = async (next: Read | Error) => {
    state.next = next;
    listener?.();
    await vi.advanceTimersByTimeAsync(0);
  };
  return { written, state, read, close, changed, notify: () => listener?.() };
}

const mapEvent = (map: Map) => `event: map\ndata: ${JSON.stringify(map)}\n\n`;

describe("map stream", () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it("opens with the retry hint and the map it was given, without reading again", () => {
    const stream = harness({ version: 1 });
    expect(stream.written).toEqual(["retry: 3000\n\n", mapEvent({ version: 1 })]);
    expect(stream.read).not.toHaveBeenCalled();
    stream.close();
  });

  it("sends the map after a change, but not a copy of what the client already has", async () => {
    const stream = harness({ version: 1 });
    await stream.changed({ ok: true, value: { version: 1 } });
    expect(stream.written).toHaveLength(2);
    await stream.changed({ ok: true, value: { version: 2 } });
    expect(stream.written.at(-1)).toBe(mapEvent({ version: 2 }));
    expect(stream.written).toHaveLength(3);
    stream.close();
  });

  it("reads once more, not once per notification, when changes arrive during a read", async () => {
    const stream = harness({ version: 1 });
    stream.state.next = { ok: true, value: { version: 5 } };
    stream.notify();
    stream.notify();
    stream.notify();
    await vi.advanceTimersByTimeAsync(0);
    expect(stream.read).toHaveBeenCalledTimes(2);
    expect(stream.written.at(-1)).toBe(mapEvent({ version: 5 }));
    stream.close();
  });

  it("keeps the connection alive with comments and re-reads every minute", async () => {
    const stream = harness({ version: 1 });
    await vi.advanceTimersByTimeAsync(HEARTBEAT_MS);
    expect(stream.written.at(-1)).toBe(": ping\n\n");
    stream.state.next = { ok: true, value: { version: 2 } };
    await vi.advanceTimersByTimeAsync(RESYNC_MS - HEARTBEAT_MS);
    expect(stream.read).toHaveBeenCalledTimes(1);
    expect(stream.written).toContain(mapEvent({ version: 2 }));
    stream.close();
  });

  it("says `gone` and ends when the viewer can no longer see the campaign", async () => {
    const stream = harness({ version: 1 });
    await stream.changed({ ok: false });
    expect(stream.written.at(-1)).toBe("event: gone\ndata: {}\n\n");
    expect(stream.state).toMatchObject({ ended: 1, subscribed: 0 });
    expect(vi.getTimerCount()).toBe(0);
  });

  it("survives a failed read and catches up on the next change", async () => {
    const stream = harness({ version: 1 });
    await stream.changed(new Error("connection lost"));
    expect(stream.state.ended).toBe(0);
    await stream.changed({ ok: true, value: { version: 2 } });
    expect(stream.written.at(-1)).toBe(mapEvent({ version: 2 }));
    stream.close();
  });

  it("releases its subscription and timers when closed, once", async () => {
    const stream = harness({ version: 1 });
    stream.close();
    stream.close();
    expect(stream.state).toMatchObject({ ended: 1, subscribed: 0 });
    expect(vi.getTimerCount()).toBe(0);
    await stream.changed({ ok: true, value: { version: 2 } });
    expect(stream.written).toHaveLength(2);
  });

  it("closes itself when a write finds the connection gone", async () => {
    const stream = harness({ version: 1 });
    stream.state.connected = false;
    await vi.advanceTimersByTimeAsync(HEARTBEAT_MS);
    expect(stream.state).toMatchObject({ ended: 1, subscribed: 0 });
    expect(vi.getTimerCount()).toBe(0);
  });
});
