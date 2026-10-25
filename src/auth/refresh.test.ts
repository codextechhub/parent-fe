import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getAccessToken, setAccessToken } from "./access-token";
import { _resetCsrfCache } from "./csrf";
import { _resetAccountForTests, getAccount, setAccount } from "./device-account";
import { _resetRefreshForTests, markSessionInvalidated, refreshTokenSingleFlight } from "./refresh";

const BASE = "http://test.local/v1";

type FetchCall = Parameters<typeof fetch>;
let calls: FetchCall[] = [];

function stubFetch(answerBy: (url: string, init?: RequestInit) => Response | Promise<Response>) {
  globalThis.fetch = vi.fn(async (input, init) => {
    const url = typeof input === "string" ? input : input.toString();
    calls.push([input, init] as FetchCall);
    return answerBy(url, init);
  }) as unknown as typeof fetch;
}

beforeEach(() => {
  calls = [];
  document.cookie = "csrftoken=abc; path=/";
  _resetCsrfCache();
  _resetRefreshForTests();
  _resetAccountForTests();
  setAccessToken("");
});

afterEach(() => {
  document.cookie = "csrftoken=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
});

const REFRESH = "/user/auth/device/refresh/";
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const refreshCalls = () => calls.filter(([u]) => typeof u === "string" && u.endsWith(REFRESH));

describe("refreshTokenSingleFlight", () => {
  beforeEach(async () => {
    await setAccount("a-patricia");
  });

  it("stores the fresh access token on 200", async () => {
    stubFetch((url) => {
      if (url.endsWith("/user/auth/device/refresh/")) {
        return new Response(JSON.stringify({ data: { access: "fresh-1", session_id: 7 } }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      return new Response("{}", { status: 200 });
    });
    const result = await refreshTokenSingleFlight();
    expect(result).toEqual({ ok: true, access: "fresh-1" });
    expect(getAccessToken()).toBe("fresh-1");
  });

  it("flags token_invalid on 401", async () => {
    stubFetch(() => new Response("{}", { status: 401 }));
    const result = await refreshTokenSingleFlight();
    expect(result).toEqual({ ok: false, reason: "token_invalid" });
  });

  it("flags server_error on 500", async () => {
    stubFetch(() => new Response("{}", { status: 500 }));
    const result = await refreshTokenSingleFlight();
    expect(result).toEqual({ ok: false, reason: "server_error" });
  });

  it("flags network_error on throw", async () => {
    globalThis.fetch = vi.fn(() => Promise.reject(new Error("down"))) as unknown as typeof fetch;
    const result = await refreshTokenSingleFlight();
    expect(result).toEqual({ ok: false, reason: "network_error" });
  });

  it("shares one in-flight refresh for concurrent callers", async () => {
    const pending: Array<(r: Response) => void> = [];
    globalThis.fetch = vi.fn((input) => {
      const url = typeof input === "string" ? input : input.toString();
      calls.push([input] as FetchCall);
      if (url.endsWith("/user/auth/device/refresh/")) {
        return new Promise<Response>((r) => pending.push(r));
      }
      return Promise.resolve(new Response("{}", { status: 200 }));
    }) as unknown as typeof fetch;
    const first = refreshTokenSingleFlight();
    const second = refreshTokenSingleFlight();
    // Let the CSRF-cookie branch run and reach the fetch.
    await Promise.resolve();
    await Promise.resolve();
    expect(pending.length).toBe(1);
    pending[0](
      new Response(JSON.stringify({ data: { access: "fresh-2" } }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    const [a, b] = await Promise.all([first, second]);
    expect(a).toEqual({ ok: true, access: "fresh-2" });
    expect(b).toEqual({ ok: true, access: "fresh-2" });
    expect(refreshCalls().length).toBe(1);
  });

  it("refuses after markSessionInvalidated", async () => {
    stubFetch(() =>
      new Response(JSON.stringify({ data: { access: "x" } }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    markSessionInvalidated();
    const result = await refreshTokenSingleFlight();
    expect(result).toEqual({ ok: false, reason: "no_token" });
    expect(getAccessToken()).toBe("");
  });

  it("sends X-CSRFToken when the cookie is set", async () => {
    stubFetch(() =>
      new Response(JSON.stringify({ data: { access: "y" } }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    await refreshTokenSingleFlight();
    const call = calls[0];
    expect(call?.[0]).toBe(`${BASE}/user/auth/device/refresh/`);
    const headers = call?.[1]?.headers as Record<string, string>;
    expect(headers["X-CSRFToken"]).toBe("abc");
  });
  it("asks the device route with the account key and CSRF, and sends nothing else", async () => {
    stubFetch(() => json({ data: { access: "fresh-3" } }));
    await refreshTokenSingleFlight();
    const [, init] = refreshCalls()[0];
    expect(init?.method).toBe("POST");
    expect(init?.credentials).toBe("include");
    expect(JSON.parse(String(init?.body))).toEqual({ account: "a-patricia" });
  });

  it("retries once on 409 TOKEN_STALE and takes the second answer", async () => {
    const answers = [
      () => json({ error: { code: "TOKEN_STALE" } }, 409),
      () => json({ data: { access: "after-stale" } }),
    ];
    stubFetch(() => (answers.shift() ?? (() => json({}, 500)))());
    const result = await refreshTokenSingleFlight();
    expect(result).toEqual({ ok: true, access: "after-stale" });
    expect(refreshCalls().length).toBe(2);
    expect(await getAccount()).toBe("a-patricia");
  });

  it("gives up as a server error when the retry is stale as well", async () => {
    stubFetch(() => json({ error: { code: "TOKEN_STALE" } }, 409));
    const result = await refreshTokenSingleFlight();
    expect(result).toEqual({ ok: false, reason: "server_error" });
    expect(refreshCalls().length).toBe(2);
    expect(await getAccount()).toBe("a-patricia");
  });

  it.each(["TOKEN_EXPIRED", "TOKEN_REVOKED", "TOKEN_INVALID"])(
    "ends the sign-in on 401 %s and forgets the account",
    async (code) => {
      stubFetch(() => json({ error: { code } }, 401));
      const result = await refreshTokenSingleFlight();
      expect(result).toEqual({ ok: false, reason: "token_invalid" });
      expect(await getAccount()).toBeNull();
    },
  );

  it("keeps the account through a server error", async () => {
    stubFetch(() => new Response("{}", { status: 500 }));
    await refreshTokenSingleFlight();
    expect(await getAccount()).toBe("a-patricia");
  });

  it("has nothing to refresh with when nobody is signed in", async () => {
    _resetAccountForTests();
    stubFetch(() => json({ data: { access: "x" } }));
    const result = await refreshTokenSingleFlight();
    expect(result).toEqual({ ok: false, reason: "no_token" });
    expect(refreshCalls().length).toBe(0);
  });
});
