import { useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Clock3, MapPin } from "lucide-react";
import { Popover } from "radix-ui";

import { ChildStrip } from "@/components/child-strip";
import { PageShell } from "@/components/layout/page-shell";
import { useActiveChild } from "@/components/session/child-switcher";
import { Calendar } from "@/components/ui/calendar";
import { formatClock } from "@/lib/format";
import {
  useChildTimetableQuery,
  type Timetable,
  type TimetableCell,
  type TodayPeriod,
} from "@/redux/services/portal-api";

import "./timetable.css";

/**
 * One child's week.
 *
 * The showing child comes from the switcher (`?child=`). The hero sits on
 * the current lesson or the next one; a day strip lets a parent step
 * through the week, and the summary grid appears from `md` up. If the
 * school has not published the class's timetable yet, a single message
 * says so.
 */
export function TimetablePage() {
  const child = useActiveChild();
  const { data, isLoading, isError, refetch } = useChildTimetableQuery(child?.id ?? 0, {
    skip: !child,
  });
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const todayDate = data?.today?.date ?? localDate(new Date());
  const firstSchoolDay = data?.days[0];
  const defaultDate =
    data?.days.some((day) => day.is_today) || !firstSchoolDay
      ? todayDate
      : dateKey(addDays(weekStart(todayDate), firstSchoolDay.day_of_week - 1));
  const activeDate = selectedDate ?? defaultDate;
  const selectedWeek = weekStart(activeDate);
  const currentWeek = weekStart(todayDate);
  const isCurrentWeek = selectedWeek.getTime() === currentWeek.getTime();
  const range = `${shortDate(selectedWeek)} – ${shortDate(addDays(selectedWeek, 6))}`;
  const shiftWeek = (weeks: number) =>
    setSelectedDate(dateKey(addDays(dateFromKey(activeDate), weeks * 7)));

  return (
    <PageShell className="timetable-page">
      <div className="timetable-wrap">
        <ChildStrip />
        {isLoading && !data && (
          <div className="timetable-loading" role="status" aria-label="Loading timetable" />
        )}
        {isError && !data && (
          <div className="timetable-panel timetable-message" role="alert">
            Your child&apos;s timetable can&apos;t be shown right now.{" "}
            <button type="button" onClick={() => refetch()}>
              Try again
            </button>
          </div>
        )}
        {data && !data.published && (
          <div className="timetable-panel timetable-message">
            <CalendarDays size={25} aria-hidden="true" />
            <p>
              {child?.first_name}&apos;s class timetable hasn&apos;t been published yet. It will
              appear here when the school publishes it.
            </p>
          </div>
        )}
        {data?.published && (
          <>
            <div className="timetable-week-nav" aria-label="Timetable week">
              <div>
                <strong>{isCurrentWeek ? "This week" : "Week of " + shortDate(selectedWeek)}</strong>
                <span>{range}</span>
              </div>
              <div className="timetable-week-actions">
                {!isCurrentWeek && (
                  <button type="button" onClick={() => setSelectedDate(todayDate)}>
                    Today
                  </button>
                )}
                <button type="button" aria-label="Previous week" onClick={() => shiftWeek(-1)}>
                  <ChevronLeft size={17} aria-hidden="true" />
                </button>
                <Popover.Root open={calendarOpen} onOpenChange={setCalendarOpen}>
                  <Popover.Trigger asChild>
                    <button type="button" aria-label="Choose a timetable date">
                      <CalendarDays size={17} aria-hidden="true" />
                      <span>Choose date</span>
                    </button>
                  </Popover.Trigger>
                  <Popover.Portal>
                    <Popover.Content align="end" sideOffset={8} className="timetable-calendar-popover">
                      <Calendar
                        selected={activeDate}
                        onSelect={(date) => {
                          setSelectedDate(date);
                          setCalendarOpen(false);
                        }}
                      />
                    </Popover.Content>
                  </Popover.Portal>
                </Popover.Root>
                <button type="button" aria-label="Next week" onClick={() => shiftWeek(1)}>
                  <ChevronRight size={17} aria-hidden="true" />
                </button>
              </div>
            </div>
            {!isCurrentWeek && (
              <p className="timetable-week-note">
                Showing the current published weekly pattern. School changes will appear when
                published.
              </p>
            )}
            <div className="timetable-layout">
              <CurrentLesson timetable={data} isCurrentWeek={isCurrentWeek} selectedWeek={selectedWeek} />
              <DaySchedule
                timetable={data}
                isCurrentWeek={isCurrentWeek}
                selectedWeek={selectedWeek}
                selectedDate={activeDate}
                onSelectDate={setSelectedDate}
              />
              <WeekSummary
                timetable={data}
                isCurrentWeek={isCurrentWeek}
                selectedWeek={selectedWeek}
                selectedDate={activeDate}
              />
            </div>
          </>
        )}
      </div>
    </PageShell>
  );
}

function localDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
}

function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}
function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86400000);
}
function dateFromKey(date: string): Date {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}
function weekStart(date: string): Date {
  const value = dateFromKey(date);
  return addDays(value, -((value.getUTCDay() + 6) % 7));
}
function shortDate(date: Date): string {
  return new Intl.DateTimeFormat("en-NG", { day: "numeric", month: "short", timeZone: "UTC" }).format(
    date,
  );
}

function cellTitle(cell: TimetableCell | TodayPeriod): string {
  return cell.kind === "BREAK" ? cell.label || "Break" : cell.subject || "Free period";
}

function cellMeta(cell: TimetableCell): string {
  return cell.kind === "BREAK"
    ? "Break"
    : [cell.teacher, cell.room].filter(Boolean).join(" · ") || "Class period";
}

function CurrentLesson({
  timetable,
  isCurrentWeek,
  selectedWeek,
}: {
  timetable: Timetable;
  isCurrentWeek: boolean;
  selectedWeek: Date;
}) {
  const periods = timetable.today?.periods ?? [];
  const now = periods.find((period) => period.state === "now" && period.kind !== "BREAK");
  const next = periods.find((period) => period.state === "next" && period.kind !== "BREAK");
  const featured = isCurrentWeek ? (now ?? next) : undefined;
  const nextAfterNow = now ? next : undefined;
  const title = !isCurrentWeek
    ? `Week of ${shortDate(selectedWeek)}`
    : featured
      ? cellTitle(featured)
      : timetable.today
        ? "All done for today"
        : "Plan the week";
  const label = !isCurrentWeek
    ? "Published timetable"
    : now
      ? "Happening now"
      : next
        ? "Up next"
        : "Timetable";

  return (
    <section className="timetable-feature" aria-labelledby="timetable-feature-title">
      <div className="timetable-feature-orb" aria-hidden="true" />
      <p className="timetable-feature-label">{label}</p>
      <h2 id="timetable-feature-title">{title}</h2>
      <p className="timetable-feature-description">
        {featured
          ? `${formatClock(featured.start_time)}–${formatClock(featured.end_time)}${featured.teacher ? ` · ${featured.teacher}` : ""}`
          : !isCurrentWeek
            ? "Choose a day to see the expected classes."
            : timetable.today
              ? "Classes have finished for the day. Take a look at the rest of the week."
              : "Choose a school day to see its classes."}
      </p>
      {featured && (
        <div className="timetable-feature-chips">
          {featured.room && (
            <span className="timetable-glass-chip">
              <MapPin size={14} aria-hidden="true" />
              {featured.room}
            </span>
          )}
          {nextAfterNow && (
            <span className="timetable-glass-chip">
              <Clock3 size={14} aria-hidden="true" />
              Next: {cellTitle(nextAfterNow)} · {formatClock(nextAfterNow.start_time)}
            </span>
          )}
        </div>
      )}
    </section>
  );
}

function DaySchedule({
  timetable,
  isCurrentWeek,
  selectedWeek,
  selectedDate,
  onSelectDate,
}: {
  timetable: Timetable;
  isCurrentWeek: boolean;
  selectedWeek: Date;
  selectedDate: string;
  onSelectDate: (date: string) => void;
}) {
  const selectedDayNumber = ((dateFromKey(selectedDate).getUTCDay() + 6) % 7) + 1;
  const day = timetable.days.find((item) => item.day_of_week === selectedDayNumber);
  const dayName = new Intl.DateTimeFormat("en-NG", { weekday: "long", timeZone: "UTC" }).format(
    dateFromKey(selectedDate),
  );
  const todayStates = timetable.today?.periods ?? [];

  return (
    <section className="timetable-panel timetable-day-panel" aria-labelledby="timetable-week-title">
      <div className="timetable-panel-heading">
        <h2 id="timetable-week-title">Classes</h2>
        <span>{timetable.class_name}</span>
      </div>
      {timetable.days.length > 0 ? (
        <>
          <div className="timetable-day-strip" role="group" aria-label="Choose a school day">
            {timetable.days.map((item) => (
              <button
                key={item.day_of_week}
                type="button"
                className={`timetable-day-button${item.day_of_week === selectedDayNumber ? " is-selected" : ""}`}
                aria-pressed={item.day_of_week === selectedDayNumber}
                onClick={() =>
                  onSelectDate(dateKey(addDays(selectedWeek, item.day_of_week - 1)))
                }
              >
                <span>{item.day_label.slice(0, 3)}</span>
                <strong>
                  {isCurrentWeek && item.is_today
                    ? "Today"
                    : shortDate(addDays(selectedWeek, item.day_of_week - 1))}
                </strong>
              </button>
            ))}
          </div>
          <div className="timetable-day-heading">
            <h3>
              {dayName} · {shortDate(dateFromKey(selectedDate))}
            </h3>
            <span>
              {day
                ? `${day.cells.length} ${day.cells.length === 1 ? "period" : "periods"}`
                : "No school day"}
            </span>
          </div>
          {day?.cells.length ? (
            <ol className="timetable-lessons">
              {day.cells.map((cell) => {
                const state =
                  isCurrentWeek && day.is_today
                    ? todayStates.find(
                        (period) =>
                          period.start_time === cell.start_time && period.kind === cell.kind,
                      )?.state
                    : undefined;
                return (
                  <li
                    key={`${cell.start_time}-${cell.label}`}
                    className={`timetable-lesson${state === "now" ? " is-now" : ""}${cell.kind === "BREAK" ? " is-break" : ""}`}
                  >
                    <span className="timetable-lesson-time">
                      <span>{formatClock(cell.start_time)}</span>
                      <span>{formatClock(cell.end_time)}</span>
                    </span>
                    <span className="timetable-lesson-track" aria-hidden="true" />
                    <span className="timetable-lesson-detail">
                      <strong>{cellTitle(cell)}</strong>
                      <span>{cellMeta(cell)}</span>
                    </span>
                    {(state === "now" || state === "next") && (
                      <span className={`timetable-lesson-badge is-${state}`}>
                        {state === "now" ? "Now" : "Next"}
                      </span>
                    )}
                  </li>
                );
              })}
            </ol>
          ) : (
            <p className="timetable-empty">No classes on {dayName}.</p>
          )}
        </>
      ) : (
        <p className="timetable-empty">No school days are in this timetable yet.</p>
      )}
    </section>
  );
}

function WeekSummary({
  timetable,
  isCurrentWeek,
  selectedWeek,
  selectedDate,
}: {
  timetable: Timetable;
  isCurrentWeek: boolean;
  selectedWeek: Date;
  selectedDate: string;
}) {
  if (timetable.days.length === 0) return null;
  return (
    <section className="timetable-panel timetable-summary" aria-labelledby="timetable-summary-title">
      <div className="timetable-panel-heading">
        <h2 id="timetable-summary-title">Week at a glance</h2>
        <span>Choose a day above for the full list</span>
      </div>
      <div className="timetable-summary-grid">
        {timetable.days.map((day) => (
          <div
            key={day.day_of_week}
            className={`timetable-summary-day${isCurrentWeek && day.is_today ? " is-today" : ""}${
              dateKey(addDays(selectedWeek, day.day_of_week - 1)) === selectedDate ? " is-selected" : ""
            }`}
          >
            <strong>
              {day.day_label} · {shortDate(addDays(selectedWeek, day.day_of_week - 1))}
              {isCurrentWeek && day.is_today ? " · Today" : ""}
            </strong>
            {day.cells.filter((cell) => cell.kind !== "BREAK").length ? (
              <ul>
                {day.cells
                  .filter((cell) => cell.kind !== "BREAK")
                  .slice(0, 3)
                  .map((cell) => (
                    <li key={`${cell.start_time}-${cell.label}`}>{cellTitle(cell)}</li>
                  ))}
              </ul>
            ) : (
              <span>No classes</span>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
