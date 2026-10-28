import { describe, expect, it } from "vitest";

import { INBOX, isConversationPath, isDetailPath, itemFor, NAV, TABS } from "./nav";

describe("itemFor", () => {
  it("matches the exact path", () => {
    expect(itemFor("/")?.key).toBe("home");
    expect(itemFor("/fees")?.key).toBe("fees");
    expect(itemFor("/results")?.key).toBe("results");
    expect(itemFor("/attendance")?.key).toBe("attendance");
    expect(itemFor("/timetable")?.key).toBe("timetable");
    expect(itemFor("/messages")?.key).toBe("messages");
    expect(itemFor("/inbox")?.key).toBe("inbox");
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

describe("the split bar", () => {
  it("has Home, Results, Attendance and Fees as tabs, and the Inbox button for notices and messages", () => {
    expect(TABS.map((item) => item.key)).toEqual(["home", "results", "attendance", "fees"]);
    expect(INBOX.map((item) => item.key)).toEqual(["inbox", "notices", "messages"]);
  });

  it("carries the child showing on Results, Attendance and Timetable, and not on Fees or the Inbox", () => {
    const carries = NAV.filter((item) => item.perChild).map((item) => item.key);
    expect(carries).toEqual(["results", "attendance", "timetable"]);
  });
});

describe("isDetailPath", () => {
  it("is true for a notice, a new message, an invoice and paying, which draw their own back bar", () => {
    expect(isDetailPath("/notices/12")).toBe(true);
    expect(isDetailPath("/messages/new")).toBe(true);
    expect(isDetailPath("/fees/invoices/101")).toBe(true);
    expect(isDetailPath("/fees/pay/101")).toBe(true);
    expect(isDetailPath("/fees/pay-all")).toBe(true);
    expect(isDetailPath("/fees/paid")).toBe(true);
    expect(isDetailPath("/fees/receipts/77")).toBe(true);
    expect(isDetailPath("/fees")).toBe(false);
    expect(isDetailPath("/inbox")).toBe(false);
    expect(isDetailPath("/notices")).toBe(false);
    expect(isDetailPath("/messages/41")).toBe(false);
  });
});

describe("isConversationPath", () => {
  it("is true for an open conversation only", () => {
    expect(isConversationPath("/messages/41")).toBe(true);
    expect(isConversationPath("/messages/41/")).toBe(true);
    expect(isConversationPath("/messages")).toBe(false);
    expect(isConversationPath("/messages/new")).toBe(false);
    expect(isConversationPath("/messages/abc")).toBe(false);
    expect(isConversationPath("/notices/41")).toBe(false);
  });
});
