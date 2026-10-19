import { useState } from "react";
import { ArrowLeft, Check, CircleAlert, Download } from "lucide-react";
import { Link, useParams } from "react-router";

import { PageShell } from "@/components/layout/page-shell";
import { formatDate, formatNaira } from "@/lib/format";
import {
  useLazyReceiptPdfQuery,
  useReceiptQuery,
  type Receipt,
} from "@/redux/services/portal-api";

import "./receipt.css";

/** A confirmed payment's receipt. The balance is frozen when it was booked. */
export function ReceiptPage() {
  const { paymentRef } = useParams();
  const ref = Number(paymentRef);
  const validRef = Number.isSafeInteger(ref) && ref > 0;
  const { data: receipt, isLoading, isError } = useReceiptQuery(ref, { skip: !validRef });
  const [fetchPdf, { isFetching }] = useLazyReceiptPdfQuery();
  const [pdfError, setPdfError] = useState("");

  const download = async () => {
    setPdfError("");
    const result = await fetchPdf(ref);
    if (!result.data)
      return setPdfError("The PDF can't be downloaded right now. Try again in a moment.");
    const link = document.createElement("a");
    link.href = result.data;
    link.download = `receipt-${receipt?.receipt_number || ref}.pdf`;
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
        {isLoading && !receipt && (
          <div className="receipt-loading" role="status" aria-label="Loading receipt" />
        )}
        {(!validRef || isError) && !receipt && <Unavailable />}
        {receipt && (
          <div className="receipt-layout">
            <div className="receipt-overview">
              <section className="receipt-summary" aria-label="Confirmed payment">
                <span className="receipt-summary-label">
                  Payment received for {receipt.child.first_name}
                </span>
                <strong className="receipt-summary-amount">{formatNaira(receipt.amount)}</strong>
                <div className="receipt-summary-bottom">
                  <span className="receipt-status">Received</span>
                  <span>{formatDate(receipt.paid_on)}</span>
                </div>
              </section>
              <button
                type="button"
                className="receipt-download"
                onClick={download}
                disabled={isFetching}
              >
                <Download size={18} aria-hidden="true" />
                {isFetching ? "Preparing PDF…" : "Download PDF receipt"}
              </button>
              {pdfError && (
                <p role="alert" className="receipt-pdf-error">
                  {pdfError}
                </p>
              )}
            </div>
            <ReceiptDocument receipt={receipt} />
          </div>
        )}
      </div>
    </PageShell>
  );
}

function Unavailable() {
  return (
    <section className="receipt-unavailable" role="status">
      <span className="receipt-unavailable-icon">
        <CircleAlert size={27} aria-hidden="true" />
      </span>
      <h2>Receipt not available yet</h2>
      <p>
        A payment gets its receipt once it is confirmed. Check its status in Fees.
      </p>
      <Link to="/fees" className="receipt-secondary">
        Back to Fees
      </Link>
    </section>
  );
}

function ReceiptDocument({ receipt }: { receipt: Receipt }) {
  return (
    <article className="receipt-document" aria-label="Payment receipt">
      <div className="receipt-document-top">
        <div>
          <p className="receipt-issuer">{receipt.issuer_name}</p>
          <p className="receipt-issuer-sub">Official payment receipt</p>
        </div>
        <span className="receipt-document-stamp">
          <Check size={22} aria-hidden="true" />
        </span>
      </div>
      <div className="receipt-document-id">
        <span>Receipt number</span>
        <strong>{receipt.receipt_number}</strong>
      </div>
      <div className="receipt-tear" aria-hidden="true" />
      <div className="receipt-document-body">
        <dl className="receipt-details">
          <Fact label="Received from" value={receipt.received_from} />
          <Fact label="On behalf of" value={receipt.child.first_name} />
          <Fact label="Payment date" value={formatDate(receipt.paid_on)} />
          <Fact label="Payment method" value={receipt.method_label} />
          <Fact label="Reference" value={receipt.reference} reference />
          {receipt.payer_name && <Fact label="Paid by" value={receipt.payer_name} />}
        </dl>
        <h2 className="receipt-section-title">Applied to</h2>
        <div className="receipt-lines">
          {receipt.lines.map((line, index) => (
            <div className="receipt-line" key={`${line.invoice_number}-${index}`}>
              <div>
                <strong>{line.title}</strong>
                <small>{line.invoice_number}</small>
              </div>
              <span>{formatNaira(line.amount_applied)}</span>
            </div>
          ))}
        </div>
        <div className="receipt-total">
          <span>Amount received</span>
          <strong>{formatNaira(receipt.amount)}</strong>
        </div>
        <div className="receipt-balance">
          <span>Balance after this payment</span>
          <strong>{formatNaira(receipt.balance_after)}</strong>
        </div>
        <p className="receipt-historic">
          This was the balance when the payment was recorded. The current balance in Fees may
          have changed since.
        </p>
      </div>
    </article>
  );
}

function Fact({
  label,
  value,
  reference = false,
}: {
  label: string;
  value: string;
  reference?: boolean;
}) {
  return (
    <div>
      <dt>{label}</dt>
      <dd className={reference ? "is-reference" : undefined}>{value || "-"}</dd>
    </div>
  );
}
