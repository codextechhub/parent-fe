/**
 * Native push on Patricia's phone: she is registered with the school only
 * after choosing notifications, a refusal is remembered and never asked again,
 * and a school or build that cannot send phone push is never an error on
 * screen.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const phone = vi.hoisted(() => ({
  permission: "prompt" as "granted" | "denied" | "prompt",
  answer: "granted" as "granted" | "denied" | "prompt",
  token: "fcm-token-1",
  tokenError: null as Error | null,
  ask: vi.fn(),
  register: vi.fn(),
  forget: vi.fn(),
}));
vi.mock("./platform", () => ({ isNativeApp: () => true, nativePlatform: () => "android", isDebugBuild: () => false }));
vi.mock("./push-device", () => {
  class FirebaseNotConfiguredError extends Error {}
  return {
    FirebaseNotConfiguredError,
    osPermission: async () => phone.permission,
    askOsPermission: async () => {
      phone.ask();
      phone.permission = phone.answer;
      return phone.answer;
    },
    deviceToken: async () => {
      if (phone.tokenError) throw phone.tokenError;
      return phone.token;
    },
    firebaseConfigured: async () => true,
  };
});
vi.mock("./push-register", () => ({
  registerDevice: (token: string) => phone.register(token),
  forgetDevice: () => phone.forget(),
}));

import { pushChoice, setPushChoice } from "@/push/push-choice";

import { FirebaseNotConfiguredError } from "./push-device";
import {
  nativePushState,
  notNow,
  readPermission,
  resetNativePushState,
  syncDevice,
  turnOff,
  turnOn,
} from "./native-push-state";

beforeEach(() => {
  localStorage.clear();
  resetNativePushState();
  phone.permission = "prompt";
  phone.answer = "granted";
  phone.token = "fcm-token-1";
  phone.tokenError = null;
  phone.ask.mockReset();
  phone.register.mockReset().mockResolvedValue("ok");
  phone.forget.mockReset().mockResolvedValue(undefined);
});

describe("turning notifications on", () => {
  it("asks the phone, then registers the token and remembers the choice", async () => {
    expect(await turnOn()).toEqual({ ok: true });
    expect(phone.ask).toHaveBeenCalledTimes(1);
    expect(phone.register).toHaveBeenCalledWith("fcm-token-1");
    expect(pushChoice()).toBe("on");
  });

  it("does not ask again when the phone already allows notifications", async () => {
    phone.permission = "granted";
    await turnOn();
    expect(phone.ask).not.toHaveBeenCalled();
  });

  it("registers nothing when the phone says no, and says it is blocked", async () => {
    phone.answer = "denied";
    expect(await turnOn()).toEqual({ ok: false, reason: "blocked" });
    expect(phone.register).not.toHaveBeenCalled();
    expect(pushChoice()).toBeNull();
  });

  it("reads a dismissed prompt as not now, without a choice", async () => {
    phone.answer = "prompt";
    expect(await turnOn()).toEqual({ ok: false, reason: "dismissed" });
    expect(pushChoice()).toBeNull();
  });

  it("puts the offer away when the school sends no phone push", async () => {
    phone.register.mockResolvedValue("unavailable");
    expect(await turnOn()).toEqual({ ok: false, reason: "unavailable" });
    expect(pushChoice()).toBe("not-now");
  });

  it("reads a build without its Firebase file as unavailable, not as a failure", async () => {
    phone.tokenError = new FirebaseNotConfiguredError("no plist");
    expect(await turnOn()).toEqual({ ok: false, reason: "unavailable" });
    expect(phone.register).not.toHaveBeenCalled();
  });

  it("reports a failure without remembering a choice when the school cannot be reached", async () => {
    phone.register.mockResolvedValue("failed");
    expect(await turnOn()).toEqual({ ok: false, reason: "failed" });
    expect(pushChoice()).toBeNull();
  });
});

describe("the state of the setting", () => {
  it.each([
    [{ permission: "unknown", unavailable: false, choice: null }, "loading"],
    [{ permission: "granted", unavailable: true, choice: "on" }, "unavailable"],
    [{ permission: "denied", unavailable: false, choice: "on" }, "blocked"],
    [{ permission: "prompt", unavailable: false, choice: null }, "undecided"],
    [{ permission: "granted", unavailable: false, choice: "on" }, "on"],
    [{ permission: "granted", unavailable: false, choice: "off" }, "off"],
    [{ permission: "granted", unavailable: false, choice: "not-now" }, "off"],
  ] as const)("%j reads %s", (input, state) => {
    expect(nativePushState({ ...input })).toBe(state);
  });

  it("remembers a refusal of the offer and turns off on request", async () => {
    notNow();
    expect(pushChoice()).toBe("not-now");
    setPushChoice("on");
    await turnOff();
    expect(phone.forget).toHaveBeenCalled();
    expect(pushChoice()).toBe("off");
  });
});

describe("registering again", () => {
  it("does nothing for a parent who has not turned notifications on", async () => {
    phone.permission = "granted";
    await syncDevice();
    expect(phone.register).not.toHaveBeenCalled();
  });

  it("registers once for a token, and again when Firebase issues a new one", async () => {
    phone.permission = "granted";
    setPushChoice("on");
    await readPermission();
    await syncDevice();
    await syncDevice();
    expect(phone.register).toHaveBeenCalledTimes(1);
    await syncDevice("fcm-token-2");
    expect(phone.register).toHaveBeenLastCalledWith("fcm-token-2");
  });

  it("stays quiet when the phone has withdrawn permission", async () => {
    phone.permission = "denied";
    setPushChoice("on");
    await syncDevice();
    expect(phone.register).not.toHaveBeenCalled();
  });

  it("stops trying once the school says it sends no phone push", async () => {
    phone.permission = "granted";
    setPushChoice("on");
    phone.register.mockResolvedValue("unavailable");
    await syncDevice();
    await syncDevice("fcm-token-2");
    expect(phone.register).toHaveBeenCalledTimes(1);
  });
});
