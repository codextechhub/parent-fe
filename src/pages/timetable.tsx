import { useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Info } from "lucide-react";
import { Popover } from "radix-ui";

import { PageShell } from "@/components/layout/page-shell";
import { ScreenTitle } from "@/components/layout/screen";
import { ChildPicker } from "@/components/session/child-picker";
import { useActiveChild } from "@/components/session/child-switcher";
import { Calendar } from "@/components/ui/calendar";
import { formatClock } from "@/lib/format";
import { useSubjectColours } from "@/lib/use-subject-colours";
import { useAppSelector } from "@/redux/hooks";
import { useChildTimetableQuery, type Timetable, type TimetableCell } from "@/redux/services/portal-api";

import "./timetable.css";

/**
 * One child's timetable (design 1f), opened from their card on Home: the
 * student app's, titled with the child's name, their class and branch over
 * it and the children under it. The class's school week is a strip of days,
 * and the chosen day's periods are cards, each lesson marked with its
 * subject's colour (the same as on Results). Today opens first. In the
 * current week the period under way and the next one are picked out and the
 * ones gone fade, by the server's word; any other week shows the same
 * published pattern without them. The calendar button by the title jumps to
 * any date. From 900px "Week at a glance" sits beside the day. Another child
 * opens on today again.
 */
export function TimetablePage() {
  const child = useActiveChild();
  const showBranch = useAppSelector((s) => s.auth.me?.show_branch ?? false);
  if (!child) return <PageShell className="timetable-page"><div className="timetable-wrap"><ScreenTitle title="Timetable" /></div></PageShell>;
  const about = [child.class_name, showBranch ? child.branch?.name : null].filter(Boolean).join(" · ");
  return <ChildTimetable key={child.id} childId={child.id} first={child.first_name} about={about} />;
}

function ChildTimetable({ childId, first, about }: { childId: number; first: string; about: string }) {
  const { data, isLoading, isError, refetch } = useChildTimetableQuery(childId);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const todayDate = data?.today?.date ?? localDate(new Date());
  const firstSchoolDay = data?.days[0];
  const defaultDate = data?.days.some((day) => day.is_today) || !firstSchoolDay
    ? todayDate
    : dateKey(addDays(weekStart(todayDate), firstSchoolDay.day_of_week - 1));
  const activeDate = selectedDate ?? defaultDate;
  const selectedWeek = weekStart(activeDate);
  const currentWeek = weekStart(todayDate);
  const isCurrentWeek = selectedWeek.getTime() === currentWeek.getTime();
  const range = `${shortDate(selectedWeek)} – ${shortDate(addDays(selectedWeek, 6))}`;
  const shiftWeek = (weeks: number) => setSelectedDate(dateKey(addDays(dateFromKey(activeDate), weeks * 7)));

  const picker = data?.published ? (
    <Popover.Root open={calendarOpen} onOpenChange={setCalendarOpen}>
      <Popover.Trigger asChild>
        <button type="button" className="timetable-pick" aria-label="Choose a timetable date"><CalendarDays size={19} aria-hidden="true" /></button>
      </Popover.Trigger>
      <Popover.Portal><Popover.Content align="end" sideOffset={8} className="timetable-calendar-popover"><Calendar selected={activeDate} onSelect={(date) => { setSelectedDate(date); setCalendarOpen(false); }} /></Popover.Content></Popover.Portal>
    </Popover.Root>
  ) : undefined;

  return (
    <PageShell className="timetable-page">
      <div className="timetable-wrap">
        <ScreenTitle eyebrow={about || data?.class_name || undefined} title={`${first}'s timetable`} action={picker}>
          <ChildPicker />
        </ScreenTitle>
        {isLoading && !data && <div className="timetable-loading" role="status" aria-label="Loading timetable" />}
        {isError && !data && (
          <div className="screen-card timetable-message" role="alert">
            {first}&apos;s timetable can&apos;t be shown right now. <button type="button" onClick={() => refetch()}>Try again</button>
          </div>
        )}
        {data && !data.published && (
          <div className="screen-card timetable-message">
            <span className="icon-tile"><CalendarDays size={20} aria-hidden="true" /></span>
            <p>{first}&apos;s class timetable hasn&apos;t been published yet. It will appear here when the school publishes it.</p>
          </div>
        )}
        {data?.published && (
          <div className="timetable-layout">
            <div className="timetable-main">
              <section className="screen-card timetable-week" aria-label="Timetable week">
                <div className="timetable-week-nav">
                  <span><strong>{isCurrentWeek ? "This week" : "Week of " + shortDate(selectedWeek)}</strong><span>{range}</span></span>
                  <span className="timetable-week-actions">
                    {!isCurrentWeek && <button type="button" className="timetable-today" onClick={() => setSelectedDate(todayDate)}>Today</button>}
                    <button type="button" aria-label="Previous week" onClick={() => shiftWeek(-1)}><ChevronLeft size={16} aria-hidden="true" /></button>
                    <button type="button" aria-label="Next week" onClick={() => shiftWeek(1)}><ChevronRight size={16} aria-hidden="true" /></button>
                  </span>
                </div>
                <DayStrip timetable={data} isCurrentWeek={isCurrentWeek} selectedWeek={selectedWeek} selectedDate={activeDate} onSelectDate={setSelectedDate} />
              </section>
              {!isCurrentWeek && (
                <p className="info-note timetable-week-note"><Info size={17} aria-hidden="true" /><span>Showing the current published weekly pattern. School changes will appear when published.</span></p>
              )}
              <DaySchedule childId={childId} timetable={data} isCurrentWeek={isCurrentWeek} selectedDate={activeDate} />
            </div>
            <WeekSummary childId={childId} timetable={data} isCurrentWeek={isCurrentWeek} selectedWeek={selectedWeek} selectedDate={activeDate} />
          </div>
        )}
      </div>
    </PageShell>
  );
}

function localDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function dateKey(date: Date): string { return date.toISOString().slice(0, 10); }
function addDays(date: Date, days: number): Date { return new Date(date.getTime() + days * 86400000); }
function dateFromKey(date: string): Date {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}
function weekStart(date: string): Date {
  const value = dateFromKey(date);
  return addDays(value, -((value.getUTCDay() + 6) % 7));
}
function shortDate(date: Date): string { return new Intl.DateTimeFormat("en-NG", { day: "numeric", month: "short", timeZone: "UTC" }).format(date); }

function cellTitle(cell: TimetableCell): string {
  return cell.kind === "BREAK" ? cell.label || "Break" : cell.subject || "Free period";
}

function cellMeta(cell: TimetableCell): string {
  return [cell.teacher, cell.room].filter(Boolean).join(" · ") || "Class period";
}

/** The school days of the week shown, as tiles: the day's short name and its date. */
function DayStrip({ timetable, isCurrentWeek, selectedWeek, selectedDate, onSelectDate }: { timetable: Timetable; isCurrentWeek: boolean; selectedWeek: Date; selectedDate: string; onSelectDate: (date: string) => void }) {
  const selectedDayNumber = ((dateFromKey(selectedDate).getUTCDay() + 6) % 7) + 1;
  if (timetable.days.length === 0) return <p className="timetable-empty">No school days are in this timetable yet.</p>;
  return (
    <div className="timetable-day-strip" role="group" aria-label="Choose a school day" style={{ gridTemplateColumns: `repeat(${timetable.days.length}, minmax(0, 1fr))` }}>
      {timetable.days.map((item) => {
        const date = addDays(selectedWeek, item.day_of_week - 1);
        const today = isCurrentWeek && item.is_today;
        return (
          <button
            key={item.day_of_week}
            type="button"
            className={`timetable-day-button${item.day_of_week === selectedDayNumber ? " is-selected" : ""}${today ? " is-today" : ""}`}
            aria-pressed={item.day_of_week === selectedDayNumber}
            aria-label={`${item.day_label} ${shortDate(date)}${today ? ", today" : ""}`}
            onClick={() => onSelectDate(dateKey(date))}
          >
            <span>{item.day_label.slice(0, 3)}</span>
            <strong>{date.getUTCDate()}</strong>
          </button>
        );
      })}
    </div>
  );
}

/** The chosen day's periods: lessons as cards in their subject's colour, breaks as a dashed line. */
function DaySchedule({ childId, timetable, isCurrentWeek, selectedDate }: { childId: number; timetable: Timetable; isCurrentWeek: boolean; selectedDate: string }) {
  const selectedDayNumber = ((dateFromKey(selectedDate).getUTCDay() + 6) % 7) + 1;
  const day = timetable.days.find((item) => item.day_of_week === selectedDayNumber);
  const dayName = new Intl.DateTimeFormat("en-NG", { weekday: "long", timeZone: "UTC" }).format(dateFromKey(selectedDate));
  const todayStates = timetable.today?.periods ?? [];
  const colours = useSubjectColours(childId);
  const lessons = day?.cells.filter((cell) => cell.kind !== "BREAK").length ?? 0;
  if (timetable.days.length === 0) return null;

  return (
    <section className="timetable-day" aria-labelledby="timetable-day-title">
      <div className="screen-section timetable-day-heading">
        <h2 id="timetable-day-title">{dayName} · {shortDate(dateFromKey(selectedDate))}</h2>
        <span className="screen-section-aside">{day ? `${lessons} ${lessons === 1 ? "period" : "periods"}` : "No school day"}</span>
      </div>
      {day?.cells.length ? (
        <ol className="timetable-lessons">
          {day.cells.map((cell) => {
            const state = isCurrentWeek && day.is_today ? todayStates.find((period) => period.start_time === cell.start_time && period.kind === cell.kind)?.state : undefined;
            const key = `${cell.start_time}-${cell.label}`;
            if (cell.kind === "BREAK") {
              return (
                <li key={key} className={`timetable-break${state === "done" ? " is-done" : ""}`}>
                  <span>{cellTitle(cell)} · {formatClock(cell.start_time)} – {formatClock(cell.end_time)}</span>
                </li>
              );
            }
            return (
              <li key={key} className={`timetable-lesson${state === "now" ? " is-now" : ""}${state === "done" ? " is-done" : ""}`}>
                <span className="timetable-lesson-time"><span>{formatClock(cell.start_time)}</span><span>{formatClock(cell.end_time)}</span></span>
                <span className="timetable-lesson-bar" style={{ background: cell.subject ? colours.dot(cell.subject) : "#cfd6e2" }} aria-hidden="true" />
                <span className="timetable-lesson-detail"><strong>{cellTitle(cell)}</strong><span>{cellMeta(cell)}</span></span>
                {(state === "now" || state === "next") && <span className={`timetable-lesson-badge is-${state}`}>{state === "now" ? "Now" : "Next"}</span>}
              </li>
            );
          })}
        </ol>
      ) : <p className="screen-card timetable-empty">No classes on {dayName}.</p>}
    </section>
  );
}

/** The whole week, three lessons a day, beside the day on a wide screen. */
function WeekSummary({ childId, timetable, isCurrentWeek, selectedWeek, selectedDate }: { childId: number; timetable: Timetable; isCurrentWeek: boolean; selectedWeek: Date; selectedDate: string }) {
  const colours = useSubjectColours(childId);
  if (timetable.days.length === 0) return null;
  return (
    <section className="screen-card timetable-summary" aria-labelledby="timetable-summary-title">
      <div className="timetable-summary-heading"><h2 id="timetable-summary-title">Week at a glance</h2><span>Choose a day for the full list</span></div>
      <div className="timetable-summary-grid">
        {timetable.days.map((day) => (
          <div key={day.day_of_week} className={`timetable-summary-day${isCurrentWeek && day.is_today ? " is-today" : ""}${dateKey(addDays(selectedWeek, day.day_of_week - 1)) === selectedDate ? " is-selected" : ""}`}>
            <strong>{day.day_label} · {shortDate(addDays(selectedWeek, day.day_of_week - 1))}{isCurrentWeek && day.is_today ? " · Today" : ""}</strong>
            {day.cells.filter((cell) => cell.kind !== "BREAK").length ? (
              <ul>{day.cells.filter((cell) => cell.kind !== "BREAK").slice(0, 3).map((cell) => <li key={`${cell.start_time}-${cell.label}`}><span style={{ background: cell.subject ? colours.dot(cell.subject) : "#cfd6e2" }} aria-hidden="true" />{cellTitle(cell)}</li>)}</ul>
            ) : <span>No classes</span>}
          </div>
        ))}
      </div>
    </section>
  );
}
