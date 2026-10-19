import type { AttendanceDay } from "@/redux/services/portal-api";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** One month's calendar: its days in order, a school day's record where there is one. */
export type MonthGrid = {
  key: string;
  label: string;
  /** Blank cells before the 1st, for a week that starts on Monday. */
  lead: number;
  /** One entry per day of the month; null where the school had no day (a weekend, say). */
  days: (AttendanceDay | null)[];
};

/**
 * The term's school days laid out as month calendars, Monday first.
 *
 * Every month the term's days touch gets a calendar, and every date in it a
 * cell, so the weeks line up; a date with no school day is blank. Dates are
 * read as written ("2026-10-16"), never through a time zone. Shared with
 * student-fe; a fix belongs in both.
 */
export function monthsOf(days: AttendanceDay[]): MonthGrid[] {
  const byMonth = new Map<string, Map<number, AttendanceDay>>();
  for (const day of days) {
    const [y, m, d] = day.date.split("-").map(Number);
    const key = `${y}-${String(m).padStart(2, "0")}`;
    if (!byMonth.has(key)) byMonth.set(key, new Map());
    byMonth.get(key)!.set(d, day);
  }
  return [...byMonth.keys()].sort().map((key) => {
    const [y, m] = key.split("-").map(Number);
    const length = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const firstWeekday = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
    const entries = byMonth.get(key)!;
    return {
      key,
      label: `${MONTHS[m - 1]} ${y}`,
      lead: (firstWeekday + 6) % 7,
      days: Array.from({ length }, (_, i) => entries.get(i + 1) ?? null),
    };
  });
}
