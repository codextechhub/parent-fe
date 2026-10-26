import { afterEach, describe, expect, it, vi } from "vitest";

const platform = vi.hoisted(() => ({ native: false }));
vi.mock("@capacitor/core", () => ({ Capacitor: { isNativePlatform: () => platform.native } }));

import { currentSchoolSlug } from "@/utils/school-host";

import { isNativeApp, routerBasename } from "./platform";
import { saveSchoolCode } from "./school-code";

vi.mock("@capacitor/preferences", () => ({ Preferences: { get: vi.fn(), set: vi.fn(async () => {}) } }));

afterEach(() => {
  platform.native = false;
});

describe("the platform switch", () => {
  it("is a browser unless Capacitor says it is a native shell", () => {
    expect(isNativeApp()).toBe(false);
    platform.native = true;
    expect(isNativeApp()).toBe(true);
  });

  it("keeps the web app under /parent and gives the store app the root", () => {
    expect(routerBasename()).toBe("/parent");
    platform.native = true;
    expect(routerBasename()).toBe("/");
  });

  it("reads the school off the address in a browser and from the kept code in the store app", async () => {
    await saveSchoolCode("meridian");
    expect(currentSchoolSlug("lagoon-view.xvs.codexng.com")).toBe("lagoon-view");
    platform.native = true;
    expect(currentSchoolSlug("localhost")).toBe("meridian");
    expect(currentSchoolSlug("lagoon-view.xvs.codexng.com")).toBe("meridian");
  });
});
