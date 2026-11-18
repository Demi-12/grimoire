/**
 * What the domain services answer with instead of throwing: the value, or why the caller can't have it.
 * Controllers turn a failure into its HTTP error with `unwrap()` / `dataError()` (api-error.ts).
 */
export type DataError = "not-found" | "forbidden" | "invalid";
export type DataResult<T> = { ok: true; value: T } | { ok: false; error: DataError };
export const fail = <T>(error: DataError): DataResult<T> => ({ ok: false, error });
