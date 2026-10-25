/**
 * Push notifications for the signed-in parent on this browser.
 *
 * Turning them on asks the browser's permission and then tells the school
 * about this browser's one subscription for the signed-in parent. Turning
 * them off tells the school to forget this parent's row; the browser's own
 * subscription is left in place.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const calls = vi.hoisted(() => ({ sent: [] as Array<{ endpoint: string; args: unknown }> }));

vi.mock("@/redux/services/push-api", () => {
  const endpoint = (name: string) => ({ initiate: (args?: unknown) => ({ name, args }) });
  return {
    pushApi: {
      endpoints: {
        pushKey: endpoint("pushKey"),
        subscribePush: endpoint("subscribePush"),
        unsubscribePush: endpoint("unsubscribePush"),
      },
    },
  };
});

import { _resetAccountForTests, setAccount } from "@/auth/device-account";

import { pushChoice, setPushChoice } from "./push-choice";
import {
  dropPushOnSignOut,
  keyBytes,
  refreshPush,
  routerPath,
  turnOffPush,
  turnOnPush,
} from "./push";
import { pushStateFrom } from "./use-push";

const SCHOOL_KEY = "BAECAwQ";
const OTHER_KEY = "BAkICAk";

type FakeSubscription = {
  endpoint: string;
  options: { applicationServerKey: ArrayBuffer };
  unsubscribe: ReturnType<typeof vi.fn>;
  toJSON: () => { endpoint: string; keys: { p256dh: string; auth: string } };
};

function fakeSubscription(endpoint: string, key: string): FakeSubscription {
  return {
    endpoint,
    options: { applicationServerKey: keyBytes(key).buffer },
    unsubscribe: vi.fn(async () => true),
    toJSON: () => ({ endpoint, keys: { p256dh: "p-key", auth: "a-key" } }),
  };
}

let existing: FakeSubscription | null;
let permission: NotificationPermission;
let answer: NotificationPermission;
const subscribe = vi.fn();

const dispatch = vi.fn((action: { name: string; args: unknown }) => {
  calls.sent.push({ endpoint: action.name, args: action.args });
  return { unwrap: async () => (action.name === "pushKey" ? SCHOOL_KEY : undefined) };
}) as never;

beforeEach(async () => {
  _resetAccountForTests();
  await setAccount("a-patricia");
  calls.sent = [];
  existing = null;
  permission = "default";
  answer = "granted";
  localStorage.clear();
  subscribe.mockReset().mockImplementation(async () => {
    existing = fakeSubscription("https://push.example/new", SCHOOL_KEY);
    return existing;
  });
  vi.stubGlobal("Notification", {
    get permission() {
      return permission;
    },
    requestPermission: vi.fn(async () => {
      permission = answer;
      return answer;
    }),
  });
  vi.stubGlobal("PushManager", function PushManager() {});
  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: {
      ready: Promise.resolve({
        pushManager: { getSubscription: async () => existing, subscribe },
      }),
    },
  });
});
afterEach(() => vi.unstubAllGlobals());

describe("turnOnPush", () => {
  it("asks permission from the tap and subscribes with the school's key", async () => {
    answer = "granted";
    const result = await turnOnPush(dispatch);
    expect(result).toEqual({ ok: true });
    const keyCall = calls.sent.find((c) => c.endpoint === "pushKey");
    const sub = calls.sent.find((c) => c.endpoint === "subscribePush");
    expect(keyCall).toBeTruthy();
    expect(sub?.args).toEqual({
      endpoint: "https://push.example/new",
      keys: { p256dh: "p-key", auth: "a-key" },
      account: "a-patricia",
    });
    expect(pushChoice()).toBe("on");
  });

  it("names no account when nobody has a device session", async () => {
    _resetAccountForTests();
    await turnOnPush(dispatch);
    const sub = calls.sent.find((c) => c.endpoint === "subscribePush");
    expect((sub?.args as Record<string, unknown>)?.account).toBeUndefined();
  });

  it("returns blocked when the browser refuses permission", async () => {
    answer = "denied";
    const result = await turnOnPush(dispatch);
    expect(result).toEqual({ ok: false, reason: "blocked" });
    // Nothing posted to the school.
    expect(calls.sent.find((c) => c.endpoint === "subscribePush")).toBeUndefined();
    expect(pushChoice()).toBeNull();
  });

  it("returns dismissed when the browser prompt is dismissed", async () => {
    answer = "default";
    const result = await turnOnPush(dispatch);
    expect(result).toEqual({ ok: false, reason: "dismissed" });
    expect(pushChoice()).toBeNull();
  });

  it("re-subscribes under the school's new key if it rotated", async () => {
    const old = fakeSubscription("https://push.example/old", OTHER_KEY);
    existing = old;
    answer = "granted";
    await turnOnPush(dispatch);
    expect(old.unsubscribe).toHaveBeenCalled();
    expect(subscribe).toHaveBeenCalled();
  });
});

describe("turnOffPush", () => {
  it("asks the school to forget this parent's device", async () => {
    existing = fakeSubscription("https://push.example/kept", SCHOOL_KEY);
    setPushChoice("on");
    const done = await turnOffPush(dispatch);
    expect(done).toBe(true);
    const unsub = calls.sent.find((c) => c.endpoint === "unsubscribePush");
    expect(unsub?.args).toEqual({ endpoint: "https://push.example/kept" });
    // The browser-level subscription is left in place; only the server row goes.
    expect(existing!.unsubscribe).not.toHaveBeenCalled();
    expect(pushChoice()).toBe("off");
  });
});

describe("refreshPush", () => {
  it("re-sends the subscription on open when the parent chose `on`", async () => {
    existing = fakeSubscription("https://push.example/current", SCHOOL_KEY);
    permission = "granted";
    setPushChoice("on");
    await refreshPush(dispatch);
    expect(calls.sent.find((c) => c.endpoint === "subscribePush")?.args).toEqual({
      endpoint: "https://push.example/current",
      keys: { p256dh: "p-key", auth: "a-key" },
      account: "a-patricia",
    });
  });

  it("does nothing when the parent chose `off`", async () => {
    permission = "granted";
    setPushChoice("off");
    await refreshPush(dispatch);
    expect(calls.sent).toHaveLength(0);
  });
});

describe("dropPushOnSignOut", () => {
  it("DELETEs the server row and leaves the browser subscription alone", async () => {
    existing = fakeSubscription("https://push.example/bye", SCHOOL_KEY);
    await dropPushOnSignOut(dispatch);
    expect(calls.sent.find((c) => c.endpoint === "unsubscribePush")?.args).toEqual({
      endpoint: "https://push.example/bye",
    });
    expect(existing!.unsubscribe).not.toHaveBeenCalled();
  });
});

describe("routerPath", () => {
  it("peels the /parent prefix for react-router", () => {
    expect(routerPath("/parent/fees")).toBe("/fees");
    expect(routerPath("/parent/notices")).toBe("/notices");
    expect(routerPath("/parent/")).toBe("/");
    expect(routerPath("/parent")).toBe("/");
    expect(routerPath("/student/fees")).toBe("/");
    expect(routerPath("")).toBe("/");
  });
});

describe("pushStateFrom", () => {
  it("flows through the states a parent sees", () => {
    const base = {
      support: "ready" as const,
      keyState: "ready" as const,
      permission: "default" as NotificationPermission,
      choice: null,
    };
    expect(pushStateFrom(base)).toBe("undecided");
    expect(pushStateFrom({ ...base, choice: "on", permission: "granted" })).toBe("on");
    expect(pushStateFrom({ ...base, choice: "on", permission: "default" })).toBe("off");
    expect(pushStateFrom({ ...base, choice: "off" })).toBe("off");
    expect(pushStateFrom({ ...base, choice: "not-now" })).toBe("off");
    expect(pushStateFrom({ ...base, permission: "denied" })).toBe("blocked");
    expect(pushStateFrom({ ...base, support: "install-first" })).toBe("install-first");
    expect(pushStateFrom({ ...base, support: "unsupported" })).toBe("unavailable");
    expect(pushStateFrom({ ...base, keyState: "missing" })).toBe("unavailable");
    expect(pushStateFrom({ ...base, keyState: "loading" })).toBe("loading");
  });
});
