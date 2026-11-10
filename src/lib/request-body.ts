/** Default cap for JSON bodies: the largest legitimate payload (a character with its build) is ~20 KB. */
export const MAX_JSON_BYTES = 64_000;
/** Bulk import of browser-saved data: up to 200 characters with builds. */
export const MAX_IMPORT_BYTES = 4_000_000;

/** Largest battle map background picture. */
export const MAX_IMAGE_BYTES = 5_000_000;

/**
 * Read a raw body, returning null when it is missing or larger than `maxBytes`. The size is checked
 * against Content-Length first and again while streaming, so chunked uploads can't skip the limit.
 */
export async function readBytesLimited(request: Request, maxBytes: number): Promise<Buffer | null> {
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) return null;
  if (!request.body) return null;
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
    return Buffer.concat(chunks);
  } catch {
    return null;
  }
}

/** Parse a JSON body, returning null when it is malformed or larger than `maxBytes`. */
export async function readJsonLimited(request: Request, maxBytes = MAX_JSON_BYTES): Promise<unknown> {
  const bytes = await readBytesLimited(request, maxBytes);
  if (!bytes) return null;
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    return null;
  }
}
