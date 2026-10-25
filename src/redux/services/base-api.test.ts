import { configureStore } from "@reduxjs/toolkit";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { setAccessToken } from "@/auth/access-token";
import { _resetCsrfCache } from "@/auth/csrf";
import { _resetAccountForTests, setAccount } from "@/auth/device-account";
import { _resetRefreshForTests } from "@/auth/refresh";

import { baseApi } from "./base-api";
// Side-effect: register the login/logout/me endpoints the test shells reach for.
import { portalApi } from "./portal-api";

/**
 * The base-api 401 interceptor. These tests drive the real base-query
 * through RTK Query's injected endpoints and watch what fetch() receives.
 */

const BASE = "http://test.local/v1";

type Handler = (url: string, init?: RequestInit) => Response | Promise<Response>;
let calls: Array<{ url: string; init?: RequestInit }>;

function urlOf(input: Parameters<typeof fetch>[0]): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  if (input instanceof Request) return input.url;
  return String(input);
}

function stubFetch(handler: Handler) {
  globalThis.fetch = vi.fn(async (input, init) => {
    const url = urlOf(input);
    // A Request carries its own headers; mirror them to `init` so tests can
    // inspect what the base-query sent.
    const effectiveInit =
      input instanceof Request
        ? { ...init, headers: input.headers, method: init?.method ?? input.method }
        : init;
    calls.push({ url, init: effectiveInit });
    return handler(url, effectiveInit);
  }) as unknown as typeof fetch;
}

function makeStore() {
  return configureStore({
    reducer: { [baseApi.reducerPath]: baseApi.reducer },
    middleware: (gd) => gd().concat(baseApi.middleware),
  });
}

beforeEach(async () => {
  calls = [];
  _resetAccountForTests();
  await setAccount("a-patricia");
  document.cookie = "csrftoken=abc; path=/";
  _resetCsrfCache();
  _resetRefreshForTests();
  setAccessToken("stale-access");
  const happy = (window as unknown as { happyDOM?: { setURL: (u: string) => void } }).happyDOM;
  happy?.setURL("http://lagoon-view.localhost:5176/parent/");
});

afterEach(() => {
  document.cookie = "csrftoken=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
});

describe("base-api 401 flow", () => {
  it("refreshes and retries a 401 once, then settles 200", async () => {
    const responses = [401, 200];
    let refreshCount = 0;
    stubFetch((url) => {
      if (url.endsWith("/user/auth/device/refresh/")) {
        refreshCount += 1;
        return new Response(JSON.stringify({ data: { access: "fresh" } }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      if (url.includes("/portal/parent/me/")) {
        const code = responses.shift() ?? 200;
        if (code === 200) {
          return new Response(
            JSON.stringify({
              data: {
                parent: { first_name: "P", full_name: "P O", initials: "PO" },
                school: { name: "S", logo_url: "" },
                show_branch: false,
                session: null,
                term: null,
                children: [],
              },
            }),
            { status: 200, headers: { "content-type": "application/json" } },
          );
        }
        return new Response("{}", { status: code });
      }
      return new Response("{}", { status: 200 });
    });
    const store = makeStore();
    const promise = store.dispatch(portalApi.endpoints.me.initiate());
    const result = await promise;
    expect(result.status).toBe("fulfilled");
    expect(refreshCount).toBe(1);
  });

  it("gives up when the retry answers 401 as well", async () => {
    stubFetch((url) => {
      if (url.endsWith("/user/auth/device/refresh/")) {
        return new Response(JSON.stringify({ data: { access: "fresh" } }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      if (url.includes("/portal/parent/me/")) return new Response("{}", { status: 401 });
      return new Response("{}", { status: 200 });
    });
    const store = makeStore();
    const result = await store.dispatch(portalApi.endpoints.me.initiate());
    expect(result.status).toBe("rejected");
    const refreshCalls = calls.filter((c) => c.url.endsWith("/user/auth/device/refresh/"));
    expect(refreshCalls.length).toBe(1);
  });

  it("appends ?tenant= from the hostname", async () => {
    stubFetch(() =>
      new Response(
        JSON.stringify({
          data: {
            parent: { first_name: "P", full_name: "P O", initials: "PO" },
            school: { name: "S", logo_url: "" },
            show_branch: false,
            session: null,
            term: null,
            children: [],
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    const store = makeStore();
    await store.dispatch(portalApi.endpoints.me.initiate());
    const meCall = calls.find((c) => c.url.includes("/portal/parent/me/"));
    expect(meCall?.url).toContain("tenant=lagoon-view");
  });

  it("sends the Bearer header on signed-in reads", async () => {
    stubFetch(() =>
      new Response(
        JSON.stringify({
          data: {
            parent: { first_name: "P", full_name: "P O", initials: "PO" },
            school: { name: "S", logo_url: "" },
            show_branch: false,
            session: null,
            term: null,
            children: [],
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    const store = makeStore();
    await store.dispatch(portalApi.endpoints.me.initiate());
    const meCall = calls.find((c) => c.url.includes("/portal/parent/me/"));
    const headers = meCall?.init?.headers as unknown as Headers;
    const auth = (headers.get ? headers.get("authorization") : (headers as unknown as Record<string, string>)["authorization"]) ?? "";
    expect(String(auth).toLowerCase()).toBe("bearer stale-access");
  });
});

// Keep the base-api's baseUrl in sync with the test harness.
void BASE;
