/**
 * Serves the built Angular app (apps/web) from this same server, so the browser talks to one origin:
 * static files straight from disk, and index.html for every other non-API GET so that deep links
 * (/characters/<id>, /map/<id>) open the single-page app. In development `ng serve` does this job and
 * proxies /api here, so a missing build simply turns this off.
 */
import { existsSync, readFileSync } from "node:fs";
import { extname, join } from "node:path";
import express, { type NextFunction, type Request, type RequestHandler, type Response } from "express";
import { getSessionCookie } from "better-auth/cookies";
import { fromNodeHeaders } from "better-auth/node";

/** Angular names its bundles and fonts `<name>-<HASH>.<ext>`: those never change under the same URL. */
const HASHED_FILE = /-[A-Z0-9]{8}\.[a-z0-9]+$/;

/** Where `ng build` leaves the browser files, unless WEB_DIST says otherwise. */
export function webDistDirectory(): string {
  return process.env.WEB_DIST?.trim() || join(import.meta.dirname, "../../../web/dist/web/browser");
}

/**
 * index.html with a hint for the first paint: `data-session-hint` on <html> when the request carries a
 * session cookie. The cookie is httpOnly, so only the server can see it; its presence (not its validity,
 * which get-session checks) lets the app paint the signed-in skeleton instead of the sign-in one.
 */
export function renderIndex(html: string, hasSessionCookie: boolean): string {
  return hasSessionCookie ? html.replace("<html ", '<html data-session-hint="1" ') : html;
}

export function createWebMiddleware(directory = webDistDirectory()): RequestHandler[] {
  const indexPath = join(directory, "index.html");
  if (!existsSync(indexPath)) return [];
  const indexHtml = readFileSync(indexPath, "utf8");

  const serveFiles = express.static(directory, {
    index: false,
    fallthrough: true,
    setHeaders(response, path) {
      response.setHeader("Cache-Control", HASHED_FILE.test(path) ? "public, max-age=31536000, immutable" : "public, max-age=3600");
    },
  });

  const isApi = (request: Request) => request.path === "/api" || request.path.startsWith("/api/");

  // The API is never served from disk: an /api path that happens to resolve to a file or folder of the build
  // (`/api/x/..%2F..` is the build's root) must still reach the API, which answers it.
  const files: RequestHandler = (request, response, next) => { if (isApi(request)) next(); else serveFiles(request, response, next); };

  const page = (request: Request, response: Response, next: NextFunction) => {
    if ((request.method !== "GET" && request.method !== "HEAD") || isApi(request)) { next(); return; }
    // A missing file (old bundle name, typo) is a 404, not the app shell with a 200.
    if (extname(request.path)) { response.status(404).type("text/plain").send("Not found"); return; }
    const hasSessionCookie = getSessionCookie(fromNodeHeaders(request.headers)) !== null;
    response.status(200).type("html").setHeader("Cache-Control", "no-store").send(renderIndex(indexHtml, hasSessionCookie));
  };

  return [files, page];
}
