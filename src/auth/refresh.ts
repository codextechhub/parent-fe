import { clearAccessToken, setAccessToken } from "./access-token";
import { getCsrfToken } from "./csrf";

const baseUrl = import.meta.env.VITE_BACKEND_URL;

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

const doRefresh = async (): Promise<RefreshOutcome> => {
  const csrfToken = await getCsrfToken();
  let response: Response;
  try {
    response = await fetch(`${baseUrl}/user/auth/token/refresh/`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        accept: "application/json",
        ...(csrfToken ? { "X-CSRFToken": csrfToken } : {}),
      },
      body: "{}",
    });
  } catch {
    return { ok: false, reason: "network_error" };
  }

  // Only 401 means the refresh cookie is definitively bad - force re-auth.
  if (response.status === 401) return { ok: false, reason: "token_invalid" };
  // 5xx (and anything else non-ok) is transient: keep the parent signed in.
  if (!response.ok) return { ok: false, reason: "server_error" };

  let data: { data?: { access?: string; session_id?: number } };
  try {
    data = await response.json();
  } catch {
    return { ok: false, reason: "server_error" };
  }

  const access = data?.data?.access;
  if (!access) return { ok: false, reason: "server_error" };
  if (sessionInvalidated) return { ok: false, reason: "token_invalid" };

  setAccessToken(access);
  return { ok: true, access };
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
