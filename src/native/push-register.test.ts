import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ request: vi.fn(), account: "a-patricia" as string | null }));
vi.mock("@/auth/parent-fetch", () => ({ parentRequest: (...args: unknown[]) => mocks.request(...args) }));
vi.mock("@/auth/device-account", () => ({ getAccount: async () => mocks.account }));
vi.mock("./platform", () => ({ isNativeApp: () => true, nativePlatform: () => "ios", isDebugBuild: () => false }));
vi.mock("./app-version", () => ({ APP_ID: "com.codexng.xvs.parent", installedVersion: async () => "1.0.0" }));
vi.mock("./push-device", () => ({ deviceToken: async () => "fcm-1" }));

import { forgetDevice, registerDevice } from "./push-register";

beforeEach(() => {
  mocks.request.mockReset().mockResolvedValue({ status: 201, code: "" });
  mocks.account = "a-patricia";
});

describe("registering the phone", () => {
  it("posts the token with the parent app, the platform and the sign-in's account", async () => {
    expect(await registerDevice("fcm-1")).toBe("ok");
    expect(mocks.request).toHaveBeenCalledWith("POST", "/notify/push/devices/", {
      token: "fcm-1",
      platform: "ios",
      app: "com.codexng.xvs.parent",
      app_version: "1.0.0",
      account: "a-patricia",
    });
  });

  it("reads a school without phone push as unavailable, and any other refusal as a failure", async () => {
    mocks.request.mockResolvedValueOnce({ status: 503, code: "PUSH_NOT_CONFIGURED" });
    expect(await registerDevice("fcm-1")).toBe("unavailable");
    mocks.request.mockResolvedValueOnce({ status: 503, code: "" });
    expect(await registerDevice("fcm-1")).toBe("failed");
    mocks.request.mockResolvedValueOnce({ status: 0, code: "" });
    expect(await registerDevice("fcm-1")).toBe("failed");
  });

  it("forgets the phone with a DELETE of the token, and never throws", async () => {
    await forgetDevice();
    expect(mocks.request).toHaveBeenCalledWith("DELETE", "/notify/push/devices/", { token: "fcm-1" });
    mocks.request.mockRejectedValueOnce(new Error("offline"));
    await expect(forgetDevice()).resolves.toBeUndefined();
  });
});
