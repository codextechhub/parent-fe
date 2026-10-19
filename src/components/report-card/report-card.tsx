import type { ReactNode } from "react";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { ReportCard } from "@/redux/services/portal-api";

type CardLine = { label: string; value: string };
type Cumulative = NonNullable<ReportCard["cumulative"]>;

/**
 * A report card as it prints: A4, portrait, black and white.
 *
 * Every word and figure is the server's, from the snapshot the gradebook
 * published with the class, and nothing is recomputed here. A block or
 * column the reader may not read (Field Access) is absent from the payload
 * and so from the card. The parent portal only serves released cards, so
 * `held` is never true here; it stays in the type for parity with the
 * staff app's component that does render the held line.
 *
 * Shared with student-fe's and school-fe's cards; keep them in step.
 */
export function ReportCardSheet({ card, className }: { card: ReportCard; className?: string }) {
  const first = card.subjects[0] ?? {};
  const showCells = card.components.length > 0 && card.subjects.some((subject) => subject.cells);
  const showFigures = "total" in first;
  const showStats = card.subjects.some((subject) => "class_average" in subject);
  const year = card.cumulative ? yearColumns(card.cumulative) : null;
  const { letterhead } = card;
  const address = [letterhead.branch_name, letterhead.branch_address, letterhead.phone]
    .filter(Boolean)
    .join(" · ");

  return (
    <article className={cn("report-card mx-auto w-full max-w-[210mm] space-y-4 bg-white p-4 text-black-01 sm:p-8", className)}>
      {card.held && (
        <p role="status" className="print-hide rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-[#854F0B]">
          Held: this result is not released to the family. Staff can read and print it for the school&apos;s file.
        </p>
      )}

      <div className="flex items-center gap-4 border-b border-black/20 pb-3">
        {letterhead.logo_url && (
          <img src={letterhead.logo_url} alt="" className="size-14 shrink-0 object-contain grayscale" />
        )}
        <div className="min-w-0">
          <p className="font-mont text-lg font-semibold">{letterhead.school_name}</p>
          {address && <p className="text-xs text-gray-06">{address}</p>}
          <p className="mt-1 text-sm font-medium">{card.term_line}</p>
        </div>
      </div>

      <dl className="grid grid-cols-1 gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
        {card.facts.map((fact) => (
          <div key={fact.label} className="flex justify-between gap-3 border-b border-dotted border-black/15 py-1">
            <dt className="text-gray-06">{fact.label}</dt>
            <dd className="text-right font-medium">{fact.value || "-"}</dd>
          </div>
        ))}
      </dl>

      <Table className="text-[13px] [&_th]:whitespace-normal [&_th]:leading-tight">
        <TableHeader>
          <TableRow>
            <TableHead className="w-[22%] min-w-36">Subject</TableHead>
            {showCells &&
              card.components.map((component) => (
                <TableHead key={component.short_name} className="text-center">
                  {component.short_name}
                  <span className="block text-[11px] font-normal text-gray-05">{component.max_score}</span>
                </TableHead>
              ))}
            {showFigures && <TableHead className="text-center">Total</TableHead>}
            {showFigures && <TableHead className="text-center">Grade</TableHead>}
            {showStats && <TableHead className="text-center">Class avg</TableHead>}
            {showStats && <TableHead className="text-center">High</TableHead>}
            {showStats && <TableHead className="text-center">Low</TableHead>}
            {year?.earlier.map((term) => (
              <TableHead key={term} className="text-center">
                {term}
              </TableHead>
            ))}
            {year?.annual && <TableHead className="text-center">Annual avg</TableHead>}
            {showFigures && <TableHead>Remark</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {card.subjects.map((subject) => (
            <TableRow key={subject.name}>
              <TableCell className="font-medium">{subject.name}</TableCell>
              {showCells &&
                card.components.map((component, index) => (
                  <TableCell key={component.short_name} className="text-center">
                    {subject.cells?.[index] || "-"}
                  </TableCell>
                ))}
              {showFigures && <TableCell className="text-center font-medium">{subject.total ?? "-"}</TableCell>}
              {showFigures && <TableCell className="text-center">{subject.grade ?? "-"}</TableCell>}
              {showStats && <TableCell className="text-center">{subject.class_average ?? "-"}</TableCell>}
              {showStats && <TableCell className="text-center">{subject.highest ?? "-"}</TableCell>}
              {showStats && <TableCell className="text-center">{subject.lowest ?? "-"}</TableCell>}
              {year?.earlier.map((term, index) => (
                <TableCell key={term} className="text-center">
                  {year.totals(subject.name)[index] || "-"}
                </TableCell>
              ))}
              {year?.annual && <TableCell className="text-center">{year.average(subject.name) ?? "-"}</TableCell>}
              {showFigures && <TableCell>{subject.remark ?? "-"}</TableCell>}
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {(card.totals.length > 0 || card.cumulative) && (
        <div className="space-y-1">
          <Lines lines={[...card.totals, ...(card.cumulative ? yearLines(card.cumulative) : [])]} columns />
          {card.cumulative?.promotion_line && (
            <p className="text-sm font-semibold">{card.cumulative.promotion_line}</p>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {card.attendance && (
          <Block title="Attendance">
            <Lines lines={card.attendance} />
          </Block>
        )}
        {card.ratings && card.ratings.length > 0 && (
          <Block title="Conduct and skills">
            {card.rating_key && <p className="mb-1 text-xs text-gray-05">{card.rating_key}</p>}
            <Lines
              columns
              lines={card.ratings.map((rating) => ({ label: rating.trait, value: String(rating.value) }))}
            />
          </Block>
        )}
      </div>

      {"teacher_comment" in card && (
        <Block title="Class teacher's comment">
          <p className="text-sm">{card.teacher_comment || "-"}</p>
          {card.teacher_name && <p className="mt-1 text-xs text-gray-06">{card.teacher_name}</p>}
        </Block>
      )}
      {"principal_comment" in card && (
        <Block title="Principal's comment">
          <p className="text-sm">{card.principal_comment || "-"}</p>
          {card.principal_name && <p className="mt-1 text-xs text-gray-06">{card.principal_name}</p>}
        </Block>
      )}

      <footer className="space-y-1 border-t border-black/20 pt-2 text-xs text-gray-06">
        <p>{card.grading_key}</p>
        {card.next_term_line && <p className="font-medium text-black-01">{card.next_term_line}</p>}
        {card.version > 1 && <p>Version {card.version}: corrected after publication.</p>}
      </footer>
    </article>
  );
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-md border border-black/15 p-3">
      <h3 className="mb-1 text-sm font-semibold">{title}</h3>
      {children}
    </section>
  );
}

function Lines({ lines, columns = false }: { lines: CardLine[]; columns?: boolean }) {
  return (
    <dl className={cn("text-sm", columns && "grid grid-cols-1 gap-x-6 sm:grid-cols-2")}>
      {lines.map((line) => (
        <div key={line.label} className="flex justify-between gap-3 py-0.5">
          <dt className="text-gray-06">{line.label}</dt>
          <dd className="text-right font-medium">{line.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function yearColumns(cumulative: Cumulative) {
  const bySubject = new Map(cumulative.subjects.map((subject) => [subject.name, subject]));
  const showsTotals = cumulative.subjects.some((subject) => subject.totals);
  return {
    earlier: showsTotals ? cumulative.terms.slice(0, -1) : [],
    annual: cumulative.subjects.some((subject) => "annual_average" in subject),
    totals: (name: string) => bySubject.get(name)?.totals ?? [],
    average: (name: string) => bySubject.get(name)?.annual_average,
  };
}

function yearLines(cumulative: Cumulative): CardLine[] {
  return [
    ...(cumulative.annual_average ? [{ label: "Annual average", value: cumulative.annual_average }] : []),
    ...(cumulative.annual_position ? [{ label: "Annual position", value: cumulative.annual_position }] : []),
  ];
}

