/**
 * The messaging plugin as Capacitor hands it out: a proxy that answers every
 * property, `then` included, as a native method. Awaiting the proxy itself
 * (returning it from an async function, say) therefore fails on a real phone
 * though a plain mock would never show it.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const calls = vi.hoisted(() => ({ listeners: {} as Record<string, (event: unknown) => void>, remove: vi.fn() }));

vi.mock("./messaging-plugin", () => {
  const methods: Record<string, unknown> = {
    checkPermissions: async () => ({ receive: "prompt-with-rationale" }),
    requestPermissions: async () => ({ receive: "granted" }),
    getToken: async () => ({ token: "fcm-token" }),
    addListener: async (name: string, listener: (event: unknown) => void) => {
      calls.listeners[name] = listener;
      return { remove: calls.remove };
    },
  };
  const FirebaseMessaging = new Proxy(
    {},
    {
      get(_target, name: string) {
        if (name === "then") throw new Error('"FirebaseMessaging.then()" is not implemented');
        return methods[name];
      },
    },
  );
  return { FirebaseMessaging };
});

import { askOsPermission, deviceToken, onForeground, onTap, onTokenChange, osPermission } from "./push-device";

beforeEach(() => {
  calls.listeners = {};
  calls.remove.mockReset();
});

describe("the messaging plugin", () => {
  it("answers the permission, reading a rationale prompt as not yet asked", async () => {
    expect(await osPermission()).toBe("prompt");
    expect(await askOsPermission()).toBe("granted");
  });

  it("gives the install's token", async () => {
    expect(await deviceToken()).toBe("fcm-token");
  });

  it("delivers a tap, but not a dismissal, with the data the API attached", async () => {
    const tapped = vi.fn();
    const stop = await onTap(tapped);
    calls.listeners.notificationActionPerformed({ actionId: "dismiss", notification: { data: { url: "/parent/" } } });
    expect(tapped).not.toHaveBeenCalled();
    calls.listeners.notificationActionPerformed({
      actionId: "tap",
      notification: { title: "Tunde: A new notice", body: "Open the app.", data: { url: "/parent/notices", account: "a-parent" } },
    });
    expect(tapped).toHaveBeenCalledWith({
      title: "Tunde: A new notice",
      body: "Open the app.",
      data: { url: "/parent/notices", account: "a-parent" },
    });
    stop();
    expect(calls.remove).toHaveBeenCalled();
  });

  it("delivers a notification that arrived in the open app, and a new token", async () => {
    const arrived = vi.fn();
    const renewed = vi.fn();
    await onForeground(arrived);
    await onTokenChange(renewed);
    calls.listeners.notificationReceived({ notification: { title: "t", body: "b" } });
    calls.listeners.tokenReceived({ token: "fcm-token-2" });
    expect(arrived).toHaveBeenCalledWith({ title: "t", body: "b", data: {} });
    expect(renewed).toHaveBeenCalledWith("fcm-token-2");
  });
});
