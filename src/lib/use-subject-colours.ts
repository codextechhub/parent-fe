import { useMemo } from "react";

import { useChildTimetableQuery } from "@/redux/services/portal-api";

import { dotOf, hueFor, subjectHues, toneOf } from "./name-hue";

/**
 * Each subject's colour for one child, the same on Results and Timetable.
 *
 * The hues are shared out over every subject in the child's class timetable,
 * so no two of the class's subjects look alike (`subjectHues`), as in the
 * student app. A subject that is not on it, or a class with no published
 * timetable, falls back to a hue from the name alone.
 */
export function useSubjectColours(childId: number | undefined): { dot: (subject: string) => string; tone: (subject: string) => { background: string; color: string } } {
  const { data } = useChildTimetableQuery(childId ?? 0, { skip: !childId });
  return useMemo(() => {
    const hues = subjectHues((data?.days ?? []).flatMap((day) => day.cells.map((cell) => (cell.kind === "BREAK" ? "" : cell.subject ?? ""))));
    const hue = (subject: string) => hues.get(subject.trim().toLowerCase()) ?? hueFor(subject);
    return { dot: (subject) => dotOf(hue(subject)), tone: (subject) => toneOf(hue(subject)) };
  }, [data]);
}
