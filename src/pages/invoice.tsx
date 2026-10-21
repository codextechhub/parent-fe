import { useState } from "react";
import { ArrowLeft, CircleAlert, Download } from "lucide-react";
import { Link, useParams } from "react-router";

import { BlockTitle, Fact, Letterhead } from "@/components/fees/finance-document";
import { PageShell } from "@/components/layout/page-shell";
import { formatDate, formatNaira } from "@/lib/format";
import { useAppSelector } from "@/redux/hooks";
import {
  useInvoiceSheetQuery,
  useLazyInvoicePdfQuery,
  type DocumentLetterhead,
  type InvoiceSheet,
} from "@/redux/services/portal-api";

import "./receipt.css";

/** One invoice: the summary and its actions beside the invoice in the school's printed design. */
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

/**
 * The invoice in the school's printed design: letterhead, billed-to account,
 * lines with their VAT, totals, and the bank to pay into.
 *
 * It draws from `invoice.document`, the same figures the PDF prints. A server
 * that predates that block sends only the summary fields, and the sheet then
 * draws those under the school's name from the signed-in session, without the
 * VAT column or the bank.
 */
function InvoiceDocument({ invoice }: { invoice: InvoiceSheet }) {
  const school = useAppSelector((s) => s.auth.me?.school);
  const doc = invoice.document;
  const letterhead: DocumentLetterhead = doc?.letterhead ?? {
    name: school?.name ?? "",
    tag: "",
    logo_url: school?.logo_url ?? "",
    address: "",
    email: "",
    phone: "",
    website: "",
  };
  const status = doc?.status ?? (invoice.balance <= 0 ? "PAID" : invoice.paid > 0 ? "PARTIAL" : "UNPAID");
  const invoiceDate = doc?.invoice_date ?? invoice.invoice_date;
  const dueDate = doc?.due_date ?? invoice.due_date;
  const total = doc?.total ?? invoice.total;
  const paid = doc?.amount_paid ?? invoice.paid;
  const balance = doc?.balance_due ?? invoice.balance;

  return (
    <article className="fdoc" aria-label="Invoice">
      <Letterhead
        letterhead={letterhead}
        kind="Tax Invoice"
        kindSub="Original for recipient"
        number={doc?.document_number || invoice.number}
      />

      <section className="fdoc-meta-grid">
        <div>
          <BlockTitle>Invoice details</BlockTitle>
          <dl>
            {invoiceDate && <Fact label="Invoice date">{formatDate(invoiceDate)}</Fact>}
            {dueDate && <Fact label="Due date">{formatDate(dueDate)}</Fact>}
            {doc?.reference && <Fact label="Reference">{doc.reference}</Fact>}
            <Fact label="Status">
              <span className={`fdoc-badge ${BADGE[status] ?? "is-unpaid"}`}>{STATUS_WORD[status] ?? status}</span>
            </Fact>
          </dl>
        </div>
        <div>
          <BlockTitle>Billed to</BlockTitle>
          <p className="fdoc-party-name">{doc?.billed_to.name || invoice.child.first_name}</p>
          {doc?.billed_to.code && <p className="fdoc-party-line">Account · {doc.billed_to.code}</p>}
          <p className="fdoc-party-line">For {invoice.child.first_name}</p>
          {doc?.billed_to.email && <p className="fdoc-party-line">{doc.billed_to.email}</p>}
          {doc?.billed_to.phone && <p className="fdoc-party-line">{doc.billed_to.phone}</p>}
          {doc?.billed_to.address && <p className="fdoc-party-line">{doc.billed_to.address}</p>}
        </div>
      </section>

      {doc ? (
        <table className="fdoc-table">
          <thead>
            <tr>
              <th>Description</th>
              <th className="num">Qty</th>
              <th className="num">Unit price</th>
              <th className="num">VAT</th>
              <th className="num">Amount</th>
            </tr>
          </thead>
          <tbody>
            {doc.lines.map((line, index) => (
              <tr key={`${line.description}-${index}`}>
                <td>
                  <div className="fdoc-line-name">{line.description}</div>
                  {line.detail && <div className="fdoc-line-sub">{line.detail}</div>}
                </td>
                <td className="num" data-label="Qty">{line.quantity}</td>
                <td className="num" data-label="Unit price">{formatNaira(line.unit_price)}</td>
                <td className="num" data-label="VAT">
                  {line.tax_label ? <span className="fdoc-tax-tag">{line.tax_label}</span> : formatNaira(line.tax_amount)}
                </td>
                <td className="num" data-label="Amount">{formatNaira(line.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <table className="fdoc-table">
          <thead>
            <tr>
              <th>Description</th>
              <th className="num">Amount</th>
            </tr>
          </thead>
          <tbody>
            {invoice.lines.map((line, index) => (
              <tr key={`${line.description}-${index}`}>
                <td><div className="fdoc-line-name">{line.description}</div></td>
                <td className="num" data-label="Amount">{formatNaira(line.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="fdoc-totals">
        {doc && (
          <div className="fdoc-total-row">
            <span>Subtotal (net)</span>
            <span>{formatNaira(doc.subtotal)}</span>
          </div>
        )}
        {doc && doc.tax_total > 0 && (
          <div className="fdoc-total-row is-sep">
            <span>VAT</span>
            <span>{formatNaira(doc.tax_total)}</span>
          </div>
        )}
        <div className="fdoc-total-row is-grand">
          <span>Total</span>
          <span>{formatNaira(total)}</span>
        </div>
        {paid > 0 && (
          <div className="fdoc-total-row">
            <span>Amount paid</span>
            <span>− {formatNaira(paid)}</span>
          </div>
        )}
        {doc && doc.adjustments !== 0 && (
          <div className="fdoc-total-row">
            <span>Credits and adjustments</span>
            <span>
              {doc.adjustments > 0 ? "− " : "+ "}
              {formatNaira(Math.abs(doc.adjustments))}
            </span>
          </div>
        )}
        <div className="fdoc-balance">
          <span>Balance due</span>
          <strong>{formatNaira(balance)}</strong>
        </div>
      </div>

      {(doc?.bank || dueDate) && (
        <section className="fdoc-payto">
          {doc?.bank && (
            <div>
              <BlockTitle>Payment by bank transfer</BlockTitle>
              <div className="fdoc-bank-row"><span>Bank</span><span>{doc.bank.bank_name}</span></div>
              <div className="fdoc-bank-row"><span>Account name</span><span>{doc.bank.account_name}</span></div>
              <div className="fdoc-bank-row"><span>Account number</span><span>{doc.bank.account_number}</span></div>
              <div className="fdoc-bank-row"><span>Use reference</span><span>{doc.document_number}</span></div>
            </div>
          )}
          {dueDate && (
            <p className="fdoc-due-note">
              Please pay on or before the due date, <strong>{formatDate(dueDate)}</strong>.
            </p>
          )}
        </section>
      )}

      <footer className="fdoc-footer">
        <div className="fdoc-footer-note">
          {doc?.narration && (
            <>
              <strong>Notes:</strong> {doc.narration}
            </>
          )}
          <p className="fdoc-thanks">Thank you.</p>
        </div>
      </footer>
    </article>
  );
}

/** The invoice's settlement status as its badge reads and is coloured. */
const STATUS_WORD: Record<string, string> = { PAID: "Paid", PARTIAL: "Partial", UNPAID: "Unpaid" };
const BADGE: Record<string, string> = { PAID: "is-paid", PARTIAL: "is-partial", UNPAID: "is-unpaid" };
