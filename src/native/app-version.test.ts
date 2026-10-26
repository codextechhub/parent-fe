import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const store = vi.hoisted(() => new Map<string, string>());
vi.mock("@capacitor/preferences", () => ({
  Preferences: {
    get: vi.fn(async ({ key }: { key: string }) => ({ value: store.get(key) ?? null })),
    set: vi.fn(async ({ key, value }: { key: string; value: string }) => void store.set(key, value)),
  },
}));

import {
  APP_ID,
  checkForUpdate,
  decideNotice,
  fetchVersionPolicy,
  readDismissedLatest,
  rememberDismissedLatest,
  shouldCheckAgain,
  type VersionPolicy,
} from "./app-version";

beforeEach(() => store.clear());
afterEach(() => vi.unstubAllGlobals());

const policy = (over: Partial<VersionPolicy> = {}): VersionPolicy => ({
  app: APP_ID,
  platform: "ios",
  minimum: "1.0.0",
  latest: "1.2.0",
  store_url: "https://apps.apple.com/app/xvs-parent/id1",
  status: "current",
  ...over,
});

const answering = (status: number, body: unknown = {}) =>
  vi.fn(async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;

describe("fetchVersionPolicy", () => {
  it("sends the app, the platform and the version to the public route, with no cookies", async () => {
    const fetcher = answering(200, policy());
    await fetchVersionPolicy("ios", "1.0.0", fetcher);
    const [address, init] = (fetcher as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(String(address)).toBe(
      "http://test.local/v1/app-versions/?app=com.codexng.xvs.parent&platform=ios&version=1.0.0",
    );
    expect(init.credentials).toBe("omit");
  });

  it("returns the policy the API gave, bare or inside a data envelope", async () => {
    const bare = await fetchVersionPolicy("ios", "1.0.0", answering(200, policy({ status: "update_available" })));
    expect(bare).toEqual({ kind: "policy", policy: policy({ status: "update_available" }) });
    const wrapped = await fetchVersionPolicy("ios", "1.0.0", answering(200, { data: policy({ status: "update_required" }) }));
    expect(wrapped.kind === "policy" && wrapped.policy.status).toBe("update_required");
  });

  it("says there is no policy on a 404", async () => {
    expect(await fetchVersionPolicy("ios", "1.0.0", answering(404))).toEqual({ kind: "none" });
  });

  it("decides nothing when offline, on a server error or on a body that is no policy", async () => {
    const offline = vi.fn(async () => { throw new TypeError("Failed to fetch"); }) as unknown as typeof fetch;
    expect(await fetchVersionPolicy("ios", "1.0.0", offline)).toEqual({ kind: "unknown" });
    expect(await fetchVersionPolicy("ios", "1.0.0", answering(503))).toEqual({ kind: "unknown" });
    expect(await fetchVersionPolicy("ios", "1.0.0", answering(200, { status: "surprise" }))).toEqual({ kind: "unknown" });
    expect(await fetchVersionPolicy("ios", "1.0.0", answering(200, "not json at all"))).toEqual({ kind: "unknown" });
  });
});

describe("decideNotice", () => {
  it("blocks on update_required, and a dismissal never lifts it", () => {
    expect(decideNotice(policy({ status: "update_required" }), "1.2.0")).toEqual({
      kind: "required",
      storeUrl: "https://apps.apple.com/app/xvs-parent/id1",
    });
  });

  it("offers update_available as a note carrying the latest version", () => {
    expect(decideNotice(policy({ status: "update_available" }), null)).toEqual({
      kind: "available",
      latest: "1.2.0",
      storeUrl: "https://apps.apple.com/app/xvs-parent/id1",
    });
  });

  it("shows nothing when current", () => {
    expect(decideNotice(policy({ status: "current" }), null)).toBeNull();
  });

  it("stays quiet for a latest the parent dismissed, and returns for a newer one", () => {
    const available = (latest: string) => policy({ status: "update_available", latest });
    expect(decideNotice(available("1.2.0"), "1.2.0")).toBeNull();
    expect(decideNotice(available("1.3.0"), "1.2.0")).toMatchObject({ kind: "available", latest: "1.3.0" });
  });
});

describe("dismissal memory", () => {
  it("remembers the dismissed latest version across reads", async () => {
    expect(await readDismissedLatest()).toBeNull();
    await rememberDismissedLatest("1.2.0");
    expect(await readDismissedLatest()).toBe("1.2.0");
  });
});

describe("checkForUpdate", () => {
  const version = async () => "1.0.0";

  it("returns the blocking notice for update_required", async () => {
    const answer = await checkForUpdate("ios", version, answering(200, policy({ status: "update_required" })));
    expect(answer).toMatchObject({ kind: "required" });
  });

  it("returns the note for update_available until it is dismissed, then nothing for that version", async () => {
    const fetcher = () => answering(200, policy({ status: "update_available" }));
    expect(await checkForUpdate("ios", version, fetcher())).toMatchObject({ kind: "available", latest: "1.2.0" });
    await rememberDismissedLatest("1.2.0");
    expect(await checkForUpdate("ios", version, fetcher())).toBeNull();
  });

  it("returns nothing to show for current and for a 404", async () => {
    expect(await checkForUpdate("ios", version, answering(200, policy()))).toBeNull();
    expect(await checkForUpdate("ios", version, answering(404))).toBeNull();
  });

  it("returns no answer when offline or when the version cannot be read, so the app carries on", async () => {
    const offline = vi.fn(async () => { throw new TypeError("Failed to fetch"); }) as unknown as typeof fetch;
    expect(await checkForUpdate("ios", version, offline)).toBeUndefined();
    expect(await checkForUpdate("ios", async () => { throw new Error("no shell"); }, answering(200, policy()))).toBeUndefined();
  });
});

describe("shouldCheckAgain", () => {
  const hour = 60 * 60 * 1000;
  it("checks the first time, and again only after the gap", () => {
    expect(shouldCheckAgain(null, 1000)).toBe(true);
    expect(shouldCheckAgain(0, 3 * hour)).toBe(false);
    expect(shouldCheckAgain(0, 4 * hour)).toBe(true);
  });
});
