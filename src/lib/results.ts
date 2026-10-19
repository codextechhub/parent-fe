import type { SessionResults, SubjectResult } from "@/redux/services/portal-api";

/** "53.25" as "53.3%", or "-" when there is no figure. */
export function percent(value: string | number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || value === "") return "-";
  const n = Number(value);
  return Number.isFinite(n) ? `${n.toFixed(digits)}%` : "-";
}

/** A subject's component marks as the design shows them: "CA1 9/20 · CA2 9/20 · EXAM 31/60". */
export function cellsLine(subject: SubjectResult): string {
  return subject.cells
    .map((cell) => `${cell.short_name} ${cell.mark ?? "-"}${cell.max_score ? `/${cell.max_score}` : ""}`)
    .join(" · ");
}

/** How a subject moved from the term before to the last one: up, down or the same, in points. */
export type Movement = { direction: "up" | "down" | "same"; points: number } | null;

/**
 * The change in one subject between the year's last two released terms.
 *
 * Null when there are not two terms with a figure to compare. Shared with
 * student-fe; nothing is recomputed here beyond the delta.
 */
export function movement(terms: { percentage: string | null }[]): Movement {
  const figures = terms
    .map((t) => (t.percentage === null ? null : Number(t.percentage)))
    .filter((n): n is number => n !== null && Number.isFinite(n));
  if (figures.length < 2) return null;
  const delta = figures[figures.length - 1] - figures[figures.length - 2];
  const points = Math.round(Math.abs(delta) * 10) / 10;
  if (points === 0) return { direction: "same", points: 0 };
  return { direction: delta > 0 ? "up" : "down", points };
}

/** "Held steady", "▲ 4 vs last term", "▼ 1.5 vs last term". */
export function movementLabel(move: Movement): string {
  if (!move) return "";
  if (move.direction === "same") return "Held steady";
  return `${move.direction === "up" ? "▲" : "▼"} ${move.points} vs last term`;
}

/**
 * Each subject's teacher, from the latest term's result.
 *
 * The year's block carries no teacher; the term result does (where the card
 * was published with one), so the full-session table borrows it by subject
 * name. A subject the latest term does not name has none.
 */
export function teachersBySubject(subjects: SubjectResult[] | undefined): Map<string, string> {
  const map = new Map<string, string>();
  for (const subject of subjects ?? []) if (subject.teacher) map.set(subject.name, subject.teacher);
  return map;
}

/** "3 of 3", or "1 term" where the year's term count is not known. */
export function termsReleasedLine(session: Pick<SessionResults, "terms_released" | "terms_total">): string {
  const released = session.terms_released ?? 0;
  if (session.terms_total) return `${released} of ${session.terms_total}`;
  return `${released} ${released === 1 ? "term" : "terms"}`;
}
