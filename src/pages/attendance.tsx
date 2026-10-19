import { useState } from "react";
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, Info, SlidersHorizontal } from "lucide-react";
import { Popover } from "radix-ui";

import { ChildStrip } from "@/components/child-strip";
import { PageShell } from "@/components/layout/page-shell";
import { useActiveChild } from "@/components/session/child-switcher";
import { monthsOf, type MonthGrid } from "@/lib/attendance-months";
import { formatClock, formatDate } from "@/lib/format";
import {
  useChildAttendanceQuery,
  type AttendanceDay,
  type AttendanceNote,
} from "@/redux/services/portal-api";

import "./attendance.css";

/**
 * One child's attendance.
 *
 * Each change to the showing child or the term refetches, so a parent
 * never sees one child's calendar under another's name. The design's
 * "message the class teacher" sentence stays as plain copy; Messages is
 * parked (plan 2.3 point 5), so there is nothing to open from here.
 */
export function AttendancePage() {
  const child = useActiveChild();
  const [term, setTerm] = useState<number | null>(null);
  const [monthKey, setMonthKey] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const { data, isLoading, isError, isFetching, refetch } = useChildAttendanceQuery(
    { childId: child?.id ?? 0, term },
    { skip: !child },
  );
  const counts = data?.counts;
  const taken = counts ? counts.present + counts.absent + counts.excused : 0;
  const months = monthsOf(data?.days ?? []);
  const todayMonth = data?.today?.date.slice(0, 7);
  const defaultMonth =
    months.find((month) => month.key === todayMonth)
    ?? [...months].reverse().find((month) => month.days.some((day) => day?.state === "MARKED"))
    ?? months[0];
  const activeMonth = months.find((month) => month.key === monthKey) ?? defaultMonth;
  const monthIndex = activeMonth ? months.findIndex((month) => month.key === activeMonth.key) : -1;
  const selectedDay =
    activeMonth?.days.find((day) => day?.date === selectedDate)
    ?? activeMonth?.days.find((day) => day?.date === data?.today?.date)
    ?? activeMonth?.days.find((day) => day?.state === "MARKED" && ["L", "A", "E"].includes(day.mark ?? ""))
    ?? null;
  const selectedNote = data?.notes.find((note) => note.date === selectedDay?.date);
  const rate = counts?.rate ?? null;
  const encouragement =
    rate === null
      ? ""
      : rate >= 95
        ? "A very strong attendance this term."
        : rate >= 85
          ? "A steady attendance this term."
          : "Attendance has slipped a little this term.";

  const chooseTerm = (id: number) => {
    setTerm(id);
    setMonthKey(null);
    setSelectedDate(null);
  };
  const chooseMonth = (index: number) => {
    setMonthKey(months[index].key);
    setSelectedDate(null);
  };

  return (
    <PageShell className="attendance-page">
      <div className="attendance-wrap">
        <ChildStrip />
        {isLoading && !data && (
          <div className="attendance-loading" role="status" aria-label="Loading attendance" />
        )}
        {isError && !data && (
          <div className="attendance-notice" role="alert">
            {child?.first_name}&apos;s attendance can&apos;t be shown right now.{" "}
            <button type="button" onClick={() => refetch()}>
              Try again
            </button>
          </div>
        )}
        {data && counts && (
          <div className="attendance-layout" aria-busy={isFetching}>
            <div className="attendance-overview">
              <section className="attendance-hero" aria-label="Attendance summary">
                <span className="attendance-hero-label">
                  {rate === null ? "Attendance this term" : "Present this term"}
                </span>
                <strong className={rate === null ? "attendance-no-rate" : "attendance-rate"}>
                  {rate === null ? "Not yet" : <>{Math.round(rate)}<small>%</small></>}
                </strong>
                <span className="attendance-hero-foot">
                  {taken > 0
                    ? `From ${taken} ${taken === 1 ? "day" : "days"} with a register`
                    : "No registered days yet"}
                </span>
                {encouragement && (
                  <p className="attendance-encouragement">{encouragement}</p>
                )}
              </section>
              <dl className="attendance-counts">
                <Count label="Present" value={counts.present} />
                <Count label="Late" value={counts.late} />
                <Count label="Absent" value={counts.absent} />
                <Count label="Excused" value={counts.excused} />
              </dl>
              <p className="attendance-count-note">Late days are included in Present.</p>
            </div>
            <div className="attendance-details">
              <section aria-label="Day by day">
                <div className="attendance-section-heading attendance-day-heading is-first">
                  <div>
                    <h2>Day by day</h2>
                    <p>Tap a date to see its record</p>
                  </div>
                  {data.term && (
                    <div className="attendance-toolbar">
                      <Popover.Root>
                        <Popover.Trigger asChild>
                          <button
                            type="button"
                            className="attendance-filter-trigger"
                            aria-label="Filter attendance"
                          >
                            <SlidersHorizontal size={18} aria-hidden="true" />
                            {term !== null && (
                              <span className="attendance-filter-active" aria-hidden="true" />
                            )}
                          </button>
                        </Popover.Trigger>
                        <Popover.Portal>
                          <Popover.Content align="end" sideOffset={8} className="attendance-filter-popover">
                            <div className="attendance-filter-header">
                              <strong>Filter attendance</strong>
                              <Popover.Close aria-label="Close attendance filter">Done</Popover.Close>
                            </div>
                            <label htmlFor="attendance-filter-term">School term</label>
                            <div className="attendance-filter-select">
                              <select
                                id="attendance-filter-term"
                                value={data.term.id}
                                onChange={(event) => chooseTerm(Number(event.target.value))}
                              >
                                {[...data.terms].reverse().map((option) => (
                                  <option key={option.id} value={option.id}>
                                    {option.name} · {option.session_name}
                                    {option.is_current ? " (this term)" : ""}
                                  </option>
                                ))}
                              </select>
                              <ChevronDown size={16} aria-hidden="true" />
                            </div>
                          </Popover.Content>
                        </Popover.Portal>
                      </Popover.Root>
                    </div>
                  )}
                </div>
                <div className="attendance-surface attendance-calendar">
                  {activeMonth ? (
                    <>
                      <div className="attendance-calendar-toolbar">
                        <strong>{activeMonth.label}</strong>
                        <div className="attendance-month-nav">
                          <button
                            type="button"
                            aria-label="Previous month"
                            disabled={monthIndex <= 0}
                            onClick={() => chooseMonth(monthIndex - 1)}
                          >
                            <ChevronLeft size={18} aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            aria-label="Next month"
                            disabled={monthIndex >= months.length - 1}
                            onClick={() => chooseMonth(monthIndex + 1)}
                          >
                            <ChevronRight size={18} aria-hidden="true" />
                          </button>
                        </div>
                      </div>
                      <MonthCalendar month={activeMonth} selectedDate={selectedDay?.date} onSelect={setSelectedDate} />
                      <Legend days={data.days} />
                      <div className="attendance-day-detail" aria-live="polite">
                        <span className="attendance-detail-icon">
                          <CalendarDays size={18} aria-hidden="true" />
                        </span>
                        <div>
                          {selectedDay ? (
                            <>
                              <strong>
                                {formatDate(selectedDay.date)} · {lookOf(selectedDay).label}
                              </strong>
                              <p>{dayDetail(selectedDay, selectedNote)}</p>
                            </>
                          ) : (
                            <>
                              <strong>Choose a marked date</strong>
                              <p>Tap a school day above to see its record.</p>
                            </>
                          )}
                        </div>
                      </div>
                    </>
                  ) : (
                    <p className="attendance-calendar-empty">
                      No school days have been added to this term yet.
                    </p>
                  )}
                </div>
              </section>
              <section aria-label="Days to note">
                <div className="attendance-section-heading">
                  <h2>Days to note</h2>
                  <p>Late, absent and excused days</p>
                </div>
                <div className="attendance-surface attendance-notes">
                  {data.notes.length > 0 ? (
                    <ul>
                      {data.notes.map((note) => (
                        <NoteRow key={note.date} note={note} />
                      ))}
                    </ul>
                  ) : (
                    <p className="attendance-note-empty">
                      {taken > 0
                        ? "No absences or late days this term."
                        : "Nothing to note yet. School days will appear here after the register is taken."}
                    </p>
                  )}
                </div>
                <div className="attendance-teacher-tip">
                  <Info size={17} aria-hidden="true" />
                  <span>
                    <strong>Something look wrong?</strong> Tell {child?.first_name}&apos;s class
                    teacher so the school can check the register.
                  </span>
                </div>
              </section>
            </div>
          </div>
        )}
      </div>
    </PageShell>
  );
}

function Count({ label, value }: { label: string; value: number }) {
  return (
    <div className="attendance-count">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

const DAY_LOOK: Record<string, { label: string; className: string; glyph: string }> = {
  P: { label: "Present", className: "is-present", glyph: "P" },
  L: { label: "Late", className: "is-late", glyph: "L" },
  A: { label: "Absent", className: "is-absent", glyph: "A" },
  E: { label: "Excused", className: "is-excused", glyph: "E" },
  CLOSED: { label: "No school", className: "is-closed", glyph: "–" },
  NOT_TAKEN: { label: "No register yet", className: "is-not-taken", glyph: "?" },
  SUSPENDED: { label: "Not on the register", className: "is-suspended", glyph: "–" },
  NOT_ON_ROLL: { label: "Before joining", className: "is-not-on-roll", glyph: "·" },
};

function lookOf(day: AttendanceDay) {
  return DAY_LOOK[day.state === "MARKED" && day.mark ? day.mark : day.state] ?? DAY_LOOK.NOT_TAKEN;
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function MonthCalendar({
  month,
  selectedDate,
  onSelect,
}: {
  month: MonthGrid;
  selectedDate?: string;
  onSelect: (date: string) => void;
}) {
  return (
    <div className="attendance-calendar-grid">
      <div className="attendance-weekdays">
        {WEEKDAYS.map((day) => (
          <span key={day}>{day}</span>
        ))}
      </div>
      <div className="attendance-days">
        {Array.from({ length: month.lead }, (_, index) => (
          <span key={`lead-${index}`} aria-hidden="true" />
        ))}
        {month.days.map((day, index) => {
          if (!day) {
            return (
              <span
                key={index}
                className="attendance-day is-empty"
                aria-label={`${index + 1} ${month.label}: No school record`}
              >
                <span>{index + 1}</span>
              </span>
            );
          }
          const look = lookOf(day);
          const label = `${formatDate(day.date)}: ${look.label}${day.closed_reason ? ` (${day.closed_reason})` : ""}`;
          return (
            <button
              key={day.date}
              type="button"
              title={label}
              aria-label={label}
              aria-pressed={selectedDate === day.date}
              onClick={() => onSelect(day.date)}
              className={`attendance-day ${look.className}${selectedDate === day.date ? " is-selected" : ""}`}
            >
              <span>{index + 1}</span>
              <small>{look.glyph}</small>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Legend({ days }: { days: AttendanceDay[] }) {
  const keys = ["P", "L", "A", "E", "CLOSED", "NOT_TAKEN"];
  if (days.some((day) => day.state === "SUSPENDED")) keys.push("SUSPENDED");
  if (days.some((day) => day.state === "NOT_ON_ROLL")) keys.push("NOT_ON_ROLL");
  return (
    <ul className="attendance-legend">
      {keys.map((key) => (
        <li key={key}>
          <span className={`attendance-legend-glyph ${DAY_LOOK[key].className}`} aria-hidden="true">
            {DAY_LOOK[key].glyph}
          </span>
          {DAY_LOOK[key].label}
        </li>
      ))}
    </ul>
  );
}

function dayDetail(day: AttendanceDay, note?: AttendanceNote) {
  const detail = [
    note?.reason_label,
    note?.arrived_at
      ? `Arrived ${formatClock(note.arrived_at)}`
      : day.arrived_at
        ? `Arrived ${formatClock(day.arrived_at)}`
        : null,
    note?.note,
  ].filter(Boolean);
  if (detail.length) return detail.join(" · ");
  if (day.closed_reason) return `School closed: ${day.closed_reason}`;
  switch (day.state) {
    case "MARKED":
      return `Recorded as ${lookOf(day).label.toLowerCase()}.`;
    case "CLOSED":
      return "The school was closed.";
    case "NOT_TAKEN":
      return "The register has not been taken for this day.";
    case "SUSPENDED":
      return "Not on the register. Ask the class teacher if that looks wrong.";
    case "NOT_ON_ROLL":
      return "This date was before the pupil joined the school.";
    default:
      return "No register has been taken for this day.";
  }
}

function NoteRow({ note }: { note: AttendanceNote }) {
  const [, month, date] = note.date.split("-");
  const detail = [note.reason_label, note.arrived_at ? `Arrived ${formatClock(note.arrived_at)}` : null, note.note].filter(Boolean);
  const look = DAY_LOOK[note.mark] ?? DAY_LOOK.NOT_TAKEN;
  return (
    <li className="attendance-note">
      <div className="attendance-note-date">
        <strong>{Number(date)}</strong>
        <span>{formatDate(note.date).split(" ")[1] ?? month}</span>
      </div>
      <div className="attendance-note-body">
        <div>
          <strong>{formatDate(note.date)}</strong>
          <span className={`attendance-note-mark ${look.className}`}>{note.mark_label}</span>
        </div>
        {detail.length > 0 && <p>{detail.join(" · ")}</p>}
      </div>
    </li>
  );
}
