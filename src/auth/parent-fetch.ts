import { timeoutSignal } from "@/lib/request-timeout";

import { getAccessToken } from "./access-token";
import { API_BASE, requestCredentials, withTenant } from "./api";
import { refreshTokenSingleFlight } from "./refresh";

/** What a call made as the parent came to: the HTTP status (0 when the school could not be reached) and the API's error code. */
export type ParentAnswer = { status: number; code: string };

const NOT_SENT: ParentAnswer = { status: 0, code: "" };

/**
 * Sends one JSON call as the signed-in parent, outside the store.
 *
 * The phone's push token is registered by code that runs beside React, not
 * through RTK Query, so this makes the call itself: the parent's access token
 * (refreshed first if none is held, and once more on a 401, as the store
 * does), the school named in the address, no CSRF token and no cookie. Only
 * the store app uses it, whose sign-in is a credential in secure storage. A
 * parent whose sign-in cannot be renewed gets status 401 or 0 and nothing is
 * sent.
 */
export async function parentRequest(method: string, path: string, body: unknown): Promise<ParentAnswer> {
  const send = (): Promise<Response> =>
    fetch(`${API_BASE}${withTenant(path)}`, {
      method,
      credentials: requestCredentials(),
      headers: {
        "Content-Type": "application/json",
        accept: "application/json",
        Authorization: `Bearer ${getAccessToken()}`,
      },
      body: JSON.stringify(body ?? {}),
      signal: timeoutSignal(),
    });
  const renewed = async (): Promise<ParentAnswer | null> => {
    const outcome = await refreshTokenSingleFlight();
    if (outcome.ok) return null;
    return outcome.reason === "token_invalid" || outcome.reason === "no_token" ? { status: 401, code: "" } : NOT_SENT;
  };
  try {
    if (!getAccessToken()) {
      const refused = await renewed();
      if (refused) return refused;
    }
    let response = await send();
    if (response.status === 401) {
      const refused = await renewed();
      if (refused) return refused;
      response = await send();
    }
    return { status: response.status, code: await errorCode(response) };
  } catch {
    return NOT_SENT;
  }
}

/** The API's error code from a refused answer, or "" for an answer that is not one. */
async function errorCode(response: Response): Promise<string> {
  if (response.ok) return "";
  try {
    const body = (await response.json()) as { code?: string; error?: { code?: string; error_code?: string } };
    return body.error?.code ?? body.error?.error_code ?? body.code ?? "";
  } catch {
    return "";
  }
}
