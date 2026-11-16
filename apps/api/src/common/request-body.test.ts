import type { IncomingMessage } from "node:http";
import { Readable } from "node:stream";
import { describe, expect, it } from "vitest";
import { MAX_JSON_BYTES, readBytesLimited, readJsonLimited } from "./request-body.js";

/** A request as Node hands it to Express: a readable stream with lower-cased headers. */
function post(body: string | Uint8Array | null, headers: Record<string, string> = {}): IncomingMessage {
  const bytes = body === null ? null : Buffer.from(body);
  const stream = Readable.from(bytes ? [bytes.subarray(0, Math.ceil(bytes.length / 2)), bytes.subarray(Math.ceil(bytes.length / 2))] : []);
  return Object.assign(stream, {
    headers: { "content-type": "application/json", ...(bytes ? { "content-length": String(bytes.length) } : {}), ...headers },
  }) as unknown as IncomingMessage;
}

describe("readJsonLimited", () => {
  it("parses a normal JSON body", async () => {
    expect(await readJsonLimited(post(JSON.stringify({ name: "Ñandú" })))).toEqual({ name: "Ñandú" });
  });

  it("returns null for malformed JSON, invalid UTF-8 and empty bodies", async () => {
    expect(await readJsonLimited(post("{nope"))).toBeNull();
    expect(await readJsonLimited(post(new Uint8Array([0x22, 0xff, 0x22])))).toBeNull();
    expect(await readJsonLimited(post(null))).toBeNull();
  });

  it("returns null unless the body is sent as JSON (a cross-site form can only send text/plain)", async () => {
    expect(await readJsonLimited(post('{"name":"x"}', { "content-type": "text/plain" }))).toBeNull();
    expect(await readJsonLimited(post('{"name":"x"}', { "content-type": "application/json; charset=utf-8" }))).toEqual({ name: "x" });
  });

  it("rejects bodies over the limit, by declared length and while streaming", async () => {
    const big = JSON.stringify({ notes: "a".repeat(MAX_JSON_BYTES) });
    expect(await readJsonLimited(post(big))).toBeNull();
    // No usable Content-Length (as with chunked uploads): the stream itself is counted.
    expect(await readJsonLimited(post(big, { "content-length": "10" }))).toBeNull();
    expect(await readJsonLimited(post(big), big.length + 1)).toEqual({ notes: "a".repeat(MAX_JSON_BYTES) });
  });
});

describe("readBytesLimited", () => {
  it("returns the raw bytes, and null for an empty or oversized upload", async () => {
    expect(await readBytesLimited(post(new Uint8Array([1, 2, 3])), 10)).toEqual(Buffer.from([1, 2, 3]));
    expect(await readBytesLimited(post(null), 10)).toBeNull();
    expect(await readBytesLimited(post(new Uint8Array(11)), 10)).toBeNull();
  });
});
