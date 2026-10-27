import { useState, type ReactNode } from "react";
import { ChevronDown, ChevronRight, FileText, Info } from "lucide-react";
import { Link } from "react-router";

import { useChildHue } from "@/components/child-avatar";
import { PageShell } from "@/components/layout/page-shell";
import { ScreenTitle } from "@/components/layout/screen";
import { Segmented } from "@/components/layout/segmented";
import { ChildPicker } from "@/components/session/child-picker";
import { useActiveChild } from "@/components/session/child-switcher";
import { formatDate, formatTimestampDate } from "@/lib/format";
import { solidOf } from "@/lib/name-hue";
import { useSubjectColours } from "@/lib/use-subject-colours";
import { cellsLine, movement, movementLabel, percent, teachersBySubject } from "@/lib/results";
import { cn } from "@/lib/utils";
import { useAppSelector } from "@/redux/hooks";
import {
  useChildResultsQuery,
  useChildSessionResultsQuery,
  type SessionResults,
  type SubjectResult,
  type TermResult,
} from "@/redux/services/portal-api";

import "./results.css";

/** The child whose results are showing, with their colour; the page draws nothing without one. */
type Showing = { id: number; first: string; ring: string };

/**
 * Results (design 1d), the student app's with the children under the title:
 * the term's average on a ring in the child's colour, with position and
 * class average beside it, the report card, the class teacher's remark, then
 * each subject in its colour with a grade and a bar (tap one for its marks).
 * Full session shows the year: each term's average, and once the last term
 * is released the year's block with how each subject moved. Held and
 * unpublished figures stay out of view, with the school's words in their
 * place. Another child starts again on their latest term.
 */
export function ResultsPage() {
  const [tab, setTab] = useState<"term" | "session">("term");
  const child = useActiveChild();
  const hue = useChildHue(child?.id);
  const me = useAppSelector((s) => s.auth.me);
  const schoolYear = [me?.term?.name, me?.session?.name].filter(Boolean).join(" · ");
  const showing: Showing | null = child ? { id: child.id, first: child.first_name, ring: hue === null ? "#4a659d" : solidOf(hue) } : null;

  return (
    <PageShell className="results-page">
      <div className="results-wrap">
        <ScreenTitle eyebrow={schoolYear || undefined} title="Results">
          <ChildPicker />
        </ScreenTitle>
        <Segmented
          className="results-tabs"
          label="Results view"
          value={tab}
          onChange={setTab}
          options={[{ key: "term", label: "This term" }, { key: "session", label: "Full session" }]}
        />
        {showing && (tab === "term" ? <TermTab key={showing.id} child={showing} /> : <SessionTab key={showing.id} child={showing} />)}
      </div>
    </PageShell>
  );
}

function Notice({ children }: { children: ReactNode }) {
  return <div className="screen-card results-notice"><Info size={19} aria-hidden="true" /><p>{children}</p></div>;
}

function Loading() {
  return <div className="results-loading" role="status" aria-label="Loading results" />;
}

/** The term average on a ring in the child's colour, the way the design draws it. */
function Ring({ value, label, colour }: { value: string | null | undefined; label: string; colour: string }) {
  const share = value === null || value === undefined || !Number.isFinite(Number(value)) ? 0 : Math.max(0, Math.min(100, Number(value))) / 100;
  const around = 2 * Math.PI * 50;
  return (
    <div className="results-ring">
      <svg width="118" height="118" viewBox="0 0 118 118" aria-hidden="true">
        <circle cx="59" cy="59" r="50" fill="none" stroke="#e8eef8" strokeWidth="11" />
        {share > 0 && <circle cx="59" cy="59" r="50" fill="none" stroke={colour} strokeWidth="11" strokeLinecap="round" strokeDasharray={`${(share * around).toFixed(1)} ${around.toFixed(1)}`} />}
      </svg>
      <div><strong>{percent(value)}</strong><span>{label}</span></div>
    </div>
  );
}

function CardLink({ childId, termId, annual = false }: { childId: number; termId: number; annual?: boolean }) {
  return (
    <Link className="screen-card results-card-link" to={`/results/card/${termId}?child=${childId}`}>
      <span className="icon-tile"><FileText size={19} aria-hidden="true" /></span>
      <strong>View {annual ? "annual" : "term"} report card</strong>
      <ChevronRight size={18} aria-hidden="true" />
    </Link>
  );
}

function Remark({ title, text, by }: { title: string; text: string; by?: string | null }) {
  return (
    <section className="screen-card results-remark">
      <h2>{title}</h2>
      <p>{text}</p>
      {by && <small>{by}</small>}
    </section>
  );
}

/** A grade's tone: A green, B blue, C amber, anything lower red. "B2" reads as B. */
function gradeTone(grade: string | null | undefined): string {
  const letter = (grade ?? "").trim().charAt(0).toUpperCase();
  return letter === "A" ? "pill--good" : letter === "B" ? "" : letter === "C" ? "pill--warn" : "pill--bad";
}

/** A subject's mark beside its name: the first letter on the subject's own colour. */
function SubjectMark({ name, childId }: { name: string; childId: number }) {
  const colours = useSubjectColours(childId);
  return <span className="results-subject-mark" style={colours.tone(name)} aria-hidden="true">{name.trim().charAt(0).toUpperCase()}</span>;
}

function TermTab({ child }: { child: Showing }) {
  const [term, setTerm] = useState<number | null>(null);
  const { data, isLoading, isError, isFetching, refetch } = useChildResultsQuery({ childId: child.id, term });

  if (isLoading && !data) return <Loading />;
  if (isError && !data) return <Notice>Results can&apos;t be shown right now. <button type="button" onClick={() => refetch()}>Try again</button></Notice>;
  if (!data) return null;
  if (data.state === "not_published") return <Notice>No results have been published for {child.first} yet.</Notice>;

  const sessions = [...new Set(data.terms.map((item) => item.session))].reverse();
  const selectedSession = data.term?.session ?? sessions[0];
  const sessionTerms = data.terms.filter((item) => item.session === selectedSession);
  const choosing = sessions.length > 1 || sessionTerms.length > 1;

  return (
    <div className={cn("results-content", isFetching && "is-fetching")}>
      {choosing && (
        <div className="results-filter-controls">
          {sessions.length > 1 && <label><span>School year</span>
            <select value={selectedSession} onChange={(event) => {
              const latest = [...data.terms].reverse().find((item) => item.session === event.target.value);
              if (latest) setTerm(latest.id);
            }}>
              {sessions.map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
            <ChevronDown size={15} aria-hidden="true" />
          </label>}
          {sessionTerms.length > 1 && <label><span>Term</span>
            <select value={data.term?.id ?? ""} onChange={(event) => setTerm(Number(event.target.value))}>
              {[...sessionTerms].reverse().map((item) => <option key={item.id} value={item.id}>{item.name}{item.state === "withheld" ? " (held)" : ""}</option>)}
            </select>
            <ChevronDown size={15} aria-hidden="true" />
          </label>}
        </div>
      )}
      {data.state === "withheld" ? <Notice>{data.message}</Notice> : <ReleasedTerm result={data} child={child} />}
    </div>
  );
}

function ReleasedTerm({ result, child }: { result: TermResult; child: Showing }) {
  const summary = result.summary;
  const subjects = result.subjects ?? [];
  const position = summary?.position_label?.split(" of ");
  return (
    <div className="results-columns">
      <div className="results-overview">
        <section className="screen-card results-summary" aria-label={`${result.term?.name ?? "Term"} average`}>
          <div className="results-summary-head">
            <span>{result.term ? `${child.first}'s ${result.term.name.toLowerCase()} · ${result.term.session}` : `${child.first}'s term`}</span>
            <span className="pill pill--good">Released</span>
          </div>
          <div className="results-summary-body">
            <Ring value={summary?.overall_average} label="Term average" colour={child.ring} />
            <div className="results-summary-side">
              {summary?.position_label && (
                <div className="results-position">
                  <span>Position</span>
                  <strong>{position?.[0] ?? summary.position_label}</strong>
                  {position?.[1] && <small>of {position[1]} in {result.class_name ?? "the class"}</small>}
                </div>
              )}
              {summary?.class_average && <div className="results-side-row"><span>Class average</span><strong>{percent(summary.class_average)}</strong></div>}
              <div className="results-side-row"><span>Subjects</span><strong>{summary?.subjects ?? subjects.length}</strong></div>
            </div>
          </div>
        </section>
        {result.term && <CardLink childId={child.id} termId={result.term.id} />}
        {result.teacher_comment && <Remark title="Class teacher's remark" text={result.teacher_comment} by={result.class_teacher} />}
      </div>
      <div className="results-details">
        <div className="screen-section">
          <h2>By subject</h2>
          <span className="screen-section-aside">{subjects.length} {subjects.length === 1 ? "subject" : "subjects"} · tap for marks</span>
        </div>
        {subjects.length > 0 ? <ul className="screen-card results-subjects">{subjects.map((subject) => <li key={subject.name}><SubjectRow subject={subject} childId={child.id} /></li>)}</ul> : <Notice>No subjects are listed for this term.</Notice>}
      </div>
    </div>
  );
}

function SubjectRow({ subject, childId }: { subject: SubjectResult; childId: number }) {
  const numeric = Number(subject.percentage);
  const width = subject.percentage !== null && Number.isFinite(numeric) ? Math.max(0, Math.min(100, numeric)) : 0;
  const more = subject.cells.length > 0 || !!subject.remark;
  const colours = useSubjectColours(childId);
  return (
    <details className="results-subject">
      <summary>
        <span className="results-subject-row">
          <SubjectMark name={subject.name} childId={childId} />
          <span className="results-subject-name"><strong>{subject.name}</strong>{subject.teacher && <small>{subject.teacher}</small>}</span>
          <span className="results-subject-score"><strong>{percent(subject.percentage, 0)}</strong>{subject.grade && <small className={cn("pill", gradeTone(subject.grade))}>Grade {subject.grade}</small>}</span>
        </span>
        {subject.percentage !== null && <span className="results-score-bar" aria-hidden="true"><span style={{ width: `${width}%`, background: colours.dot(subject.name) }} /></span>}
      </summary>
      {more && (
        <div className="results-subject-detail">
          {subject.cells.length > 0 && <p>{cellsLine(subject)}</p>}
          {subject.remark && <p>{subject.remark}</p>}
        </div>
      )}
    </details>
  );
}

function SessionTab({ child }: { child: Showing }) {
  const { data, isLoading, isError, refetch } = useChildSessionResultsQuery({ childId: child.id, session: null });
  const latestTerm = data?.terms.filter((item) => item.state === "released").at(-1);
  const { data: latest } = useChildResultsQuery({ childId: child.id, term: latestTerm?.id ?? null }, { skip: !latestTerm });

  if (isLoading && !data) return <Loading />;
  if (isError && !data) return <Notice>The year&apos;s results can&apos;t be shown right now. <button type="button" onClick={() => refetch()}>Try again</button></Notice>;
  if (!data) return null;
  if (data.state === "not_published") return <Notice>No results have been published for {child.first} yet.</Notice>;
  if (!data.terms_released) return <Notice>The school is holding this year&apos;s results. Ask the school office when they will be available.</Notice>;
  return <SessionView session={data} child={child} teachers={teachersBySubject(latest?.subjects)} />;
}

const ORDINAL = ["First", "Second", "Third", "Fourth"];

function SessionView({ session, child, teachers }: { session: SessionResults; child: Showing; teachers: Map<string, string> }) {
  const cumulative = session.cumulative;
  const released = session.terms.filter((item) => item.state === "released");
  const last = released.at(-1);
  const position = cumulative?.annual_position_label?.split(" of ");
  // Terms still to come, so the year reads as a whole ("Second term · Not yet").
  const toCome = Math.max(0, (session.terms_total ?? 0) - session.terms.length);
  return (
    <div className="results-content">
      <div className="results-columns">
        <div className="results-overview">
          <section className="screen-card results-summary results-year" aria-label="Year average">
            <div className="results-summary-head">
              <span>{child.first}&apos;s {session.session?.name} school year</span>
              <span className="pill">{session.terms_released} {session.terms_released === 1 ? "term" : "terms"} released</span>
            </div>
            <span className="results-year-label">Year average</span>
            <strong className={cn("results-year-value", !cumulative && "is-empty")}>{cumulative ? percent(cumulative.annual_average) : "–"}</strong>
            {cumulative?.promotion && <span className="pill pill--good results-promotion">{cumulative.promotion}</span>}
            <div className="results-term-strip">
              {session.terms.map((term) => (
                <div className={cn("results-term-card", term.id === last?.id && "is-latest", term.state === "withheld" && "is-held")} key={term.id}>
                  <span>{term.name}</span>
                  <strong>{term.state === "withheld" ? "Held" : percent(term.average)}</strong>
                  <small>{term.state === "withheld" ? "By the school" : term.id === last?.id ? "Latest" : "Released"}</small>
                </div>
              ))}
              {Array.from({ length: toCome }, (_, index) => (
                <div className="results-term-card is-pending" key={`to-come-${index}`}>
                  <span>{ORDINAL[session.terms.length + index] ?? "Next"} term</span>
                  <strong>–</strong>
                  <small>Not yet</small>
                </div>
              ))}
            </div>
            {(cumulative?.annual_position_label || cumulative?.class_average) && (
              <div className="results-year-figures">
                {cumulative?.annual_position_label && <div className="results-side-row"><span>Year position</span><strong>{position?.[0] ?? cumulative.annual_position_label}{position?.[1] ? ` of ${position[1]}` : ""}</strong></div>}
                {cumulative?.class_average && <div className="results-side-row"><span>Class average</span><strong>{percent(cumulative.class_average)}</strong></div>}
              </div>
            )}
          </section>
          {cumulative && last && <CardLink childId={child.id} termId={last.id} annual />}
          {cumulative?.remark && <Remark title="Class teacher's remark for the year" text={cumulative.remark} by={[cumulative.class_teacher, session.next_term_begins ? `Next session begins ${formatDate(session.next_term_begins)}` : null].filter(Boolean).join(" · ")} />}
          {last?.released_at && <p className="results-published">Published {formatTimestampDate(last.released_at)} by the school</p>}
        </div>
        <div className="results-details">
          <div className="screen-section">
            <h2>Subject progress</h2>
            {cumulative && <span className="screen-section-aside">{cumulative.subjects.length} subjects</span>}
          </div>
          {cumulative ? <ul className="screen-card results-subjects">{cumulative.subjects.map((subject) => {
            const move = movement(subject.terms);
            return <li className="results-year-subject" key={subject.name}>
              <span className="results-subject-row">
                <SubjectMark name={subject.name} childId={child.id} />
                <span className="results-subject-name">
                  <strong>{subject.name}</strong>
                  {teachers.get(subject.name) && <small>{teachers.get(subject.name)}</small>}
                  <span className="results-year-terms">{subject.terms.map((item) => item.percentage === null ? "–" : Math.round(Number(item.percentage))).join(" → ")}{move && <span className={cn("results-movement", `is-${move.direction}`)}>{movementLabel(move)}</span>}</span>
                </span>
                <span className="results-subject-score"><strong>{percent(subject.annual_average, 0)}</strong>{subject.annual_grade && <small className={cn("pill", gradeTone(subject.annual_grade))}>Grade {subject.annual_grade}</small>}</span>
              </span>
            </li>;
          })}</ul> : <Notice>The year&apos;s summary appears here once the year&apos;s last term is released.</Notice>}
        </div>
      </div>
    </div>
  );
}
