import { useState } from "react";
import { ArrowLeft, CircleAlert, Download } from "lucide-react";
import { Link, useParams } from "react-router";

import { PageShell } from "@/components/layout/page-shell";
import { formatDate, formatNaira } from "@/lib/format";
import {
  useInvoiceSheetQuery,
  useLazyInvoicePdfQuery,
  type InvoiceSheet,
} from "@/redux/services/portal-api";

import "./receipt.css";

/** One invoice as a sheet: letterhead, billed-to child, lines, totals, Pay. */
export function InvoicePage() {
  const { invoiceRef } = useParams();
  const ref = Number(invoiceRef);
  const validRef = Number.isSafeInteger(ref) && ref > 0;
  const { data: invoice, isLoading, isError } = useInvoiceSheetQuery(ref, { skip: !validRef });
  const [fetchPdf, { isFetching }] = useLazyInvoicePdfQuery();
  const [pdfError, setPdfError] = useState("");

  const download = async () => {
    setPdfError("");
    const result = await fetchPdf(ref);
    if (!result.data)
      return setPdfError("The PDF can't be downloaded right now. Try again in a moment.");
    const link = document.createElement("a");
    link.href = result.data;
    link.download = `invoice-${invoice?.number || ref}.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(result.data!), 10_000);
  };

  return (
    <PageShell className="receipt-page">
      <div className="receipt-wrap">
        <Link to="/fees" className="receipt-back">
          <ArrowLeft size={17} aria-hidden="true" />
          Fees
        </Link>
        {isLoading && !invoice && (
          <div className="receipt-loading" role="status" aria-label="Loading invoice" />
        )}
        {(!validRef || isError) && !invoice && (
          <section className="receipt-unavailable" role="status">
            <span className="receipt-unavailable-icon">
              <CircleAlert size={27} aria-hidden="true" />
            </span>
            <h2>Invoice not available</h2>
            <p>This invoice is not on your family&apos;s account.</p>
            <Link to="/fees" className="receipt-secondary">
              Back to Fees
            </Link>
          </section>
        )}
        {invoice && (
          <div className="receipt-layout">
            <div className="receipt-overview">
              <section className="receipt-summary" aria-label="Invoice summary">
                <span className="receipt-summary-label">
                  Invoice for {invoice.child.first_name}
                </span>
                <strong className="receipt-summary-amount">
                  {formatNaira(Math.max(0, invoice.balance))}
                </strong>
                <div className="receipt-summary-bottom">
                  <span className="receipt-status">
                    {invoice.balance <= 0 ? "Fully paid" : invoice.status_label}
                  </span>
                  {invoice.due_date && (
                    <span>Due {formatDate(invoice.due_date)}</span>
                  )}
                </div>
              </section>
              <button
                type="button"
                className="receipt-download"
                onClick={download}
                disabled={isFetching}
              >
                <Download size={18} aria-hidden="true" />
                {isFetching ? "Preparing PDF…" : "Download PDF invoice"}
              </button>
              {pdfError && (
                <p role="alert" className="receipt-pdf-error">
                  {pdfError}
                </p>
              )}
              {invoice.balance > 0 && (
                <Link
                  to={`/fees/pay/${invoice.invoice_ref}`}
                  className="receipt-secondary"
                >
                  Pay this invoice
                </Link>
              )}
            </div>
            <InvoiceDocument invoice={invoice} />
          </div>
        )}
      </div>
    </PageShell>
  );
}

function InvoiceDocument({ invoice }: { invoice: InvoiceSheet }) {
  return (
    <article className="receipt-document" aria-label="Invoice">
      <div className="receipt-document-top">
        <div>
          <p className="receipt-issuer">{invoice.title}</p>
          <p className="receipt-issuer-sub">
            {invoice.invoice_date ? `Issued ${formatDate(invoice.invoice_date)}` : "Invoice"}
          </p>
        </div>
      </div>
      <div className="receipt-document-id">
        <span>Invoice number</span>
        <strong>{invoice.number}</strong>
      </div>
      <div className="receipt-tear" aria-hidden="true" />
      <div className="receipt-document-body">
        <dl className="receipt-details">
          <Fact label="Billed to" value={invoice.child.first_name} />
          {invoice.due_date && <Fact label="Due" value={formatDate(invoice.due_date)} />}
          <Fact label="Status" value={invoice.status_label} />
        </dl>
        <h2 className="receipt-section-title">Line items</h2>
        <div className="receipt-lines">
          {invoice.lines.map((line, index) => (
            <div className="receipt-line" key={`${line.description}-${index}`}>
              <div>
                <strong>{line.description}</strong>
              </div>
              <span>{formatNaira(line.amount)}</span>
            </div>
          ))}
        </div>
        <div className="receipt-total">
          <span>Invoice total</span>
          <strong>{formatNaira(invoice.total)}</strong>
        </div>
        <div className="receipt-total">
          <span>Paid to date</span>
          <strong>{formatNaira(invoice.paid)}</strong>
        </div>
        <div className="receipt-balance">
          <span>Balance due</span>
          <strong>{formatNaira(invoice.balance)}</strong>
        </div>
      </div>
    </article>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value || "-"}</dd>
    </div>
  );
}
