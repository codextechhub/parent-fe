import {
  type BaseQueryFn,
  type FetchArgs,
  type FetchBaseQueryError,
  createApi,
  fetchBaseQuery,
} from "@reduxjs/toolkit/query/react";

import { getAccessToken } from "@/auth/access-token";
import { getCsrfToken } from "@/auth/csrf";
import {
  markSessionInvalidated,
  refreshTokenSingleFlight,
} from "@/auth/refresh";
import { currentSchoolSlug } from "@/utils/school-host";

const baseUrl = import.meta.env.VITE_BACKEND_URL;

/**
 * Routes that do their own session handling: never add Authorization and
 * never run the 401 refresh/retry on them. Matched as a path under
 * `/user/auth/`, so "activate" and "login" never collide with other words.
 */
const AUTH_URLS = ["login", "device", "csrf", "password", "activate"];

const isAuthRoute = (args: string | FetchArgs): boolean => {
  const url =
    typeof args === "string"
      ? args
      : typeof args.url === "string"
        ? args.url
        : "";
  return AUTH_URLS.some((u) => url.includes(`/user/auth/${u}`));
};

const hasTenantParam = (args: string | FetchArgs): boolean => {
  if (typeof args === "string") return /[?&]tenant=/.test(args);
  if (typeof args.url === "string" && /[?&]tenant=/.test(args.url)) return true;
  const params = args.params as Record<string, unknown> | undefined;
  return !!params && params.tenant != null && params.tenant !== "";
};

/**
 * Append `?tenant=<slug>` on every signed-in call: the backend wants the
 * tenant on each request (the token is tenant-less), and reading the slug
 * off the current host matches how the parent app was reached in the first
 * place. Auth routes own their tenant (sent in the body or taken from the
 * cookie) so this never touches them.
 */
const injectTenant = (args: string | FetchArgs): string | FetchArgs => {
  if (isAuthRoute(args) || hasTenantParam(args)) return args;
  const slug = currentSchoolSlug();
  if (!slug) return args;
  if (typeof args === "string") {
    const sep = args.includes("?") ? "&" : "?";
    return `${args}${sep}tenant=${encodeURIComponent(slug)}`;
  }
  return { ...args, params: { ...(args.params as object), tenant: slug } };
};

/**
 * Every call carries the parent's access token (except signing in and out,
 * which run on the session cookie) and every write carries the CSRF token.
 * Signing out is refused without it, so a write that skipped it would leave
 * the server's session open while this app showed the sign-in page.
 */
export const baseQuery = fetchBaseQuery({
  baseUrl,
  credentials: "include",
  prepareHeaders: async (headers, { endpoint, type }) => {
    const accessToken = getAccessToken();
    if (accessToken && endpoint !== "login" && endpoint !== "logout") {
      headers.set("Authorization", `Bearer ${accessToken}`);
    }
    if (type === "mutation") {
      const csrf = await getCsrfToken();
      if (csrf) headers.set("X-CSRFToken", csrf);
    }
    headers.set("accept", "application/json");
    return headers;
  },
});

/**
 * The 401 flow for the parent app.
 *
 * Reads sit under RTK Query; the refresh cookie is HttpOnly and travels with
 * the fetch. A first 401 asks for a fresh access credential and tries once
 * more. A second 401 (or an invalid refresh) marks the session dead and
 * clears the parent's identity: the route guard pulls them back to sign-in.
 * Transient 5xx / network failures leave the parent signed in; the failing
 * query surfaces its own error.
 */
export const baseQueryInterceptor: BaseQueryFn<
  string | FetchArgs,
  unknown,
  FetchBaseQueryError
> = async (args, api, extraOptions) => {
  const tenantArgs = injectTenant(args);
  const result = await baseQuery(tenantArgs, api, extraOptions);
  if (!result?.error) return result;

  const res = result.error as FetchBaseQueryError;
  if (res.status !== 401) return result;
  if (isAuthRoute(args)) return result;

  const refreshed = await refreshTokenSingleFlight();
  if (refreshed.ok) {
    const retry = await baseQuery(tenantArgs, api, extraOptions);
    if ((retry?.error as FetchBaseQueryError | undefined)?.status === 401) {
      markSessionInvalidated();
      // The me-query's own 401 handling (in auth-events.ts) empties the slice
      // on the next read; a reroute to /sign-in happens there, not here, so a
      // background 401 does not yank a parent off a page they were reading.
    }
    return retry;
  }

  if (refreshed.reason === "token_invalid" || refreshed.reason === "no_token") {
    markSessionInvalidated();
  }
  return result;
};

export const baseApi = createApi({
  reducerPath: "api",
  baseQuery: baseQueryInterceptor,
  tagTypes: ["Me", "Profile", "Fees", "Payments", "Notices", "Timetable", "Attendance", "Results", "Messages", "PaymentNotices"],
  endpoints: () => ({}),
});

/** Every tag the API's reads carry, so a pull to refresh can read them all again. */
export const ALL_TAGS = ["Me", "Profile", "Fees", "Payments", "Notices", "Timetable", "Attendance", "Results", "Messages", "PaymentNotices"] as const;
