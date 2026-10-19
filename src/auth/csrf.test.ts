import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { _resetCsrfCache, getCsrfToken, readCsrfToken } from "./csrf";

beforeEach(() => {
  document.cookie = "csrftoken=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
  _resetCsrfCache();
});

afterEach(() => {
  document.cookie = "csrftoken=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
});

describe("csrf", () => {
  it("reads the token from the cookie when it is set", async () => {
    document.cookie = "csrftoken=cookie-token; path=/";
    const token = await getCsrfToken();
    expect(token).toBe("cookie-token");
    expect(readCsrfToken()).toBe("cookie-token");
  });

  it("fetches /user/auth/csrf/ when there is no cookie yet", async () => {
    const fetchStub = vi.fn(async (input: Parameters<typeof fetch>[0]) => {
      const url = typeof input === "string" ? input : input.toString();
      expect(url).toBe("http://test.local/v1/user/auth/csrf/");
      // The real server would ALSO Set-Cookie on the response; here we just
      // return the token in the body (happy-dom does not synthesise cookies
      // from a Response unless the fetch is handled by a service worker).
      return new Response(JSON.stringify({ data: { csrf_token: "body-token" } }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });
    globalThis.fetch = fetchStub as unknown as typeof fetch;
    const token = await getCsrfToken();
    expect(token).toBe("body-token");
    expect(fetchStub).toHaveBeenCalledTimes(1);
  });

  it("returns empty string on fetch failure", async () => {
    globalThis.fetch = (() => Promise.reject(new Error("down"))) as unknown as typeof fetch;
    const token = await getCsrfToken();
    expect(token).toBe("");
  });
});
