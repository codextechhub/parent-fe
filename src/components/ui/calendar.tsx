import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import "./calendar.css";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function dateParts(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function isoDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/** A Monday-first month picker styled like the School and Console calendars. */
export function Calendar({ selected, onSelect }: { selected: string; onSelect: (date: string) => void }) {
  const chosen = dateParts(selected);
  const [shown, setShown] = useState(() => new Date(chosen.getFullYear(), chosen.getMonth(), 1));
  const first = new Date(shown.getFullYear(), shown.getMonth(), 1);
  const offset = (first.getDay() + 6) % 7;
  const days = Array.from({ length: 42 }, (_, index) => new Date(shown.getFullYear(), shown.getMonth(), index - offset + 1));
  const today = isoDate(new Date());
  const years = Array.from({ length: 21 }, (_, index) => shown.getFullYear() - 10 + index);
  const moveMonth = (amount: number) => setShown(new Date(shown.getFullYear(), shown.getMonth() + amount, 1));

  return (
    <div className="school-calendar" role="group" aria-label="Choose a timetable date">
      <div className="school-calendar-head">
        <button type="button" aria-label="Previous month" onClick={() => moveMonth(-1)}><ChevronLeft size={17} aria-hidden="true" /></button>
        <div className="school-calendar-selects">
          <select aria-label="Month" value={shown.getMonth()} onChange={(event) => setShown(new Date(shown.getFullYear(), Number(event.target.value), 1))}>{MONTHS.map((month, index) => <option key={month} value={index}>{month}</option>)}</select>
          <select aria-label="Year" value={shown.getFullYear()} onChange={(event) => setShown(new Date(Number(event.target.value), shown.getMonth(), 1))}>{years.map((year) => <option key={year} value={year}>{year}</option>)}</select>
        </div>
        <button type="button" aria-label="Next month" onClick={() => moveMonth(1)}><ChevronRight size={17} aria-hidden="true" /></button>
      </div>
      <div className="school-calendar-grid">
        {WEEKDAYS.map((day) => <span className="school-calendar-weekday" key={day}>{day}</span>)}
        {days.map((date) => {
          const iso = isoDate(date);
          return <button key={iso} type="button" className={date.getMonth() !== shown.getMonth() ? "is-outside" : ""} aria-label={new Intl.DateTimeFormat("en-NG", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(date)} aria-pressed={iso === selected} data-today={iso === today} onClick={() => onSelect(iso)}>{date.getDate()}</button>;
        })}
      </div>
      <button type="button" className="school-calendar-today" onClick={() => onSelect(today)}>Today</button>
    </div>
  );
}
