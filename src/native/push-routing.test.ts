import { describe, expect, it } from "vitest";

import { appPath, tapTarget } from "./push-routing";

describe("where a tapped notification leads", () => {
  it("drops the /parent prefix and keeps the screen and its query", () => {
    expect(tapTarget({ url: "/parent/notices/41" }).path).toBe("/notices/41");
    expect(tapTarget({ url: "/parent/fees/receipts/9" }).path).toBe("/fees/receipts/9");
    expect(tapTarget({ url: "/parent/results?child=12" }).path).toBe("/results?child=12");
    expect(appPath("/parent")).toBe("/");
    expect(appPath("/parent?x=1")).toBe("/?x=1");
  });

  it("opens the named child on a per-child screen when the address names none", () => {
    expect(tapTarget({ url: "/parent/results", child: "12" }).path).toBe("/results?child=12");
    expect(tapTarget({ url: "/parent/attendance", child: 7 }).path).toBe("/attendance?child=7");
    expect(tapTarget({ url: "/parent/timetable#today", child: "3" }).path).toBe("/timetable?child=3#today");
  });

  it("leaves a child the address already names, and family-wide screens, alone", () => {
    expect(tapTarget({ url: "/parent/results?child=5", child: "12" }).path).toBe("/results?child=5");
    expect(tapTarget({ url: "/parent/fees", child: "12" }).path).toBe("/fees");
    expect(tapTarget({ url: "/parent/notices/4", child: "12" }).path).toBe("/notices/4");
  });

  it("ignores a child that is not an id", () => {
    expect(tapTarget({ url: "/parent/results", child: "abc" }).path).toBe("/results");
    expect(tapTarget({ url: "/parent/results", child: "-3" }).path).toBe("/results");
    expect(tapTarget({ url: "/parent/results", child: null }).path).toBe("/results");
  });

  it("opens Home for anything that is not a path inside the parent app", () => {
    for (const url of ["", "/student/fees", "/", "//evil.example/parent/x", "https://evil.example/parent/x", "/parentage", "/parent/..\\x", undefined]) {
      expect(tapTarget({ url }).path).toBe("/");
    }
  });
});
