/**
 * How the app writes money, dates and times.
 *
 * Money arrives in kobo and is shown in naira with two decimals. A calendar
 * date ("2026-10-16") is read as written, never through `new Date()`, which
 * would take it as UTC midnight and name the day before.
 *
 * Shared with school-fe and student-fe; a fix belongs in all three.
 */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const naira = new Intl.NumberFormat("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** "₦11,687.50" from 1168750 kobo. */
export function formatNaira(kobo: number): string {
  const sign = kobo < 0 ? "-" : "";
  return `${sign}₦${naira.format(Math.abs(kobo) / 100)}`;
}

function parts(value: string): { y: number; m: number; d: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value || "");
  if (!match) return null;
  return { y: Number(match[1]), m: Number(match[2]), d: Number(match[3]) };
}

/** "16 Oct 2026" from "2026-10-16". */
export function formatDate(value: string): string {
  const p = parts(value);
  return p ? `${p.d} ${MONTHS[p.m - 1]} ${p.y}` : "";
}

/** "Friday, 16 Oct 2026". */
export function formatLongDate(value: string): string {
  const p = parts(value);
  if (!p) return "";
  const weekday = WEEKDAYS[new Date(Date.UTC(p.y, p.m - 1, p.d)).getUTCDay()];
  return `${weekday}, ${p.d} ${MONTHS[p.m - 1]} ${p.y}`;
}

/** "16 Oct 2026" for a timestamp, on the reader's own calendar. */
export function formatTimestampDate(value: string): string {
  const at = new Date(value);
  if (Number.isNaN(at.getTime())) return "";
  return `${at.getDate()} ${MONTHS[at.getMonth()]} ${at.getFullYear()}`;
}
