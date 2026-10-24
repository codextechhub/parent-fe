import { describe, expect, it } from "vitest";

import { accountBalanceWords, formatDate, formatLongDate, formatNaira, formatTimestampDate } from "./format";

describe("format", () => {
  it("writes money from kobo in naira", () => {
    expect(formatNaira(0)).toBe("₦0.00");
    expect(formatNaira(1168750)).toBe("₦11,687.50");
    expect(formatNaira(-500)).toBe("-₦5.00");
  });

  it("writes a calendar date without time-zone drift", () => {
    expect(formatDate("2026-10-16")).toBe("16 Oct 2026");
    expect(formatDate("")).toBe("");
    expect(formatLongDate("2026-10-16")).toBe("Friday, 16 Oct 2026");
  });

  it("writes a timestamp as a short date", () => {
    expect(formatTimestampDate("not a date")).toBe("");
    const now = formatTimestampDate("2026-10-19T08:03:53Z");
    expect(now).toMatch(/\d{1,2} \w{3} 2026/);
  });

  it("writes an account balance by its side, never by a minus sign", () => {
    expect(accountBalanceWords(10_000_000)).toBe("₦100,000.00 owing");
    expect(accountBalanceWords(-2_000_000)).toBe("₦20,000.00 in credit");
    expect(accountBalanceWords(0)).toBe("₦0.00");
  });
});
