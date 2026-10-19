import type { ReactNode } from "react";
import { Check, ChevronDown } from "lucide-react";

import type { ReportCard } from "@/redux/services/portal-api";

type CardLine = { label: string; value: string };
type CardSubject = ReportCard["subjects"][number];
type Cumulative = NonNullable<ReportCard["cumulative"]>;

/** A readable screen layout of the published snapshot; figures are never recalculated. */
export function ReportCardReader({
  card,
  report,
  onReportChange,
}: {
  card: ReportCard;
  report: "term" | "year";
  onReportChange: (report: "term" | "year") => void;
}) {
  const cumulative = card.cumulative;
  const annual = report === "year" && !!cumulative;
  const findFact = (pattern: RegExp) =>
    card.facts.find((item) => pattern.test(item.label))?.value || "";
  const name = findFact(/^(name|student|pupil)/i);
  const className = findFact(/^class/i);
  const termAverage = card.totals.find((line) => /average/i.test(line.label) && !/class/i.test(line.label))?.value;
  const heroAverage = annual ? cumulative?.annual_average : termAverage;
  const stats: CardLine[] = annual
    ? [
        ...(cumulative?.annual_average ? [{ label: "Annual average", value: cumulative.annual_average }] : []),
        ...(cumulative?.annual_position ? [{ label: "Annual position", value: cumulative.annual_position }] : []),
        ...(cumulative?.terms.length ? [{ label: "Terms in report", value: String(cumulative.terms.length) }] : []),
      ]
    : card.totals.slice(0, 3);

  return (
    <div className="report-reader">
      <section className="report-hero" aria-label="Report summary">
        <div className="report-hero-top">
          <span>School report card</span>
          <span className="report-released">Released</span>
        </div>
        <h2>{name || "Report card"}</h2>
        {className && <p className="report-hero-class">{className}</p>}
        <div className="report-hero-bottom">
          <span className="report-hero-term">{annual ? "Full session" : card.term_line}</span>
          {heroAverage && (
            <div className="report-hero-metric">
              <strong>{heroAverage}</strong>
              <span>{annual ? "Annual average" : "Term average"}</span>
            </div>
          )}
        </div>
      </section>
      {stats.length > 0 && (
        <dl className="report-stats">
          {stats.map((line) => (
            <div className="report-stat" key={line.label}>
              <dt>{line.label}</dt>
              <dd>{line.value}</dd>
            </div>
          ))}
        </dl>
      )}
      {cumulative && (
        <div className="report-tabs" role="tablist" aria-label="Report view">
          <button type="button" role="tab" aria-selected={!annual} onClick={() => onReportChange("term")}>
            Term report
          </button>
          <button type="button" role="tab" aria-selected={annual} onClick={() => onReportChange("year")}>
            Full session
          </button>
        </div>
      )}
      {annual && cumulative ? <YearSubjects cumulative={cumulative} /> : <TermSubjects card={card} />}
      <div className="report-lower">
        {card.facts.length > 0 && (
          <InfoCard title="Child details">
            <Lines lines={card.facts} />
          </InfoCard>
        )}
        {card.totals.length > 0 && (
          <InfoCard title="Term summary">
            <Lines lines={card.totals} />
          </InfoCard>
        )}
        {card.attendance && card.attendance.length > 0 && (
          <InfoCard title="Attendance">
            <Lines lines={card.attendance} />
          </InfoCard>
        )}
        {card.ratings && card.ratings.length > 0 && (
          <InfoCard title="Conduct and skills">
            {card.rating_key && <p className="report-rating-key">{card.rating_key}</p>}
            <Lines
              lines={card.ratings.map((rating) => ({ label: rating.trait, value: String(rating.value) }))}
            />
          </InfoCard>
        )}
        {"teacher_comment" in card && (
          <InfoCard title="Class teacher’s comment">
            <p className="report-comment">{card.teacher_comment || "—"}</p>
            {card.teacher_name && <p className="report-signer">{card.teacher_name} · Class teacher</p>}
          </InfoCard>
        )}
        {"principal_comment" in card && (
          <InfoCard title="Principal’s comment">
            <p className="report-comment">{card.principal_comment || "—"}</p>
            {card.principal_name && <p className="report-signer">{card.principal_name} · Principal</p>}
          </InfoCard>
        )}
      </div>
      <footer className="report-footnote">
        <p>{card.grading_key}</p>
        {card.next_term_line && <p>{card.next_term_line}</p>}
        {card.version > 1 && <p>Version {card.version}: corrected after publication.</p>}
      </footer>
    </div>
  );
}

function TermSubjects({ card }: { card: ReportCard }) {
  return (
    <section>
      <div className="report-section-title">
        <h2>Subjects</h2>
        <span>Tap a subject for details</span>
      </div>
      {card.subjects.length === 0 ? (
        <p className="report-empty">No subjects are listed on this card.</p>
      ) : (
        <div className="report-subjects">
          {card.subjects.map((subject) => (
            <TermSubject key={subject.name} subject={subject} card={card} />
          ))}
        </div>
      )}
    </section>
  );
}

function TermSubject({ subject, card }: { subject: CardSubject; card: ReportCard }) {
  const hasScore = "total" in subject && subject.total !== null;
  const hasGrade = "grade" in subject && subject.grade !== null;
  const details: CardLine[] = [
    ...(subject.cells
      ? card.components.map((component, index) => ({
          label: component.short_name + " · out of " + component.max_score,
          value: subject.cells?.[index] || "—",
        }))
      : []),
    ...(hasScore ? [{ label: "Total", value: String(subject.total) }] : []),
    ...("class_average" in subject ? [{ label: "Class average", value: subject.class_average || "—" }] : []),
    ...("highest" in subject ? [{ label: "Highest", value: subject.highest === null ? "—" : String(subject.highest) }] : []),
    ...("lowest" in subject ? [{ label: "Lowest", value: subject.lowest === null ? "—" : String(subject.lowest) }] : []),
  ];
  const heading = (
    <>
      <span className="report-subject-glyph" aria-hidden="true">
        {subject.name.slice(0, 1).toUpperCase()}
      </span>
      <span className="report-subject-name">
        <strong>{subject.name}</strong>
        <small>{card.term_line}</small>
      </span>
      <span className="report-subject-score">
        {hasScore && <strong>{subject.total}</strong>}
        {hasGrade && <small>Grade {subject.grade}</small>}
      </span>
    </>
  );
  if (details.length === 0 && !("remark" in subject)) {
    return (
      <div className="report-subject">
        <div className="report-subject-static">{heading}</div>
      </div>
    );
  }
  return (
    <details className="report-subject">
      <summary>
        {heading}
        <ChevronDown size={17} aria-hidden="true" />
      </summary>
      <div className="report-subject-detail">
        {details.length > 0 && <Lines lines={details} />}
        {"remark" in subject && (
          <p className="report-subject-remark">Teacher&apos;s remark: {subject.remark || "—"}</p>
        )}
      </div>
    </details>
  );
}

function YearSubjects({ cumulative }: { cumulative: Cumulative }) {
  return (
    <section>
      <div className="report-year-overview">
        <strong>The school year</strong>
        {cumulative.terms.length > 0 && <p>{cumulative.terms.join(" · ")}</p>}
        {cumulative.promotion_line && (
          <div className="report-promotion">
            <Check size={18} aria-hidden="true" />
            {cumulative.promotion_line}
          </div>
        )}
      </div>
      <div className="report-section-title">
        <h2>Across the year</h2>
        <span>Tap a subject for details</span>
      </div>
      {cumulative.subjects.length === 0 ? (
        <p className="report-empty">No yearly subject figures are listed on this card.</p>
      ) : (
        <div className="report-subjects">
          {cumulative.subjects.map((subject) => (
            <YearSubject key={subject.name} subject={subject} cumulative={cumulative} />
          ))}
        </div>
      )}
    </section>
  );
}

function YearSubject({
  subject,
  cumulative,
}: {
  subject: Cumulative["subjects"][number];
  cumulative: Cumulative;
}) {
  const details: CardLine[] = [
    ...(subject.totals ? cumulative.terms.map((term, index) => ({ label: term, value: subject.totals?.[index] || "—" })) : []),
    ...("annual_average" in subject ? [{ label: "Annual average", value: subject.annual_average ?? "—" }] : []),
  ];
  const heading = (
    <>
      <span className="report-subject-glyph" aria-hidden="true">
        {subject.name.slice(0, 1).toUpperCase()}
      </span>
      <span className="report-subject-name">
        <strong>{subject.name}</strong>
        <small>Full session</small>
      </span>
      <span className="report-subject-score">
        {"annual_average" in subject && (
          <>
            <strong>{subject.annual_average ?? "—"}</strong>
            <small>Annual average</small>
          </>
        )}
      </span>
    </>
  );
  if (details.length === 0) {
    return (
      <div className="report-subject">
        <div className="report-subject-static">{heading}</div>
      </div>
    );
  }
  return (
    <details className="report-subject">
      <summary>
        {heading}
        <ChevronDown size={17} aria-hidden="true" />
      </summary>
      <div className="report-subject-detail">
        <Lines lines={details} />
      </div>
    </details>
  );
}

function InfoCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="report-info-card">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

function Lines({ lines }: { lines: CardLine[] }) {
  return (
    <dl className="report-lines">
      {lines.map((line) => (
        <div key={line.label}>
          <dt>{line.label}</dt>
          <dd>{line.value}</dd>
        </div>
      ))}
    </dl>
  );
}
