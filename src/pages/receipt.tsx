import { useState } from "react";
import { Clock3, Download } from "lucide-react";
import { Link, useParams } from "react-router";

import { BlockTitle, Fact, Letterhead } from "@/components/fees/finance-document";
import { PageShell } from "@/components/layout/page-shell";
import { BottomBar, DetailBar } from "@/components/layout/screen";
import { accountBalanceWords, formatDate, formatNaira } from "@/lib/format";
import { useAppSelector } from "@/redux/hooks";
import {
  useLazyReceiptPdfQuery,
  useReceiptQuery,
  type DocumentLetterhead,
  type Receipt,
} from "@/redux/services/portal-api";

import "./receipt.css";

/**
 * A confirmed payment's receipt (design 1p), a screen of its own over Fees.
 *
 * The payment in a green card (for whom, how much, when), the receipt under
 * it as a sheet of paper, and Download PDF receipt at the foot. The balance
 * on the receipt is the one frozen when the payment was booked. Before a
 * payment is confirmed there is no receipt yet, and the screen says so (1t).
 */
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
      <DetailBar title="Receipt" back="/fees" backText="Fees" backLabel="Back to Fees" />
      <div className="receipt-wrap">
        {isLoading && !receipt && <div className="receipt-loading" role="status" aria-label="Loading receipt" />}
        {(!validRef || isError) && !receipt && <Unavailable />}
        {receipt && (
          <>
            <section className="receipt-summary" aria-label="Confirmed payment">
              <div className="screen-orb" aria-hidden="true" />
              <span className="receipt-summary-label">Payment received for {receipt.child.first_name}</span>
              <strong className="receipt-summary-amount">{formatNaira(receipt.amount)}</strong>
              <div className="receipt-summary-bottom">
                <span className="receipt-status">Received</span>
                <span>{formatDate(receipt.paid_on)}</span>
              </div>
            </section>
            <ReceiptDocument receipt={receipt} />
            {pdfError && <p role="alert" className="receipt-pdf-error">{pdfError}</p>}
          </>
        )}
      </div>
      {receipt && (
        <BottomBar>
          <button type="button" className="xs-button" onClick={download} disabled={isFetching}>
            <Download size={18} aria-hidden="true" />
            {isFetching ? "Preparing PDF…" : "Download PDF receipt"}
          </button>
        </BottomBar>
      )}
    </PageShell>
  );
}

function Unavailable() {
  return (
    <section className="screen-card receipt-unavailable" role="status">
      <span className="receipt-unavailable-icon"><Clock3 size={28} aria-hidden="true" /></span>
      <h2>Receipt not available yet</h2>
      <p>A payment gets its receipt once it is confirmed. Check its status in Fees.</p>
      <Link to="/fees" className="xs-button xs-button--plain">Back to Fees</Link>
    </section>
  );
}

/**
 * The receipt as a sheet of paper: letterhead, the amount received in
 * figures and words, what it settled, and the account's balance after it, in
 * the PDF's order and figures, set in the app's type (`fdoc--app`).
 *
 * The balance is the one frozen when the payment was booked, which is why the
 * sheet says so under it. A server that predates the letterhead sends only the
 * school's name, and the sheet draws that.
 */
function ReceiptDocument({ receipt }: { receipt: Receipt }) {
  const school = useAppSelector((s) => s.auth.me?.school);
  const letterhead: DocumentLetterhead = receipt.letterhead ?? {
    name: receipt.issuer_name || school?.name || "",
    tag: "",
    logo_url: school?.logo_url ?? "",
    address: "",
    email: "",
    phone: "",
    website: "",
  };

  return (
    <article className="fdoc fdoc--app" aria-label="Payment receipt">
      <div className="fdoc-stamp" aria-hidden="true">Received</div>
      <Letterhead
        letterhead={letterhead}
        kind="Receipt"
        kindSub="Payment received"
        number={receipt.receipt_number}
        tone="paid"
      />

      <section className="fdoc-meta-grid">
        <div>
          <BlockTitle>Payment details</BlockTitle>
          <dl>
            <Fact label="Payment date">{formatDate(receipt.paid_on)}</Fact>
            <Fact label="Method">{receipt.method_label || "-"}</Fact>
            {receipt.reference && <Fact label="Reference">{receipt.reference}</Fact>}
            {receipt.payer_name && <Fact label="Paid by">{receipt.payer_name}</Fact>}
          </dl>
        </div>
        <div>
          <BlockTitle>Received from</BlockTitle>
          <p className="fdoc-party-name">{receipt.received_from}</p>
          {receipt.customer_code && <p className="fdoc-party-line">Account · {receipt.customer_code}</p>}
          <p className="fdoc-party-line">On behalf of {receipt.child.first_name}</p>
        </div>
      </section>

      <section className="fdoc-hero" aria-label="Amount received">
        <div>
          <p className="fdoc-hero-label">Amount received</p>
          <strong className="fdoc-hero-amount">{formatNaira(receipt.amount)}</strong>
          {receipt.amount_in_words && <p className="fdoc-hero-words">{receipt.amount_in_words}</p>}
        </div>
        <span className="fdoc-badge is-paid">Paid</span>
      </section>

      <table className="fdoc-table">
        <thead>
          <tr>
            <th>Applied to invoice</th>
            <th className="num">Amount applied</th>
            <th className="num">Invoice balance</th>
          </tr>
        </thead>
        <tbody>
          {receipt.lines.map((line, index) => (
            <tr key={`${line.invoice_number}-${index}`}>
              <td>
                <div className="fdoc-ref">{line.invoice_number}</div>
                {line.title && <div className="fdoc-line-sub">{line.title}</div>}
              </td>
              <td className="num" data-label="Amount applied">{formatNaira(line.amount_applied)}</td>
              <td className="num" data-label="Invoice balance">{formatNaira(line.balance_after)}</td>
            </tr>
          ))}
          {receipt.lines.length === 0 && (
            <tr>
              <td><div className="fdoc-ref">Unallocated credit</div></td>
              <td className="num" data-label="Amount applied">{formatNaira(receipt.amount)}</td>
              <td className="num" data-label="Invoice balance">-</td>
            </tr>
          )}
        </tbody>
      </table>

      <div className="fdoc-after">
        <div className="fdoc-after-box">
          <span>Account balance after this payment</span>
          <strong>{accountBalanceWords(receipt.balance_after)}</strong>
        </div>
      </div>
      <p className="fdoc-historic">
        This was the balance when the payment was recorded. The current balance in Fees may have
        changed since.
      </p>

      <footer className="fdoc-footer">
        <div className="fdoc-footer-note">
          This is a computer-generated receipt and is valid without a physical signature. Retain it
          as proof of payment.
          <p className="fdoc-thanks">Thank you - your payment has been received and applied.</p>
        </div>
        <div className="fdoc-sign">
          <div className="fdoc-sign-line" />
          <div className="fdoc-sign-label">Authorised by · Bursary</div>
        </div>
      </footer>
    </article>
  );
}
