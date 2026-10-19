import { useState, type ReactNode } from "react";
import { ChevronRight, FileText } from "lucide-react";
import { Link } from "react-router";

import { ChildStrip } from "@/components/child-strip";
import { PageShell } from "@/components/layout/page-shell";
import { useActiveChild } from "@/components/session/child-switcher";
import { formatDate, formatTimestampDate } from "@/lib/format";
import {
  cellsLine,
  movement,
  movementLabel,
  percent,
  teachersBySubject,
  termsReleasedLine,
} from "@/lib/results";
import { cn } from "@/lib/utils";
import {
  useChildResultsQuery,
  useChildSessionResultsQuery,
  type SessionResults,
  type SubjectResult,
  type TermResult,
} from "@/redux/services/portal-api";

import "./results.css";

/** The showing child's released results, with held and unpublished kept out of view. */
export function ResultsPage() {
  const [tab, setTab] = useState<"term" | "session">("term");

  return (
    <PageShell className="results-page">
      <div className="results-wrap">
        <ChildStrip />
        <p className="results-kicker">Learning story</p>
        <div
          className={`results-tabs${tab === "session" ? " is-session" : ""}`}
          role="tablist"
          aria-label="Results view"
        >
          <span className="results-tab-indicator" aria-hidden="true" />
          {(["term", "session"] as const).map((key) => (
            <button
              key={key}
              id={`results-${key}-tab`}
              type="button"
              role="tab"
              aria-selected={tab === key}
              aria-controls={`results-${key}-panel`}
              className={cn("results-tab", tab === key && "is-active")}
              onClick={() => setTab(key)}
            >
              {key === "term" ? "This term" : "Full session"}
            </button>
          ))}
        </div>
        <div id="results-term-panel" role="tabpanel" aria-labelledby="results-term-tab" hidden={tab !== "term"}>
          {tab === "term" && <TermTab />}
        </div>
        <div id="results-session-panel" role="tabpanel" aria-labelledby="results-session-tab" hidden={tab !== "session"}>
          {tab === "session" && <SessionTab />}
        </div>
      </div>
    </PageShell>
  );
}

function Notice({ children }: { children: ReactNode }) {
  return <div className="results-notice">{children}</div>;
}

function Loading() {
  return <div className="results-loading" role="status" aria-label="Loading results" />;
}

function ResultHero({ label, value, chips }: { label: string; value: string; chips: ReactNode[] }) {
  return (
    <section className="results-hero" aria-label={label}>
      <span className="results-hero-label">{label}</span>
      <strong className="results-hero-value">{value}</strong>
      {chips.length > 0 && (
        <div className="results-hero-chips">
          {chips.map((chip, index) => (
            <span className="results-glass-chip" key={index}>
              {chip}
            </span>
          ))}
        </div>
      )}
    </section>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string | null }) {
  return (
    <div className="results-stat">
      <span>{label}</span>
      <strong>{value}</strong>
      {sub && <small>{sub}</small>}
    </div>
  );
}

function CardLink({ childId, termId, annual = false }: { childId: number; termId: number; annual?: boolean }) {
  return (
    <Link className="results-card-link" to={`/results/card/${termId}?child=${childId}`}>
      <FileText size={19} aria-hidden="true" />
      <span>
        <strong>View {annual ? "annual" : "term"} report card</strong>
      </span>
      <ChevronRight size={20} aria-hidden="true" />
    </Link>
  );
}

function TermTab() {
  const child = useActiveChild();
  const [term, setTerm] = useState<number | null>(null);
  const { data, isLoading, isError, isFetching, refetch } = useChildResultsQuery(
    { childId: child?.id ?? 0, term },
    { skip: !child },
  );

  if (isLoading && !data) return <Loading />;
  if (isError && !data)
    return (
      <Notice>
        Results can&apos;t be shown right now.{" "}
        <button type="button" onClick={() => refetch()}>
          Try again
        </button>
      </Notice>
    );
  if (!data) return null;
  if (data.state === "not_published")
    return <Notice>No results have been published for {child?.first_name} yet.</Notice>;

  const sessions = [...new Set(data.terms.map((item) => item.session))].reverse();
  const selectedSession = data.term?.session ?? sessions[0];
  const sessionTerms = data.terms.filter((item) => item.session === selectedSession);

  return (
    <div className={cn("results-content", isFetching && "is-fetching")}>
      <div className="results-filter">
        <div className="results-filter-controls">
          {sessions.length > 1 && (
            <label>
              School year
              <select
                value={selectedSession}
                onChange={(event) => {
                  const latest = [...data.terms].reverse().find((item) => item.session === event.target.value);
                  if (latest) setTerm(latest.id);
                }}
              >
                {sessions.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
          )}
          {sessionTerms.length > 1 ? (
            <label>
              Term
              <select
                value={data.term?.id ?? ""}
                onChange={(event) => setTerm(Number(event.target.value))}
              >
                {[...sessionTerms].reverse().map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                    {item.state === "withheld" ? " (held)" : ""}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <strong>
              {data.term?.name} · {data.term?.session}
            </strong>
          )}
        </div>
        {data.state === "released" && <span className="results-released">Released</span>}
      </div>
      {data.state === "withheld" ? <Notice>{data.message}</Notice> : <ReleasedTerm result={data} childId={child?.id ?? 0} />}
    </div>
  );
}

function ReleasedTerm({ result, childId }: { result: TermResult; childId: number }) {
  const summary = result.summary;
  const subjects = result.subjects ?? [];
  const position = summary?.position_label?.split(" of ");
  return (
    <div className="results-columns">
      <div className="results-overview">
        <ResultHero
          label={`${result.term?.name ?? "Term"} average`}
          value={percent(summary?.overall_average)}
          chips={[result.class_name].filter(Boolean)}
        />
        <div className="results-stats">
          {summary?.position_label && (
            <Stat
              label="Position"
              value={position?.[0] ?? summary.position_label}
              sub={position?.[1] ? `of ${position[1]} in ${result.class_name ?? "the class"}` : undefined}
            />
          )}
          {summary?.class_average && (
            <Stat label="Class average" value={percent(summary.class_average)} />
          )}
          <Stat label="Subjects" value={String(summary?.subjects ?? subjects.length)} />
        </div>
        {result.term && <CardLink childId={childId} termId={result.term.id} />}
        {result.teacher_comment && (
          <section className="results-remark">
            <h2>Class teacher&apos;s remark</h2>
            <p>{result.teacher_comment}</p>
            {result.class_teacher && <small>{result.class_teacher}</small>}
          </section>
        )}
      </div>
      <div className="results-details">
        <div className="results-section-heading">
          <h2>By subject</h2>
          <p>Tap a subject to see its breakdown</p>
        </div>
        {subjects.length > 0 ? (
          <ul className="results-subjects">
            {subjects.map((subject) => (
              <li key={subject.name}>
                <SubjectRow subject={subject} />
              </li>
            ))}
          </ul>
        ) : (
          <Notice>No subjects are listed for this term.</Notice>
        )}
      </div>
    </div>
  );
}

function SubjectRow({ subject }: { subject: SubjectResult }) {
  const numeric = Number(subject.percentage);
  const width =
    subject.percentage !== null && Number.isFinite(numeric)
      ? Math.max(0, Math.min(100, numeric))
      : 0;
  return (
    <details className="results-subject">
      <summary>
        <span className="results-subject-icon" aria-hidden="true">
          {subject.name.slice(0, 1).toUpperCase()}
        </span>
        <span className="results-subject-name">
          <strong>{subject.name}</strong>
          {subject.teacher && <small>{subject.teacher}</small>}
        </span>
        <span className="results-subject-score">
          <strong>{percent(subject.percentage, 0)}</strong>
          {subject.grade && (
            <small className={`is-${subject.grade.toLowerCase()}`}>Grade {subject.grade}</small>
          )}
        </span>
        <ChevronRight className="results-subject-chevron" size={18} aria-hidden="true" />
      </summary>
      <div className="results-subject-detail">
        {subject.percentage !== null && (
          <div className="results-score-bar" aria-hidden="true">
            <span style={{ width: `${width}%` }} />
          </div>
        )}
        {subject.cells.length > 0 && <p>{cellsLine(subject)}</p>}
        {subject.remark && <p>{subject.remark}</p>}
      </div>
    </details>
  );
}

function SessionTab() {
  const child = useActiveChild();
  const [session, setSession] = useState<number | null>(null);
  const { data, isLoading, isError, refetch } = useChildSessionResultsQuery(
    { childId: child?.id ?? 0, session },
    { skip: !child },
  );
  const latestTerm = data?.terms.filter((item) => item.state === "released").at(-1);
  const { data: latest } = useChildResultsQuery(
    { childId: child?.id ?? 0, term: latestTerm?.id ?? null },
    { skip: !child || !latestTerm },
  );

  if (isLoading && !data) return <Loading />;
  if (isError && !data)
    return (
      <Notice>
        The year&apos;s results can&apos;t be shown right now.{" "}
        <button type="button" onClick={() => refetch()}>
          Try again
        </button>
      </Notice>
    );
  if (!data) return null;
  if (data.state === "not_published") return <Notice>No results have been published yet.</Notice>;
  if (!data.terms_released)
    return (
      <Notice>
        The school is holding this year&apos;s results. Ask the school office when they will be
        available.
      </Notice>
    );
  return (
    <SessionView
      session={data}
      childId={child?.id ?? 0}
      teachers={teachersBySubject(latest?.subjects)}
      onPickSession={setSession}
    />
  );
}

function SessionView({
  session,
  childId,
  teachers,
  onPickSession,
}: {
  session: SessionResults;
  childId: number;
  teachers: Map<string, string>;
  onPickSession: (id: number) => void;
}) {
  const cumulative = session.cumulative;
  const released = session.terms.filter((item) => item.state === "released");
  const last = released.at(-1);
  const position = cumulative?.annual_position_label?.split(" of ");
  return (
    <div className="results-content">
      <div className="results-filter">
        <div className="results-filter-controls">
          <strong>{session.session?.name} school year</strong>
          <select
            value={session.session?.id ?? ""}
            onChange={(event) => onPickSession(Number(event.target.value))}
            aria-label="School year"
          >
            {session.session && (
              <option value={session.session.id}>{session.session.name}</option>
            )}
          </select>
        </div>
        <span className="results-released">
          {session.terms_released} {session.terms_released === 1 ? "term" : "terms"} released
        </span>
      </div>
      <div className="results-columns">
        <div className="results-overview">
          <ResultHero
            label="Year average"
            value={cumulative ? percent(cumulative.annual_average) : "–"}
            chips={[cumulative?.promotion, `${termsReleasedLine(session)}${session.terms_total ? " terms" : ""} released`].filter(Boolean)}
          />
          {(cumulative?.annual_position_label || cumulative?.class_average) && (
            <div className="results-stats">
              {cumulative?.annual_position_label && (
                <Stat
                  label="Year position"
                  value={position?.[0] ?? cumulative.annual_position_label}
                  sub={position?.[1] ? `of ${position[1]} for the year` : undefined}
                />
              )}
              {cumulative?.class_average && (
                <Stat label="Class average" value={percent(cumulative.class_average)} />
              )}
            </div>
          )}
          <div className="results-term-strip">
            {session.terms.map((term) => (
              <div
                className={cn("results-term-card", term.id === last?.id && "is-latest")}
                key={term.id}
              >
                <span>{term.name}</span>
                <strong>{term.state === "withheld" ? "Held" : percent(term.average)}</strong>
                <small>
                  {term.state === "withheld" ? "By the school" : term.id === last?.id ? "Latest" : "Released"}
                </small>
              </div>
            ))}
          </div>
          {cumulative && last && <CardLink childId={childId} termId={last.id} annual />}
          {cumulative?.remark && (
            <section className="results-remark">
              <h2>Class teacher&apos;s remark for the year</h2>
              <p>{cumulative.remark}</p>
              <small>
                {[
                  cumulative.class_teacher,
                  session.next_term_begins
                    ? `Next session begins ${formatDate(session.next_term_begins)}`
                    : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </small>
            </section>
          )}
          {last?.released_at && (
            <p className="results-published">
              Published {formatTimestampDate(last.released_at)} by the school
            </p>
          )}
        </div>
        <div className="results-details">
          <div className="results-section-heading">
            <h2>Subject progress</h2>
            <p>
              {cumulative
                ? `${cumulative.subjects.length} subjects · year average at right`
                : "The year's summary appears once the last term is released"}
            </p>
          </div>
          {cumulative ? (
            <ul className="results-year-subjects">
              {cumulative.subjects.map((subject) => {
                const move = movement(subject.terms);
                return (
                  <li className="results-year-subject" key={subject.name}>
                    <div className="results-year-subject-name">
                      <strong>{subject.name}</strong>
                      {teachers.get(subject.name) && <small>{teachers.get(subject.name)}</small>}
                      <span>
                        {subject.terms
                          .map((item) =>
                            item.percentage === null ? "–" : Math.round(Number(item.percentage)),
                          )
                          .join(" → ")}
                      </span>
                      {move && (
                        <small className={cn("results-movement", `is-${move.direction}`)}>
                          {movementLabel(move)}
                        </small>
                      )}
                    </div>
                    <div className="results-mini-bars" aria-hidden="true">
                      {subject.terms.map((item, index) => (
                        <i
                          key={index}
                          style={{
                            height:
                              item.percentage === null
                                ? 3
                                : `${Math.max(4, Math.round(Number(item.percentage) * 0.3))}px`,
                          }}
                        />
                      ))}
                    </div>
                    <div className="results-year-score">
                      <strong>{percent(subject.annual_average, 0)}</strong>
                      {subject.annual_grade && <small>Grade {subject.annual_grade}</small>}
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <Notice>
              The year&apos;s summary appears here once the year&apos;s last term is released.
            </Notice>
          )}
        </div>
      </div>
    </div>
  );
}
