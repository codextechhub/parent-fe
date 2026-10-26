/**
 * The parent's sign-in in the store app: Patricia's refresh credential lives in
 * the phone's secure storage and travels in the body, with no cookie and no
 * CSRF token. A browser is unchanged.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const phone = vi.hoisted(() => ({
  native: true,
  credentials: new Map<string, string>(),
  unreadable: false,
  unwritable: false,
}));
vi.mock("@/native/platform", () => ({ isNativeApp: () => phone.native, routerBasename: () => "/" }));
vi.mock("@/native/credentials", () => ({
  getCredential: vi.fn(async (account: string) => {
    if (phone.unreadable) throw new Error("locked");
    return phone.credentials.get(account) ?? null;
  }),
  putCredential: vi.fn(async (account: string, refresh: string) => {
    if (phone.unwritable) throw new Error("locked");
    phone.credentials.set(account, refresh);
  }),
  deleteCredential: vi.fn(async (account: string) => void phone.credentials.delete(account)),
}));

import { getAccessToken, setAccessToken } from "./access-token";
import { _resetAccountForTests, getAccount, setAccount } from "./device-account";
import { deviceSignOut, keepNativeCredential } from "./device-credential";
import { _resetRefreshForTests, refreshTokenSingleFlight } from "./refresh";
import { routeFetch } from "./test-fetch";

const REFRESH = "POST /user/auth/device/refresh/";
const SIGN_OUT = "POST /user/auth/device/sign-out/";
const CSRF = "GET /user/auth/csrf/";

beforeEach(async () => {
  phone.native = true;
  phone.unreadable = false;
  phone.unwritable = false;
  phone.credentials.clear();
  _resetRefreshForTests();
  _resetAccountForTests();
  setAccessToken("");
  await setAccount("n-1");
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("refreshing in the store app", () => {
  it("sends the stored credential in the body and keeps the rotated one, with no CSRF and no cookies", async () => {
    phone.credentials.set("n-1", "r-old");
    const { calls, fetchMock } = routeFetch({
      [REFRESH]: { status: 200, body: { data: { access: "acc-1", refresh: "r-new", account: "n-1" } } },
    });
    expect(await refreshTokenSingleFlight()).toEqual({ ok: true, access: "acc-1" });
    const sent = calls.find((c) => c.key === REFRESH)!;
    expect(sent.body).toEqual({ account: "n-1", refresh: "r-old" });
    expect(sent.headers["X-CSRFToken"]).toBeUndefined();
    expect(calls.some((c) => c.key === CSRF)).toBe(false);
    expect(fetchMock.mock.calls[0][1]?.credentials).toBe("omit");
    expect(phone.credentials.get("n-1")).toBe("r-new");
    expect(getAccessToken()).toBe("acc-1");
  });

  it("ends the sign-in, and forgets the credential and the account, when the API says it is over", async () => {
    phone.credentials.set("n-1", "r-old");
    routeFetch({ [REFRESH]: { status: 401, body: { error: { error_code: "TOKEN_REVOKED" } } } });
    expect(await refreshTokenSingleFlight()).toEqual({ ok: false, reason: "token_invalid" });
    expect(phone.credentials.has("n-1")).toBe(false);
    expect(await getAccount()).toBeNull();
  });

  it("asks again on a stale answer with the credential still stored", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout"] });
    phone.credentials.set("n-1", "r-old");
    let n = 0;
    const { calls } = routeFetch({
      [REFRESH]: () =>
        ++n === 1
          ? { status: 409, body: { error: { error_code: "TOKEN_STALE" } } }
          : { status: 200, body: { data: { access: "acc-3", refresh: "r-3" } } },
    });
    const pending = refreshTokenSingleFlight();
    await vi.advanceTimersByTimeAsync(500);
    expect(await pending).toEqual({ ok: true, access: "acc-3" });
    expect(calls.filter((c) => c.key === REFRESH).map((c) => (c.body as { refresh: string }).refresh)).toEqual(["r-old", "r-old"]);
    expect(phone.credentials.get("n-1")).toBe("r-3");
  });

  it("treats a parent with no stored credential as signed out, without calling the API", async () => {
    const { calls } = routeFetch({});
    expect(await refreshTokenSingleFlight()).toEqual({ ok: false, reason: "token_invalid" });
    expect(calls).toHaveLength(0);
  });

  it("decides nothing when the secure storage cannot be read", async () => {
    phone.credentials.set("n-1", "r-old");
    phone.unreadable = true;
    const { calls } = routeFetch({});
    expect(await refreshTokenSingleFlight()).toEqual({ ok: false, reason: "server_error" });
    expect(calls).toHaveLength(0);
    expect(phone.credentials.get("n-1")).toBe("r-old");
    expect(await getAccount()).toBe("n-1");
  });

  it("keeps the sign-in when the school cannot be reached", async () => {
    phone.credentials.set("n-1", "r-old");
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("Failed to fetch"); }));
    expect(await refreshTokenSingleFlight()).toEqual({ ok: false, reason: "network_error" });
    expect(phone.credentials.get("n-1")).toBe("r-old");
  });
});

describe("signing in and out in the store app", () => {
  it("sign-out sends the credential in the body, then forgets it", async () => {
    phone.credentials.set("n-1", "r-1");
    phone.credentials.set("n-2", "r-2");
    const { calls } = routeFetch({ [SIGN_OUT]: { status: 200, body: { data: {} } } });
    await deviceSignOut("n-1");
    expect(calls.find((c) => c.key === SIGN_OUT)!.body).toEqual({ account: "n-1", refresh: "r-1" });
    expect(phone.credentials.has("n-1")).toBe(false);
    expect(phone.credentials.get("n-2")).toBe("r-2");
  });

  it("keeps a new sign-in's credential", async () => {
    expect(await keepNativeCredential("n-1", "r-fresh")).toBe(true);
    expect(phone.credentials.get("n-1")).toBe("r-fresh");
  });

  it("ends a sign-in whose credential cannot be kept, on the API's side too", async () => {
    phone.unwritable = true;
    const { calls } = routeFetch({ [SIGN_OUT]: { status: 200, body: { data: {} } } });
    expect(await keepNativeCredential("n-1", "r-fresh")).toBe(false);
    expect(calls.find((c) => c.key === SIGN_OUT)!.body).toEqual({ account: "n-1", refresh: "r-fresh" });
  });

  it("refuses a sign-in that came with no credential", async () => {
    const { calls } = routeFetch({});
    expect(await keepNativeCredential("n-1", undefined)).toBe(false);
    expect(calls).toHaveLength(0);
  });
});

describe("the browser is unchanged", () => {
  beforeEach(() => {
    phone.native = false;
    document.cookie = "csrftoken=csrf-test; path=/";
  });

  it("refreshes by the account alone, with cookies and the CSRF token", async () => {
    const { calls, fetchMock } = routeFetch({ [REFRESH]: { status: 200, body: { data: { access: "web-1" } } } });
    await refreshTokenSingleFlight();
    expect(calls.find((c) => c.key === REFRESH)!.body).toEqual({ account: "n-1" });
    expect(calls.find((c) => c.key === REFRESH)!.headers["X-CSRFToken"]).toBe("csrf-test");
    expect(fetchMock.mock.calls.at(-1)?.[1]?.credentials).toBe("include");
  });

  it("signs out by the account alone and touches no secure storage", async () => {
    phone.credentials.set("n-1", "never-used");
    const { calls } = routeFetch({ [SIGN_OUT]: { status: 200, body: { data: {} } } });
    await deviceSignOut("n-1");
    expect(calls.find((c) => c.key === SIGN_OUT)!.body).toEqual({ account: "n-1" });
    expect(phone.credentials.get("n-1")).toBe("never-used");
  });
});
