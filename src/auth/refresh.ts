import { clearAccessToken, setAccessToken } from "./access-token";
import { authPost } from "./api";
import { clearAccount, getAccount } from "./device-account";

export type RefreshOutcome =
  | { ok: true; access: string }
  | { ok: false; reason: "no_token" | "token_invalid" | "network_error" | "server_error" };

let inFlight: Promise<RefreshOutcome> | null = null;

/**
 * Once a session is torn down, a refresh already in flight must not restore
 * an access credential. A fresh sign-in re-enables refresh in the same tab.
 */
let sessionInvalidated = false;

export const markSessionInvalidated = (): void => {
  sessionInvalidated = true;
  inFlight = null;
  clearAccessToken();
};

export const resetSessionInvalidation = (): void => {
  sessionInvalidated = false;
};

/** The refusals that end a sign-in for good: the parent signs in again. */
const ENDED = new Set(["TOKEN_EXPIRED", "TOKEN_REVOKED", "TOKEN_INVALID"]);

/**
 * How long the loser of a race waits before asking again. The API rotates the
 * credential on every refresh and answers 409 `TOKEN_STALE` to a call that
 * presents the one just rotated away; by the retry the winner's new cookie is
 * in the browser.
 */
const STALE_RETRY_MS = 250;

/**
 * Every tab and window of the app on this browser queues on one Web Lock, so
 * two of them never present the same credential at once. Where Web Locks are
 * missing the refresh runs unqueued and the 409 retry covers the race.
 */
function withAccountLock<T>(account: string, task: () => Promise<T>): Promise<T> {
  const locks = typeof navigator !== "undefined" ? navigator.locks : undefined;
  if (!locks?.request) return task();
  return locks.request(`refresh:${account}`, task) as unknown as Promise<T>;
}

async function refreshOnce(account: string, mayRetry: boolean): Promise<RefreshOutcome> {
  const result = await authPost<{ access?: string }>("/user/auth/device/refresh/", { account });
  if (result.ok) {
    const access = result.data.access ?? "";
    if (!access) return { ok: false, reason: "server_error" };
    if (sessionInvalidated) return { ok: false, reason: "token_invalid" };
    setAccessToken(access);
    return { ok: true, access };
  }
  const { status, code } = result.refusal;
  if (status === 409 && code === "TOKEN_STALE") {
    if (!mayRetry) return { ok: false, reason: "server_error" };
    await new Promise((resolve) => setTimeout(resolve, STALE_RETRY_MS));
    return refreshOnce(account, false);
  }
  // Only a definitive 401 means the sign-in is over; anything else is transient.
  if (status === 401 && (ENDED.has(code) || !code)) {
    await clearAccount();
    return { ok: false, reason: "token_invalid" };
  }
  if (status === 0) return { ok: false, reason: "network_error" };
  return { ok: false, reason: "server_error" };
}

const doRefresh = async (): Promise<RefreshOutcome> => {
  const account = await getAccount();
  if (!account) return { ok: false, reason: "no_token" };
  return withAccountLock(account, () => refreshOnce(account, true));
};

/**
 * Single-flight refresh: every concurrent 401 retrier waits on one promise,
 * so the backend only sees one rotation per window of activity.
 */
export const refreshTokenSingleFlight = (): Promise<RefreshOutcome> => {
  if (sessionInvalidated) {
    return Promise.resolve({ ok: false, reason: "no_token" });
  }
  if (inFlight) return inFlight;

  inFlight = doRefresh().finally(() => {
    inFlight = null;
  });
  return inFlight;
};

/** Test-only: reset the module between tests. */
export const _resetRefreshForTests = (): void => {
  inFlight = null;
  sessionInvalidated = false;
};
