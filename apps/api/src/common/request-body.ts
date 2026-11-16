/**
 * Reading request bodies with a size cap. Nest's body parser is off (see main.ts) so that every route
 * states its own limit and nothing is buffered before the caller is authenticated and rate-limited.
 */
import type { IncomingMessage } from "node:http";

/** Default cap for JSON bodies: the largest legitimate payload (a character with its build) is ~20 KB. */
export const MAX_JSON_BYTES = 64_000;
/** Bulk import of browser-saved data: up to 200 characters with builds. */
export const MAX_IMPORT_BYTES = 4_000_000;

/** Largest battle map background picture. */
export const MAX_IMAGE_BYTES = 5_000_000;

/**
 * Read a raw body, returning null when it is missing, empty or larger than `maxBytes`. The size is checked
 * against Content-Length first and again while streaming, so chunked uploads can't skip the limit.
 */
export async function readBytesLimited(request: IncomingMessage, maxBytes: number): Promise<Buffer | null> {
  const declared = Number(request.headers["content-length"]);
  if (Number.isFinite(declared) && declared > maxBytes) return null;
  const chunks: Buffer[] = [];
  let total = 0;
  try {
    for await (const chunk of request as AsyncIterable<Buffer>) {
      total += chunk.byteLength;
      if (total > maxBytes) {
        // Stop reading; the response (an error) is sent while the rest of the upload is discarded.
        request.resume();
        return null;
      }
      chunks.push(chunk);
    }
    // An empty body counts as missing.
    return total ? Buffer.concat(chunks) : null;
  } catch {
    return null;
  }
}

/**
 * Parse a JSON body, returning null when it is malformed, larger than `maxBytes` or not sent as JSON.
 * Requiring the JSON content type means a cross-site form (text/plain) can't post here, whatever the cookie allows.
 */
export async function readJsonLimited(request: IncomingMessage, maxBytes = MAX_JSON_BYTES): Promise<unknown> {
  if (!request.headers["content-type"]?.toLowerCase().startsWith("application/json")) return null;
  const bytes = await readBytesLimited(request, maxBytes);
  if (!bytes) return null;
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    return null;
  }
}
