import { vi } from "vitest";

/** A canned API answer: status and JSON body. */
export type Canned = { status: number; body?: unknown };

/**
 * Replaces `fetch` with a router over path and method, for the auth tests.
 *
 * `routes` maps "METHOD /path" (no query string, no API base) to an answer or
 * a function of the request body. Every call is recorded. The CSRF route
 * answers by default.
 */
export function routeFetch(routes: Record<string, Canned | ((body: unknown) => Canned | Promise<Canned>)>) {
  const calls: { key: string; body: unknown; headers: Record<string, string> }[] = [];
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    // RTK Query's fetchBaseQuery hands fetch a Request; the auth code passes an address and init.
    const request = input instanceof Request ? input : null;
    const url = new URL(request ? request.url : String(input), "http://test.local");
    const path = url.pathname.replace(/^\/v1/, "");
    const key = `${(init?.method ?? request?.method ?? "GET").toUpperCase()} ${path}`;
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    // A plain header object is read as it is: happy-dom's Headers hides Authorization.
    const sent = init?.headers && !(init.headers instanceof Headers) && !Array.isArray(init.headers)
      ? Object.fromEntries(Object.entries(init.headers).map(([name, value]) => [name, String(value)]))
      : Object.fromEntries(new Headers(init?.headers).entries());
    calls.push({ key, body, headers: sent });
    if (key === "GET /user/auth/csrf/" && !routes[key]) {
      return new Response(JSON.stringify({ data: { csrf_token: "csrf-test" } }), { status: 200 });
    }
    const route = routes[key];
    if (!route) return new Response(JSON.stringify({}), { status: 599 });
    const answer = typeof route === "function" ? await route(body) : route;
    return new Response(JSON.stringify(answer.body ?? {}), { status: answer.status });
  });
  vi.stubGlobal("fetch", fetchMock);
  return { calls, fetchMock };
}
