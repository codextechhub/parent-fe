import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ native: true, setStyle: vi.fn(), fails: false }));
vi.mock("./platform", () => ({ isNativeApp: () => mocks.native }));
vi.mock("@capacitor/status-bar", () => ({
  Style: { Dark: "DARK", Light: "LIGHT", Default: "DEFAULT" },
  StatusBar: {
    setStyle: async (options: unknown) => {
      if (mocks.fails) throw new Error("not supported");
      mocks.setStyle(options);
    },
  },
}));

import { setStatusBarText, statusBarTextFor } from "./status-bar";

beforeEach(() => {
  mocks.native = true;
  mocks.fails = false;
  mocks.setStyle.mockReset();
});

describe("the status bar text", () => {
  it("is light over the sign-in's blue header and dark over every other screen", () => {
    expect(statusBarTextFor("/sign-in")).toBe("light");
    for (const path of ["/", "/fees", "/school", "/profile/delete-account"]) expect(statusBarTextFor(path)).toBe("dark");
  });

  it("asks the plugin for the style that matches: Dark is light text", async () => {
    await setStatusBarText("light");
    expect(mocks.setStyle).toHaveBeenLastCalledWith({ style: "DARK" });
    await setStatusBarText("dark");
    expect(mocks.setStyle).toHaveBeenLastCalledWith({ style: "LIGHT" });
  });

  it("does nothing in a browser, and nothing breaks when the phone refuses", async () => {
    mocks.native = false;
    await setStatusBarText("light");
    expect(mocks.setStyle).not.toHaveBeenCalled();
    mocks.native = true;
    mocks.fails = true;
    await expect(setStatusBarText("light")).resolves.toBeUndefined();
  });
});
