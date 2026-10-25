import { describe, expect, it } from "vitest";

import { noticePath } from "./payment-notices";

describe("noticePath", () => {
  it("opens the receipt the notice names, without the app prefix", () => {
    expect(noticePath("/parent/fees/receipts/42")).toBe("/fees/receipts/42");
    expect(noticePath("/parent/fees/receipts/42/")).toBe("/fees/receipts/42");
  });

  it("opens Fees when the address is missing or not a receipt in this app", () => {
    expect(noticePath(undefined)).toBe("/fees");
    expect(noticePath("")).toBe("/fees");
    expect(noticePath("/finance")).toBe("/fees");
    expect(noticePath("/student/fees/receipts/42")).toBe("/fees");
    expect(noticePath("/parent/fees/receipts/abc")).toBe("/fees");
    expect(noticePath("https://elsewhere.example/parent/fees/receipts/42")).toBe("/fees");
  });
});
