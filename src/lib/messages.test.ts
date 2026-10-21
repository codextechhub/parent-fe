import { describe, expect, it, vi } from "vitest";

import { clockTime, dayHeading, dayKey, firstName, listTime, newClientToken } from "./messages";

const NOW = new Date(2026, 9, 21, 15, 0, 0);
const at = (y: number, m: number, d: number, h = 9, min = 5) => new Date(y, m, d, h, min).toISOString();

describe("listTime", () => {
  it("is the clock time today, Yesterday, the weekday this week, else the date", () => {
    expect(listTime(at(2026, 9, 21, 9, 5), NOW)).toBe("9:05 am");
    expect(listTime(at(2026, 9, 21, 14, 30), NOW)).toBe("2:30 pm");
    expect(listTime(at(2026, 9, 20), NOW)).toBe("Yesterday");
    expect(listTime(at(2026, 9, 18), NOW)).toBe("Sun");
    expect(listTime(at(2026, 8, 1), NOW)).toBe("1 Sep 2026");
    expect(listTime("not a date", NOW)).toBe("");
  });
});

describe("dayHeading and dayKey", () => {
  it("names today and yesterday and otherwise the weekday and date", () => {
    expect(dayHeading(at(2026, 9, 21), NOW)).toBe("Today");
    expect(dayHeading(at(2026, 9, 20), NOW)).toBe("Yesterday");
    expect(dayHeading(at(2026, 9, 9), NOW)).toBe("Fri, 9 Oct 2026");
    expect(dayKey(at(2026, 9, 21, 1))).toBe(dayKey(at(2026, 9, 21, 23)));
    expect(dayKey(at(2026, 9, 21))).not.toBe(dayKey(at(2026, 9, 22)));
  });
});

describe("small helpers", () => {
  it("reads midnight and noon as 12", () => {
    expect(clockTime(new Date(2026, 0, 1, 0, 7))).toBe("12:07 am");
    expect(clockTime(new Date(2026, 0, 1, 12, 0))).toBe("12:00 pm");
  });

  it("takes the first word of a name", () => {
    expect(firstName("Adaeze Okafor")).toBe("Adaeze");
    expect(firstName("  ")).toBe("");
  });
});

describe("newClientToken", () => {
  it("is a UUID, with or without crypto.randomUUID", () => {
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
    expect(newClientToken()).toMatch(uuid);
    const original = globalThis.crypto.randomUUID;
    vi.spyOn(globalThis.crypto, "randomUUID").mockImplementation(undefined as never);
    Object.defineProperty(globalThis.crypto, "randomUUID", { value: undefined, configurable: true });
    expect(newClientToken()).toMatch(uuid);
    Object.defineProperty(globalThis.crypto, "randomUUID", { value: original, configurable: true });
    vi.restoreAllMocks();
  });
});
