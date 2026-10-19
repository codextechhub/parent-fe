/**
 * The access credential, held only for the lifetime of this JavaScript context.
 *
 * A refresh of the session answers with a new access string; the HttpOnly
 * refresh cookie that proved the session is not readable from JS. Keeping the
 * access token in a module-scope variable rather than storage is deliberate:
 * nothing on the page can read it from another origin, and a reload lands on
 * the sign-in route which refreshes it from the cookie if the session is
 * still valid.
 */
let accessToken = "";

export function getAccessToken(): string {
  return accessToken;
}

export function setAccessToken(token: string): void {
  accessToken = token && token !== "undefined" ? token : "";
}

export function clearAccessToken(): void {
  accessToken = "";
}
