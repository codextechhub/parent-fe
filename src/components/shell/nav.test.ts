import { describe, expect, it } from "vitest";

import { itemFor, NAV, splitTabs } from "./nav";

describe("itemFor", () => {
  it("matches the exact path", () => {
    expect(itemFor("/")?.key).toBe("home");
    expect(itemFor("/fees")?.key).toBe("fees");
    expect(itemFor("/results")?.key).toBe("results");
    expect(itemFor("/attendance")?.key).toBe("attendance");
    expect(itemFor("/timetable")?.key).toBe("timetable");
  });

  it("matches a child path to the parent item", () => {
    expect(itemFor("/notices/42")?.key).toBe("notices");
    expect(itemFor("/results/card/1")?.key).toBe("results");
  });

  it("does not match `/` for any deeper path", () => {
    expect(itemFor("/profile")?.key).toBe("profile");
    expect(itemFor("/profile")?.key).not.toBe("home");
  });
});

describe("splitTabs", () => {
  it("overflows into More once Timetable + Attendance arrive (7 items)", () => {
    expect(NAV.length).toBe(7);
    const { tabs, more } = splitTabs(NAV);
    // 4 onBar-flagged items + More, so tabs.length === 4.
    expect(tabs.length).toBe(4);
    expect(more.length).toBe(3);
    expect(more.map((item) => item.key)).toEqual(["timetable", "attendance", "profile"]);
  });

  it("keeps every item as a tab when at or under the slot count", () => {
    const trimmed = NAV.slice(0, 5);
    const { tabs, more } = splitTabs(trimmed);
    expect(tabs.length).toBe(5);
    expect(more.length).toBe(0);
  });
});
