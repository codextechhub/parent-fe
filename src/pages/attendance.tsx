import { useState } from "react";
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, Info, SlidersHorizontal } from "lucide-react";
import { Popover } from "radix-ui";

import { PageShell } from "@/components/layout/page-shell";
import { ScreenTitle } from "@/components/layout/screen";
import { ChildPicker } from "@/components/session/child-picker";
import { useActiveChild } from "@/components/session/child-switcher";
import { monthsOf, type MonthGrid } from "@/lib/attendance-months";
import { formatClock, formatDate } from "@/lib/format";
import { useChildAttendanceQuery, type AttendanceDay, type AttendanceNote } from "@/redux/services/portal-api";

import "./attendance.css";

/**
 * One child's attendance (design 1e), the student app's with the children
 * under the title: the term's rate on a ring with the four counts, the month
 * as a calendar with each day's mark as a coloured dot (tap a date for its
 * record), then the days to note. The filter by the title picks another
 * term. Every count and mark is the server's. Another child starts again on
 * their own current term, so a parent never sees one child's calendar under
 * another's name.
 */
export function AttendancePage() {
  const child = useActiveChild();
  if (!child) return <PageShell className="attendance-page"><div className="attendance-wrap"><ScreenTitle title="Attendance" /></div></PageShell>;
  return <ChildAttendance key={child.id} childId={child.id} first={child.first_name} />;
}

function ChildAttendance({ childId, first }: { childId: number; first: string }) {
  const [term, setTerm] = useState<number | null>(null);
  const [monthKey, setMonthKey] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const { data, isLoading, isError, isFetching, refetch } = useChildAttendanceQuery({ childId, term });
  const counts = data?.counts;
  const taken = counts ? counts.present + counts.absent + counts.excused : 0;
  const months = monthsOf(data?.days ?? []);
  const todayMonth = data?.today?.date.slice(0, 7);
  const defaultMonth = months.find((month) => month.key === todayMonth)
    ?? [...months].reverse().find((month) => month.days.some((day) => day?.state === "MARKED"))
    ?? months[0];
  const activeMonth = months.find((month) => month.key === monthKey) ?? defaultMonth;
  const monthIndex = activeMonth ? months.findIndex((month) => month.key === activeMonth.key) : -1;
  const selectedDay = activeMonth?.days.find((day) => day?.date === selectedDate)
    ?? activeMonth?.days.find((day) => day?.date === data?.today?.date)
    ?? activeMonth?.days.find((day) => day?.state === "MARKED" && ["L", "A", "E"].includes(day.mark ?? ""))
    ?? null;
  const selectedNote = data?.notes.find((note) => note.date === selectedDay?.date);

  const chooseTerm = (id: number) => {
    setTerm(id);
    setMonthKey(null);
    setSelectedDate(null);
  };
  const chooseMonth = (index: number) => {
    setMonthKey(months[index].key);
    setSelectedDate(null);
  };

  const filter = data?.term && data.terms.length > 1 ? (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button type="button" className="attendance-filter-trigger" aria-label="Choose a term">
          <SlidersHorizontal size={18} aria-hidden="true" />
          {term !== null && <span className="attendance-filter-active" aria-hidden="true" />}
        </button>
      </Popover.Trigger>
      <Popover.Portal><Popover.Content align="end" sideOffset={8} className="attendance-filter-popover">
        <div className="attendance-filter-header"><strong>Choose a term</strong><Popover.Close aria-label="Close term filter">Done</Popover.Close></div>
        <label htmlFor="attendance-filter-term">School term</label>
        <div className="attendance-filter-select"><select id="attendance-filter-term" value={data.term.id} onChange={(event) => chooseTerm(Number(event.target.value))}>
          {[...data.terms].reverse().map((option) => <option key={option.id} value={option.id}>{option.name} · {option.session_name}{option.is_current ? " (this term)" : ""}</option>)}
        </select><ChevronDown size={16} aria-hidden="true" /></div>
      </Popover.Content></Popover.Portal>
    </Popover.Root>
  ) : undefined;

  return (
    <PageShell className="attendance-page">
      <div className="attendance-wrap">
        <ScreenTitle eyebrow={data?.term ? `${data.term.name} · ${data.term.session_name}` : undefined} title="Attendance" action={filter}>
          <ChildPicker />
        </ScreenTitle>
        {isLoading && !data && <div className="attendance-loading" role="status" aria-label="Loading attendance" />}
        {isError && !data && <div className="screen-card attendance-message" role="alert">{first}&apos;s attendance can&apos;t be shown right now. <button type="button" onClick={() => refetch()}>Try again</button></div>}
        {data && counts && <div className="attendance-layout" aria-busy={isFetching}>
          <div className="attendance-overview">
            <section className="screen-card attendance-summary" aria-label="Attendance summary">
              <div className="attendance-summary-top">
                <Ring rate={counts.rate} />
                <div>
                  <span className="attendance-summary-label">{counts.rate === null ? `${first}'s attendance this term` : `${first} was present`}</span>
                  <p>{taken > 0 ? `From ${taken} ${taken === 1 ? "day" : "days"} with a register` : "No register has been taken this term yet."}</p>
                </div>
              </div>
              <dl className="attendance-counts">
                <Count label="Present" value={counts.present} mark="P" />
                <Count label="Late" value={counts.late} mark="L" />
                <Count label="Absent" value={counts.absent} mark="A" />
                <Count label="Excused" value={counts.excused} mark="E" />
              </dl>
              <p className="attendance-count-note">Late days are included in Present.</p>
            </section>
          </div>
          <div className="attendance-details">
            <section className="screen-card attendance-calendar" aria-label="Day by day">
              {activeMonth ? <>
                <div className="attendance-calendar-toolbar">
                  <strong>{activeMonth.label}</strong>
                  <div className="attendance-month-nav">
                    <button type="button" aria-label="Previous month" disabled={monthIndex <= 0} onClick={() => chooseMonth(monthIndex - 1)}><ChevronLeft size={16} aria-hidden="true" /></button>
                    <button type="button" aria-label="Next month" disabled={monthIndex >= months.length - 1} onClick={() => chooseMonth(monthIndex + 1)}><ChevronRight size={16} aria-hidden="true" /></button>
                  </div>
                </div>
                <MonthCalendar month={activeMonth} today={data.today?.date} selectedDate={selectedDay?.date} onSelect={setSelectedDate} />
                <Legend days={data.days} />
                <div className="attendance-day-detail" aria-live="polite">
                  <span className="attendance-detail-icon"><CalendarDays size={18} aria-hidden="true" /></span>
                  <div>
                    {selectedDay ? <><strong>{formatDate(selectedDay.date)} · {lookOf(selectedDay).label}</strong><p>{dayDetail(selectedDay, first, selectedNote)}</p></> : <><strong>Choose a date</strong><p>Tap a school day above to see its record.</p></>}
                  </div>
                </div>
              </> : <p className="attendance-calendar-empty">No school days have been added to this term yet.</p>}
            </section>
            <section className="attendance-notes-section" aria-labelledby="attendance-notes-title">
              <div className="screen-section"><h2 id="attendance-notes-title">Days to note</h2><span className="screen-section-aside">Late, absent and excused</span></div>
              <div className="screen-card attendance-notes">{data.notes.length > 0 ? <ul>{data.notes.map((note) => <NoteRow key={note.date} note={note} />)}</ul> : <p className="attendance-note-empty">{taken > 0 ? "No absences or late days this term." : "Nothing to note yet. School days will appear here after the register is taken."}</p>}</div>
              <p className="attendance-teacher-tip"><Info size={17} aria-hidden="true" /><span><strong>Something look wrong?</strong> Tell {first}&apos;s class teacher so the school can check the register.</span></p>
            </section>
          </div>
        </div>}
      </div>
    </PageShell>
  );
}

/** The term's rate on a green ring, or "Not yet" before any register. */
function Ring({ rate }: { rate: number | null }) {
  const around = 2 * Math.PI * 44;
  const share = rate === null ? 0 : Math.max(0, Math.min(100, rate)) / 100;
  return (
    <div className="attendance-ring">
      <svg width="104" height="104" viewBox="0 0 104 104" aria-hidden="true">
        <circle cx="52" cy="52" r="44" fill="none" stroke="#e6f4ee" strokeWidth="10" />
        {share > 0 && <circle cx="52" cy="52" r="44" fill="none" stroke="#2f9e6e" strokeWidth="10" strokeLinecap="round" strokeDasharray={`${(share * around).toFixed(1)} ${around.toFixed(1)}`} />}
      </svg>
      <strong className={rate === null ? "is-empty" : undefined}><span>{rate === null ? "Not yet" : <>{Math.round(rate)}<small>%</small></>}</span></strong>
    </div>
  );
}

function Count({ label, value, mark }: { label: string; value: number; mark: string }) {
  return <div className="attendance-count"><dd>{value}</dd><dt><span className={`attendance-dot ${DAY_LOOK[mark].className}`} aria-hidden="true" />{label}</dt></div>;
}

const DAY_LOOK: Record<string, { label: string; className: string }> = {
  P: { label: "Present", className: "is-present" },
  L: { label: "Late", className: "is-late" },
  A: { label: "Absent", className: "is-absent" },
  E: { label: "Excused", className: "is-excused" },
  CLOSED: { label: "No school", className: "is-closed" },
  NOT_TAKEN: { label: "No register yet", className: "is-not-taken" },
  SUSPENDED: { label: "Not on the register", className: "is-suspended" },
  NOT_ON_ROLL: { label: "Before joining", className: "is-not-on-roll" },
};

function lookOf(day: AttendanceDay) {
  return DAY_LOOK[day.state === "MARKED" && day.mark ? day.mark : day.state] ?? DAY_LOOK.NOT_TAKEN;
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/**
 * The month, Monday first: each school day a number with its mark's dot, today
 * ringed, the chosen day blue, a closed day struck through. Days with no
 * school record are faint and cannot be chosen.
 */
function MonthCalendar({ month, today, selectedDate, onSelect }: { month: MonthGrid; today?: string; selectedDate?: string; onSelect: (date: string) => void }) {
  return <div className="attendance-calendar-grid">
    <div className="attendance-weekdays">{WEEKDAYS.map((day) => <span key={day}>{day}</span>)}</div>
    <div className="attendance-days">
      {Array.from({ length: month.lead }, (_, index) => <span key={`lead-${index}`} aria-hidden="true" />)}
      {month.days.map((day, index) => {
        if (!day) return <span key={index} className="attendance-day is-empty" aria-label={`${index + 1} ${month.label}: No school record`}><span>{index + 1}</span><i aria-hidden="true" /></span>;
        const look = lookOf(day);
        const label = `${formatDate(day.date)}: ${look.label}${day.closed_reason ? ` (${day.closed_reason})` : ""}${day.date === today ? ", today" : ""}`;
        return (
          <button
            key={day.date}
            type="button"
            title={label}
            aria-label={label}
            aria-pressed={selectedDate === day.date}
            onClick={() => onSelect(day.date)}
            className={`attendance-day ${look.className}${selectedDate === day.date ? " is-selected" : ""}${day.date === today ? " is-today" : ""}`}
          >
            <span>{index + 1}</span><i className="attendance-dot" aria-hidden="true" />
          </button>
        );
      })}
    </div>
  </div>;
}

/** What the dots mean: Present, Late and Absent always, the rest only where the term has them. */
function Legend({ days }: { days: AttendanceDay[] }) {
  const has = (key: string) => days.some((day) => (day.state === "MARKED" ? day.mark : day.state) === key);
  const keys = ["P", "L", "A", ...["E", "CLOSED", "NOT_TAKEN", "SUSPENDED", "NOT_ON_ROLL"].filter(has)];
  return <ul className="attendance-legend">{keys.map((key) => <li key={key}>{key === "CLOSED" ? <span className="attendance-legend-closed" aria-hidden="true">12</span> : <span className={`attendance-dot ${DAY_LOOK[key].className}`} aria-hidden="true" />}{DAY_LOOK[key].label}</li>)}</ul>;
}

function dayDetail(day: AttendanceDay, first: string, note?: AttendanceNote) {
  const detail = [note?.reason_label, note?.arrived_at ? `Arrived ${formatClock(note.arrived_at)}` : day.arrived_at ? `Arrived ${formatClock(day.arrived_at)}` : null, note?.note].filter(Boolean);
  if (detail.length) return detail.join(" · ");
  if (day.closed_reason) return `School closed: ${day.closed_reason}`;
  switch (day.state) {
    case "MARKED": return `Recorded as ${lookOf(day).label.toLowerCase()}.`;
    case "CLOSED": return "The school was closed.";
    case "NOT_TAKEN": return "The register has not been taken for this day.";
    case "SUSPENDED": return `${first} was not on the register. Ask the class teacher if that looks wrong.`;
    case "NOT_ON_ROLL": return `This date was before ${first} joined the school.`;
    default: return "No register has been taken for this day.";
  }
}

const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function NoteRow({ note }: { note: AttendanceNote }) {
  const [year, month, date] = note.date.split("-").map(Number);
  const weekday = WEEKDAY_NAMES[new Date(Date.UTC(year, month - 1, date)).getUTCDay()];
  const detail = [note.reason_label, note.arrived_at ? `Arrived ${formatClock(note.arrived_at)}` : null, note.note].filter(Boolean);
  const look = DAY_LOOK[note.mark] ?? DAY_LOOK.NOT_TAKEN;
  return <li className="attendance-note">
    <div className="attendance-note-date"><strong>{date}</strong><span>{formatDate(note.date).split(" ")[1] ?? ""}</span></div>
    <div className="attendance-note-body"><strong>{weekday}</strong>{detail.length > 0 && <p>{detail.join(" · ")}</p>}</div>
    <span className={`pill attendance-note-mark ${look.className}`}>{note.mark_label}</span>
  </li>;
}
