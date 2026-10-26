import { beforeEach, describe, expect, it, vi } from "vitest";

const kept = vi.hoisted(() => ({ value: null as string | null, fail: false }));
vi.mock("@capacitor/preferences", () => ({
  Preferences: {
    get: vi.fn(async () => {
      if (kept.fail) throw new Error("unavailable");
      return { value: kept.value };
    }),
    set: vi.fn(async ({ value }: { key: string; value: string }) => {
      kept.value = value;
    }),
  },
}));

import { Preferences } from "@capacitor/preferences";

import { loadSchoolCode, nativeSchoolCode, normaliseSchoolCode, saveSchoolCode } from "./school-code";

beforeEach(async () => {
  kept.value = null;
  kept.fail = false;
  await loadSchoolCode();
});

describe("normaliseSchoolCode", () => {
  it("forgives capitals and spaces", () => {
    expect(normaliseSchoolCode("  Meridian ")).toBe("meridian");
  });

  it("keeps only the school's own label from a pasted address", () => {
    expect(normaliseSchoolCode("https://meridian.xvs.codexng.com/parent/")).toBe("meridian");
    expect(normaliseSchoolCode("lagoon-view.xvs.codexng.com")).toBe("lagoon-view");
  });

  it("refuses what cannot be a school code", () => {
    expect(normaliseSchoolCode("")).toBe("");
    expect(normaliseSchoolCode("bright_star")).toBe("");
    expect(normaliseSchoolCode("-meridian")).toBe("");
    expect(normaliseSchoolCode("my school")).toBe("");
  });
});

describe("the kept school code", () => {
  it("is empty on a fresh install", async () => {
    expect(await loadSchoolCode()).toBe("");
    expect(nativeSchoolCode()).toBe("");
  });

  it("is kept in preferences and read back into memory on the next launch", async () => {
    await saveSchoolCode("Meridian");
    expect(Preferences.set).toHaveBeenCalledWith({ key: "xvs.parent.school-code", value: "meridian" });
    expect(nativeSchoolCode()).toBe("meridian");
    await loadSchoolCode();
    expect(nativeSchoolCode()).toBe("meridian");
  });

  it("will not keep something that is not a code", async () => {
    await expect(saveSchoolCode("not a code")).rejects.toThrow();
    expect(nativeSchoolCode()).toBe("");
  });

  it("reads as no school when the preferences cannot be read", async () => {
    await saveSchoolCode("meridian");
    kept.fail = true;
    expect(await loadSchoolCode()).toBe("");
  });
});
