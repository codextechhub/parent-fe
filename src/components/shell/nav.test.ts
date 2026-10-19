import { describe, expect, it } from "vitest";

import { itemFor, NAV, splitTabs } from "./nav";

describe("itemFor", () => {
  it("matches the exact path", () => {
    expect(itemFor("/")?.key).toBe("home");
    expect(itemFor("/fees")?.key).toBe("fees");
    expect(itemFor("/results")?.key).toBe("results");
  });

  it("matches a child path to the parent item", () => {
    expect(itemFor("/notices/42")?.key).toBe("notices");
    expect(itemFor("/results/subject/5")?.key).toBe("results");
  });

  it("does not match `/` for any deeper path", () => {
    expect(itemFor("/profile")?.key).toBe("profile");
    expect(itemFor("/profile")?.key).not.toBe("home");
  });
});

describe("splitTabs", () => {
  it("keeps every item as a tab when at or under the slot count", () => {
    const { tabs, more } = splitTabs(NAV);
    expect(tabs.length).toBe(5);
    expect(more.length).toBe(0);
  });

  it("overflows into More once there are more than five items", () => {
    const extra = [...NAV, { ...NAV[0], key: "x" as "home", path: "/x" }];
    const { tabs, more } = splitTabs(extra);
    expect(tabs.length).toBe(4);
    expect(more.length).toBe(2);
  });
});
