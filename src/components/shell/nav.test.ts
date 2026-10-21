import { describe, expect, it } from "vitest";

import { itemFor, NAV, splitTabs } from "./nav";

describe("itemFor", () => {
  it("matches the exact path", () => {
    expect(itemFor("/")?.key).toBe("home");
    expect(itemFor("/fees")?.key).toBe("fees");
    expect(itemFor("/results")?.key).toBe("results");
    expect(itemFor("/attendance")?.key).toBe("attendance");
    expect(itemFor("/timetable")?.key).toBe("timetable");
    expect(itemFor("/messages")?.key).toBe("messages");
  });

  it("matches a child path to the parent item", () => {
    expect(itemFor("/notices/42")?.key).toBe("notices");
    expect(itemFor("/results/card/1")?.key).toBe("results");
    expect(itemFor("/messages/7")?.key).toBe("messages");
    expect(itemFor("/messages/new")?.key).toBe("messages");
  });

  it("does not match `/` for any deeper path", () => {
    expect(itemFor("/profile")?.key).toBe("profile");
    expect(itemFor("/profile")?.key).not.toBe("home");
  });
});

describe("splitTabs", () => {
  it("keeps the owner's four tabs and puts the rest under More (8 items)", () => {
    expect(NAV.length).toBe(8);
    const { tabs, more } = splitTabs(NAV);
    expect(tabs.map((item) => item.key)).toEqual(["home", "results", "fees", "notices"]);
    expect(more.map((item) => item.key)).toEqual(["timetable", "attendance", "messages", "profile"]);
  });

  it("does not carry a child on Messages", () => {
    expect(NAV.find((item) => item.key === "messages")?.perChild).toBeFalsy();
  });

  it("keeps every item as a tab when at or under the slot count", () => {
    const trimmed = NAV.slice(0, 5);
    const { tabs, more } = splitTabs(trimmed);
    expect(tabs.length).toBe(5);
    expect(more.length).toBe(0);
  });
});
