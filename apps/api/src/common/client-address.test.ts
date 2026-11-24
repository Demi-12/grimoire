import { describe, expect, it } from "vitest";
import { clientAddress, firstHeader } from "./client-address.js";

// Addresses from the documentation ranges (RFC 5737): never a real visitor.
const VISITOR = "203.0.113.7";
const PROXY = "198.51.100.2";
const SOCKET = "192.0.2.10";

describe("firstHeader", () => {
  it("reads a single value, the first of repeated ones, or nothing", () => {
    expect(firstHeader({ "user-agent": "Test agent" }, "user-agent")).toBe("Test agent");
    expect(firstHeader({ "x-real-ip": [VISITOR, PROXY] }, "x-real-ip")).toBe(VISITOR);
    expect(firstHeader({}, "user-agent")).toBeUndefined();
  });
});

describe("clientAddress", () => {
  it("trusts Cloudflare's CF-Connecting-IP over any other header and the socket", () => {
    expect(clientAddress({ "cf-connecting-ip": VISITOR, "x-forwarded-for": PROXY, "x-real-ip": PROXY }, SOCKET)).toBe(VISITOR);
  });

  it("takes the first, trimmed entry of an X-Forwarded-For chain when Cloudflare sent nothing", () => {
    expect(clientAddress({ "x-forwarded-for": ` ${VISITOR} , ${PROXY}`, "x-real-ip": PROXY }, SOCKET)).toBe(VISITOR);
  });

  it("falls back to X-Real-IP, then to the socket, then to a fixed key", () => {
    expect(clientAddress({ "x-real-ip": VISITOR }, SOCKET)).toBe(VISITOR);
    expect(clientAddress({}, SOCKET)).toBe(SOCKET);
    expect(clientAddress({}, undefined)).toBe("unknown");
  });

  it("uses the first value of a repeated header", () => {
    expect(clientAddress({ "x-real-ip": [VISITOR, PROXY] }, SOCKET)).toBe(VISITOR);
  });

  it("keeps a header that is present but empty instead of falling through", () => {
    expect(clientAddress({ "cf-connecting-ip": "", "x-real-ip": PROXY }, SOCKET)).toBe("");
  });
});
