import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createWebMiddleware, renderIndex } from "./web.middleware.js";

/** A fake web build: index.html, a hashed bundle and a font, behind the middleware, with a stand-in API. */
function app() {
  const dist = mkdtempSync(join(tmpdir(), "grimoire-web-"));
  writeFileSync(join(dist, "index.html"), '<!doctype html><html lang="en"><body>app</body></html>');
  writeFileSync(join(dist, "main-ABCD1234.js"), "console.log(1)");
  mkdirSync(join(dist, "fonts"));
  writeFileSync(join(dist, "fonts", "a.woff2"), "font");
  const server = express();
  for (const handler of createWebMiddleware(dist)) server.use(handler);
  server.use("/api", (_request, response) => { response.status(418).json({ api: true }); });
  return server;
}

describe("web middleware", () => {
  it("serves the app shell for page addresses, so deep links open the single-page app", async () => {
    const response = await request(app()).get("/characters/123");
    expect(response.status).toBe(200);
    expect(response.text).toContain("<body>app</body>");
    expect(response.headers["cache-control"]).toBe("no-store");
  });

  it("caches hashed bundles for a year and other files for an hour", async () => {
    expect((await request(app()).get("/main-ABCD1234.js")).headers["cache-control"]).toBe("public, max-age=31536000, immutable");
    expect((await request(app()).get("/fonts/a.woff2")).headers["cache-control"]).toBe("public, max-age=3600");
  });

  it("answers a missing file with 404 instead of the app shell", async () => {
    const response = await request(app()).get("/main-OLDHASH0.js");
    expect(response.status).toBe(404);
    expect(response.text).not.toContain("app");
  });

  it("never serves API paths from disk, even one that resolves to the build's folder", async () => {
    expect((await request(app()).get("/api/monsters/..%2F..")).status).toBe(418);
    expect((await request(app()).get("/api/me")).status).toBe(418);
    expect((await request(app()).post("/characters")).status).toBe(404);
  });

  it("marks the page when a session cookie came with the request", () => {
    const html = '<html lang="en"><body></body></html>';
    expect(renderIndex(html, true)).toBe('<html data-session-hint="1" lang="en"><body></body></html>');
    expect(renderIndex(html, false)).toBe(html);
  });
});
