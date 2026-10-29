/**
 * How long a request may take before the app gives up on it.
 *
 * A weak phone connection can stall a request without ever failing it, and a
 * request that never ends leaves a spinner that never ends. Past this the
 * request is abandoned and reported as the school not answering, which every
 * screen already handles (a retry, or an offline notice).
 *
 * student-fe keeps the same file; keep the two in step.
 */
// Longer than the API's own 30-second limit on a request, so the app never
// gives up on a save the school is still making.
export const REQUEST_TIMEOUT_MS = 45_000;

/** An upload carries a photo or a file, which on a slow connection really can take this long. */
export const UPLOAD_TIMEOUT_MS = 120_000;

/** A signal that aborts after `ms`, or none where the browser cannot make one. */
export function timeoutSignal(ms = REQUEST_TIMEOUT_MS): AbortSignal | undefined {
  return typeof AbortSignal.timeout === "function" ? AbortSignal.timeout(ms) : undefined;
}
