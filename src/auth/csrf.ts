import { timeoutSignal } from "@/lib/request-timeout";

/**
 * Django's double-submit CSRF token, read from the cookie Django sets and
 * sent back on every write.
 *
 * The same shape school-fe and student-fe use, so a fix lands in all three.
 * A deployment that shares a parent domain with its twin names its own CSRF
 * cookie; `VITE_CSRF_COOKIE_NAME` names it, else `csrftoken`.
 */
const baseUrl = import.meta.env.VITE_BACKEND_URL;
const csrfCookieName = import.meta.env.VITE_CSRF_COOKIE_NAME || "csrftoken";
let cachedCsrfToken = "";

function readCookie(name: string): string {
  const prefix = `${encodeURIComponent(name)}=`;
  const pair = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix));
  return pair ? decodeURIComponent(pair.slice(prefix.length)) : "";
}

export function readCsrfToken(): string {
  return readCookie(csrfCookieName) || cachedCsrfToken;
}

/** Ask Django for a CSRF cookie if none is set yet, then return it. */
export async function getCsrfToken(): Promise<string> {
  const existing = readCsrfToken();
  if (existing) return existing;

  try {
    const response = await fetch(`${baseUrl}/user/auth/csrf/`, {
      method: "GET",
      credentials: "include",
      headers: { accept: "application/json" },
      signal: timeoutSignal(),
    });
    if (!response.ok) return "";
    const data = (await response.json()) as { data?: { csrf_token?: string } };
    cachedCsrfToken = readCookie(csrfCookieName) || data?.data?.csrf_token || "";
  } catch {
    return "";
  }
  return readCsrfToken();
}

/** Test-only: forget the in-memory cached token so a test starts clean. */
export function _resetCsrfCache(): void {
  cachedCsrfToken = "";
}
