import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getAccessToken, setAccessToken } from "./access-token";
import { _resetCsrfCache } from "./csrf";
import {
  HANDOVER_KEY,
  _resetAccountForTests,
  adoptHandover,
  getAccount,
  setAccount,
} from "./device-account";
import { _resetRefreshForTests, refreshTokenSingleFlight } from "./refresh";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

beforeEach(() => {
  document.cookie = "csrftoken=abc; path=/";
  _resetCsrfCache();
  _resetRefreshForTests();
  _resetAccountForTests();
  setAccessToken("");
  sessionStorage.clear();
});

afterEach(() => {
  document.cookie = "csrftoken=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
  sessionStorage.clear();
  vi.restoreAllMocks();
});

describe("taking over a sign-in school-fe handed across", () => {
  it("names the key school-fe writes", () => {
    expect(HANDOVER_KEY).toBe("xvs.parent.handover");
  });

  it("adopts the account as the signed-in one and removes the key", async () => {
    sessionStorage.setItem(HANDOVER_KEY, "a-patricia");

    expect(await adoptHandover()).toBe(true);

    expect(await getAccount()).toBe("a-patricia");
    expect(sessionStorage.getItem(HANDOVER_KEY)).toBeNull();
  });

  it("keeps the adopted account in the browser's storage for the next visit", async () => {
    sessionStorage.setItem(HANDOVER_KEY, "a-patricia");

    await adoptHandover();

    expect(localStorage.getItem(Object.keys(localStorage)[0])).toBe("a-patricia");
  });

  it("replaces an account kept from an earlier visit", async () => {
    await setAccount("a-old");
    sessionStorage.setItem(HANDOVER_KEY, "a-new");

    await adoptHandover();

    expect(await getAccount()).toBe("a-new");
  });

  it("lets the ordinary refresh get the access token from the handed-over account", async () => {
    sessionStorage.setItem(HANDOVER_KEY, "a-patricia");
    const fetchMock = vi.fn(async () => json({ data: { access: "fresh-1" } }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await adoptHandover();
    const result = await refreshTokenSingleFlight();

    expect(result).toEqual({ ok: true, access: "fresh-1" });
    expect(getAccessToken()).toBe("fresh-1");
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toMatch(/\/user\/auth\/device\/refresh\/$/);
    expect(JSON.parse(String(init.body))).toMatchObject({ account: "a-patricia" });
  });

  it("changes nothing when no key was left", async () => {
    await setAccount("a-patricia");

    expect(await adoptHandover()).toBe(false);

    expect(await getAccount()).toBe("a-patricia");
  });

  it("leaves nobody signed in when there is no key and no stored account", async () => {
    expect(await adoptHandover()).toBe(false);

    expect(await getAccount()).toBeNull();
  });

  it("treats unreadable session storage as no hand-over", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });

    expect(await adoptHandover()).toBe(false);
  });

  it("leads to sign-in when the refresh is refused: no token, and the account is forgotten", async () => {
    sessionStorage.setItem(HANDOVER_KEY, "a-patricia");
    globalThis.fetch = vi.fn(async () => json({}, 401)) as unknown as typeof fetch;

    await adoptHandover();
    const result = await refreshTokenSingleFlight();

    expect(result).toEqual({ ok: false, reason: "token_invalid" });
    expect(getAccessToken()).toBeFalsy();
    expect(await getAccount()).toBeNull();
    expect(sessionStorage.getItem(HANDOVER_KEY)).toBeNull();
  });
});
