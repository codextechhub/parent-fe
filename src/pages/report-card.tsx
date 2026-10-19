import { useState } from "react";
import { ArrowLeft, Download, LockKeyhole } from "lucide-react";
import { Link, useParams, useSearchParams } from "react-router";

import { ChildStrip } from "@/components/child-strip";
import { PageShell } from "@/components/layout/page-shell";
import { ReportCardReader } from "@/components/report-card/reader";
import { ReportCardSheet } from "@/components/report-card/report-card";
import { useReportCardPrint } from "@/components/report-card/print-page";
import { useActiveChild } from "@/components/session/child-switcher";
import { CHILD_PARAM } from "@/components/session/child-switcher";
import { useChildReportCardQuery } from "@/redux/services/portal-api";

import "./report-card.css";

/**
 * One child's released report card, with a Phone view and a Printable A4 view.
 *
 * The parent portal only serves released cards; a held or unpublished term
 * is a 404, shown as a sentence rather than a crash. Download PDF prints
 * through the browser at A4 portrait: `useReportCardPrint` names the page
 * on the document root while this screen is open.
 */
export function ReportCardPage() {
  const { termId } = useParams();
  const [params] = useSearchParams();
  const id = Number(termId);
  const validId = Number.isSafeInteger(id) && id > 0;
  const child = useActiveChild();
  const { data: card, isLoading, isError } = useChildReportCardQuery(
    { childId: child?.id ?? 0, term: id },
    { skip: !child || !validId },
  );
  const [view, setView] = useState<"read" | "paper">("read");
  const [report, setReport] = useState<"term" | "year">("term");
  useReportCardPrint();

  const released = card && !card.held ? card : null;
  const annual = report === "year" && !!released?.cumulative;
  const resultsLink = `/results${params.has(CHILD_PARAM) ? `?${CHILD_PARAM}=${params.get(CHILD_PARAM)}` : ""}`;

  return (
    <PageShell className="report-page">
      <div className="report-wrap">
        <ChildStrip />
        <div className="report-topline print-hide">
          <Link to={resultsLink} className="report-back">
            <ArrowLeft size={17} aria-hidden="true" />
            Results
          </Link>
          {released && (
            <button type="button" className="report-download" onClick={() => window.print()}>
              <Download size={17} aria-hidden="true" />
              Download PDF
            </button>
          )}
        </div>
        {isLoading && !card && (
          <div className="report-loading print-hide" role="status" aria-label="Loading report card" />
        )}
        {(!isLoading || !validId || isError) && !released && (
          <section className="report-unavailable print-hide" role="status">
            <span className="report-unavailable-icon">
              <LockKeyhole size={26} aria-hidden="true" />
            </span>
            <h2>This report card isn&apos;t available</h2>
            <p>
              The school may not have released it yet, or it may be held for review. Ask the school
              office if you expected to see it.
            </p>
          </section>
        )}
        {released && (
          <>
            <div
              className={`report-view-switch print-hide${view === "paper" ? " is-paper" : ""}`}
              role="group"
              aria-label="Report card layout"
            >
              <span className="report-view-indicator" aria-hidden="true" />
              <button type="button" aria-pressed={view === "read"} onClick={() => setView("read")}>
                Phone view
              </button>
              <button type="button" aria-pressed={view === "paper"} onClick={() => setView("paper")}>
                Printable A4
              </button>
            </div>
            {view === "read" && (
              <div className="print-hide">
                <ReportCardReader
                  card={released}
                  report={annual ? "year" : "term"}
                  onReportChange={setReport}
                />
              </div>
            )}
            <div className={"print-area report-paper" + (view !== "paper" ? " is-hidden-screen" : "")}>
              <ReportCardSheet card={released} />
            </div>
          </>
        )}
      </div>
    </PageShell>
  );
}
