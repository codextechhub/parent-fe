import { isNativeApp } from "@/native/platform";
import { currentSchoolSlug } from "@/utils/school-host";

import { getCsrfToken } from "./csrf";

/** The API base: `/v1` in development (proxied), absolute in a build. */
export const API_BASE = import.meta.env.VITE_BACKEND_URL;

/**
 * Whether a request sends cookies. A browser's sign-in is a cookie, so it
 * does; the store app keeps its credential in secure storage and holds no
 * cookie at all.
 */
export function requestCredentials(): RequestCredentials {
  return isNativeApp() ? "omit" : "include";
}

/** What the API says went wrong: its code (either key it uses) and its sentence. */
export type ApiRefusal = { status: number; code: string; message: string };

/**
 * A browser-auth call: cookies included, CSRF token sent, a JSON body. In the
 * store app it is the same call with no cookies and no CSRF token: the
 * credential travels in the body (see `device-credential.ts`), and CSRF guards
 * cookies, which that app does not use.
 *
 * Used for sign-in, refresh and sign-out, which run outside RTK Query because
 * they decide whether the store has a session at all. A network failure
 * answers status 0 so a caller can tell "the school is unreachable" from
 * "the school said no".
 */
export async function authPost<T>(
  path: string,
  body: unknown,
): Promise<{ ok: true; data: T } | { ok: false; refusal: ApiRefusal }> {
  const csrf = isNativeApp() ? "" : await getCsrfToken();
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      credentials: requestCredentials(),
      headers: {
        "Content-Type": "application/json",
        accept: "application/json",
        ...(csrf ? { "X-CSRFToken": csrf } : {}),
      },
      body: JSON.stringify(body ?? {}),
    });
  } catch {
    return { ok: false, refusal: { status: 0, code: "NETWORK", message: "" } };
  }
  let payload: {
    data?: T;
    message?: string;
    error?: { code?: string; error_code?: string };
  } = {};
  try {
    payload = await response.json();
  } catch {
    payload = {};
  }
  if (response.ok && payload.data !== undefined) return { ok: true, data: payload.data };
  return {
    ok: false,
    refusal: {
      status: response.status,
      code: payload.error?.code ?? payload.error?.error_code ?? "",
      message: payload.message ?? "",
    },
  };
}

/** `path` with this school's `?tenant=` added, as every signed-in route expects. */
export function withTenant(path: string): string {
  const slug = currentSchoolSlug();
  if (!slug || /[?&]tenant=/.test(path)) return path;
  return `${path}${path.includes("?") ? "&" : "?"}tenant=${encodeURIComponent(slug)}`;
}
