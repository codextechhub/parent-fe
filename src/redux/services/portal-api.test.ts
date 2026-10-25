import { configureStore } from "@reduxjs/toolkit";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getAccessToken, setAccessToken } from "@/auth/access-token";
import { _resetCsrfCache } from "@/auth/csrf";
import { _resetAccountForTests, getAccount, setAccount } from "@/auth/device-account";
import { _resetRefreshForTests } from "@/auth/refresh";
import { authReducer } from "@/redux/features/auth-slice";
import { connectivityReducer } from "@/redux/features/connectivity-slice";

import { baseApi } from "./base-api";
import { portalApi } from "./portal-api";

/**
 * Mrs Patricia Okafor signs in to the Lagoon View Academy parent app, and later
 * signs out. The app asks the school for a device session: the sign-in names
 * it, the account key it answers is the only thing the app remembers, and
 * signing out hands that key back so the school ends exactly that session.
 */
type Call = { url: string; method: string; body: unknown };
let calls: Call[];

function stubFetch(answer: (url: string, body: unknown) => Response) {
  globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = input instanceof Request ? input : null;
    const url = request ? request.url : String(input);
    const raw = request ? await request.clone().text() : String(init?.body ?? "");
    const body = raw ? JSON.parse(raw) : undefined;
    calls.push({ url, method: (init?.method ?? request?.method ?? "GET").toUpperCase(), body });
    return answer(url, body);
  }) as unknown as typeof fetch;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const makeStore = () =>
  configureStore({
    reducer: { [baseApi.reducerPath]: baseApi.reducer, auth: authReducer, connectivity: connectivityReducer },
    middleware: (gd) => gd().concat(baseApi.middleware),
  });

beforeEach(() => {
  calls = [];
  document.cookie = "csrftoken=abc; path=/";
  _resetCsrfCache();
  _resetRefreshForTests();
  _resetAccountForTests();
  setAccessToken("");
  (window as unknown as { happyDOM?: { setURL: (u: string) => void } }).happyDOM?.setURL(
    "http://lagoon-view.localhost:5176/parent/",
  );
});
afterEach(() => {
  document.cookie = "csrftoken=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
});

describe("signing in", () => {
  it("asks for a device session and keeps the account key it is given", async () => {
    stubFetch(() =>
      json({ data: { access: "tok-1", account: "a-patricia", tenant: { kind: "SCHOOL", slug: "lagoon-view" } } }),
    );
    const result = await makeStore().dispatch(
      portalApi.endpoints.login.initiate({ email: "patricia.okafor@example.ng", password: "Parent@School2026" }),
    );
    expect("data" in result && result.data?.data.account).toBe("a-patricia");
    const login = calls.find((c) => c.url.endsWith("/user/auth/login/"));
    expect(login?.body).toEqual({
      email: "patricia.okafor@example.ng",
      password: "Parent@School2026",
      tenant: "lagoon-view",
      session: "device",
    });
    expect(getAccessToken()).toBe("tok-1");
    expect(await getAccount()).toBe("a-patricia");
  });

  it("holds no access token for a CodeX staff account, but keeps the key to sign it out", async () => {
    stubFetch(() => json({ data: { access: "tok-staff", account: "a-staff", tenant: { kind: "PLATFORM" } } }));
    await makeStore().dispatch(portalApi.endpoints.login.initiate({ email: "ops@codexng.com", password: "x" }));
    expect(getAccessToken()).toBe("");
    expect(await getAccount()).toBe("a-staff");
  });

  it("keeps nothing when the school refuses with DEVICE_SESSION_NOT_OFFERED", async () => {
    stubFetch(() => json({ error: { code: "DEVICE_SESSION_NOT_OFFERED" } }, 403));
    const result = await makeStore().dispatch(
      portalApi.endpoints.login.initiate({ email: "bursar@lagoon-view.example", password: "x" }),
    );
    expect("error" in result && (result.error as { status: number }).status).toBe(403);
    expect(getAccessToken()).toBe("");
    expect(await getAccount()).toBeNull();
  });
});

describe("signing out", () => {
  it("hands the account key to the device sign-out route and forgets it", async () => {
    stubFetch(() => json({ data: {} }));
    await setAccount("a-patricia");
    setAccessToken("tok-1");
    await makeStore().dispatch(portalApi.endpoints.logout.initiate());
    const out = calls.find((c) => c.url.endsWith("/user/auth/device/sign-out/"));
    expect(out?.method).toBe("POST");
    expect(out?.body).toEqual({ account: "a-patricia" });
    // The local clean-up runs once the request has settled.
    await vi.waitFor(() => expect(getAccessToken()).toBe(""));
    await vi.waitFor(async () => expect(await getAccount()).toBeNull());
  });

  it("clears the app even when the school cannot be reached", async () => {
    globalThis.fetch = vi.fn(() => Promise.reject(new Error("down"))) as unknown as typeof fetch;
    await setAccount("a-patricia");
    setAccessToken("tok-1");
    const result = await makeStore().dispatch(portalApi.endpoints.logout.initiate());
    expect("error" in result).toBe(true);
    await vi.waitFor(() => expect(getAccessToken()).toBe(""));
    await vi.waitFor(async () => expect(await getAccount()).toBeNull());
  });

  it("calls nothing when nobody is signed in", async () => {
    stubFetch(() => json({}));
    await makeStore().dispatch(portalApi.endpoints.logout.initiate());
    expect(calls.some((c) => c.url.includes("/sign-out/"))).toBe(false);
  });
});
