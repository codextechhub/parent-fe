import { configureStore } from "@reduxjs/toolkit";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { setAccessToken } from "@/auth/access-token";
import { _resetCsrfCache } from "@/auth/csrf";
import { authReducer } from "@/redux/features/auth-slice";
import { connectivityReducer } from "@/redux/features/connectivity-slice";

import { baseApi } from "./base-api";
import { portalApi } from "./portal-api";

/**
 * Mrs Okafor taps Sign out. The server refuses a sign-out that does not carry
 * the CSRF token, and the app clears its own state either way, so a missing
 * token would leave her session open on the server while the app showed the
 * sign-in page: the next person to open the app on that phone would be her.
 */
describe("the parent app's requests", () => {
  const sent: Request[] = [];

  beforeEach(() => {
    sent.length = 0;
    document.cookie = "csrftoken=token-123; path=/";
    _resetCsrfCache();
    setAccessToken("access-abc");
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      if (input instanceof Request) sent.push(input);
      return new Response("{}", { status: 200, headers: { "content-type": "application/json" } });
    }) as unknown as typeof fetch;
  });

  afterEach(() => {
    document.cookie = "csrftoken=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
  });

  const store = () =>
    configureStore({
      reducer: { [baseApi.reducerPath]: baseApi.reducer, auth: authReducer, connectivity: connectivityReducer },
      middleware: (gd) => gd().concat(baseApi.middleware),
    });

  it("sends the CSRF token when signing out", async () => {
    await store().dispatch(portalApi.endpoints.logout.initiate());
    const logout = sent.find((r) => r.url.includes("/user/auth/logout/"));
    expect(logout?.headers.get("X-CSRFToken")).toBe("token-123");
  });
});
