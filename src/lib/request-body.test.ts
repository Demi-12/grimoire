import { describe, expect, it } from "vitest";
import { MAX_JSON_BYTES, readJsonLimited } from "./request-body";

const post = (body: BodyInit, headers: Record<string, string> = {}) =>
  new Request("http://localhost/api/x", { method: "POST", body, headers: { "content-type": "application/json", ...headers } });

describe("readJsonLimited", () => {
  it("parses a normal JSON body", async () => {
    expect(await readJsonLimited(post(JSON.stringify({ name: "Ñandú" })))).toEqual({ name: "Ñandú" });
  });

  it("returns null for malformed JSON, invalid UTF-8 and empty bodies", async () => {
    expect(await readJsonLimited(post("{nope"))).toBeNull();
    expect(await readJsonLimited(post(new Uint8Array([0x22, 0xff, 0x22])))).toBeNull();
    expect(await readJsonLimited(new Request("http://localhost/api/x", { method: "DELETE" }))).toBeNull();
  });

  it("rejects bodies over the limit, by declared length and while streaming", async () => {
    const big = JSON.stringify({ notes: "a".repeat(MAX_JSON_BYTES) });
    expect(await readJsonLimited(post(big))).toBeNull();
    // No usable Content-Length (as with chunked uploads): the stream itself is counted.
    expect(await readJsonLimited(post(big, { "content-length": "10" }))).toBeNull();
    expect(await readJsonLimited(post(big), big.length + 1)).toEqual({ notes: "a".repeat(MAX_JSON_BYTES) });
  });
});
