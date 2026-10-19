import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getAccessToken, setAccessToken } from "./access-token";
import { _resetCsrfCache } from "./csrf";
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
  setAccessToken("");
});

afterEach(() => {
  document.cookie = "csrftoken=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
});

describe("refreshTokenSingleFlight", () => {
  it("stores the fresh access token on 200", async () => {
    stubFetch((url) => {
      if (url.endsWith("/user/auth/token/refresh/")) {
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
      if (url.endsWith("/user/auth/token/refresh/")) {
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
    const refreshCalls = calls.filter(
      ([u]) => typeof u === "string" && u.endsWith("/user/auth/token/refresh/"),
    );
    expect(refreshCalls.length).toBe(1);
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
    expect(call?.[0]).toBe(`${BASE}/user/auth/token/refresh/`);
    const headers = call?.[1]?.headers as Record<string, string>;
    expect(headers["X-CSRFToken"]).toBe("abc");
  });
});
