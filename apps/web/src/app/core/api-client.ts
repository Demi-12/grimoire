/**
 * The browser's door to the API: `api<T>(path, { method, body })` with the session cookie, and ApiError.
 * The response shapes live in packages/shared/src/api-types.ts (shared with the NestJS controllers) and
 * are re-exported here, so components import both from one place.
 */
export type * from "@grimoire/shared/api-types";

export class ApiError extends Error {
  constructor(readonly status: number, message: string, readonly code?: string, readonly path?: string) {
    super(message);
  }
}

/** JSON fetch against the app's own API with the session cookie; throws ApiError on failure. */
export async function api<T = void>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const response = await fetch(path, {
    method: init.method ?? "GET",
    credentials: "same-origin",
    headers: init.body === undefined ? undefined : { "Content-Type": "application/json" },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    cache: "no-store",
  });
  if (!response.ok) {
    let message = response.statusText;
    let code: string | undefined;
    let path: string | undefined;
    try {
      const data = await response.json() as { error?: string; code?: string; path?: string };
      if (data.error) message = data.error;
      code = data.code;
      path = data.path;
    } catch {
      // Keep the status text when the body isn't JSON.
    }
    throw new ApiError(response.status, message, code, path);
  }
  return (response.status === 204 ? undefined : await response.json()) as T;
}
