import { useState } from "react";
import { Check, ChevronDown, Clock3, CreditCard, Receipt as ReceiptIcon } from "lucide-react";
import { Link } from "react-router";

import { ChildAvatar } from "@/components/child-avatar";
import { TransferCardsForChildren } from "@/components/fees/transfer-cards-for-children";
import { PageShell } from "@/components/layout/page-shell";
import { formatDate, formatNaira } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useAppSelector } from "@/redux/hooks";
import {
  useFamilyFeesQuery,
  useFamilyPaymentsQuery,
  type ChildFeesEntry,
  type Invoice,
  type PayAll,
  type Payment,
} from "@/redux/services/portal-api";

import "./fees.css";
import "./fees-parent.css";

/**
 * The family's fees: combined totals, a card per child with each of its
 * invoices, the family's payment history, and transfer accounts per child.
 *
 * `combined` can answer `available: false` when one child's books are
 * unreadable; its own sentence replaces the figures, never a zero. The
 * same holds for each `child` entry.
 */
export function FeesPage() {
  const { data: fees, isLoading, isError, refetch } = useFamilyFeesQuery();
  const { data: payments } = useFamilyPaymentsQuery();
  const offline = useAppSelector((s) => s.connectivity.offline);
  const showBranch = useAppSelector((s) => s.auth.me?.show_branch ?? false);
  const children = fees?.children ?? [];
  const combined = fees?.combined;

  return (
    <PageShell className="fees-page">
      <div className="fees-wrap">
        {isLoading && !fees && (
          <div className="fees-loading" role="status" aria-label="Loading fees" />
        )}
        {isError && !fees && (
          <div className="fees-notice" role="alert">
            Your family&apos;s fees can&apos;t be shown right now.{" "}
            <button type="button" onClick={() => refetch()}>
              Try again
            </button>
          </div>
        )}
        {fees && (
          <div className="fees-layout">
            <div className="fees-overview">
              <FamilyHero combined={combined} payAll={fees.pay_all} offline={offline} />
            </div>
            <div className="fees-detail">
              <section>
                <Heading title="Each child" description="A bill opens for its full breakdown" first />
                {children.length === 0 ? (
                  <div className="fees-surface fees-empty">
                    No children on your account yet.
                  </div>
                ) : (
                  <ul className="fees-child-list">
                    {children.map((entry) => (
                      <li key={entry.child.id}>
                        <ChildFeesCard
                          entry={entry}
                          minPartPayment={fees.min_part_payment}
                          offline={offline}
                          showBranch={showBranch}
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </section>
              <section>
                <Heading
                  title="Payment history"
                  description={
                    payments && payments.length > 0
                      ? "Across your children, newest first"
                      : "Payments appear here once they are confirmed"
                  }
                />
                <div className="fees-surface fees-history">
                  {!payments || payments.length === 0 ? (
                    <p className="fees-empty">No payments yet.</p>
                  ) : (
                    <ul>
                      {payments.map((payment) => (
                        <PaymentRow key={`${payment.reference}:${payment.child.id}`} payment={payment} />
                      ))}
                    </ul>
                  )}
                </div>
              </section>
              <section>
                <Heading title="Pay by transfer" description="One account number per child" />
                <TransferCardsForChildren children={children} />
              </section>
            </div>
          </div>
        )}
      </div>
    </PageShell>
  );
}

function Heading({
  title,
  description,
  first = false,
}: {
  title: string;
  description: string;
  first?: boolean;
}) {
  return (
    <div className={cn("fees-section-heading", first && "is-first")}>
      <h2>{title}</h2>
      <p>{description}</p>
    </div>
  );
}

function FamilyHero({
  combined,
  payAll,
  offline,
}: {
  combined?: { available: true; billed: number; paid: number; outstanding: number } | { available: false; message: string };
  payAll?: PayAll;
  offline: boolean;
}) {
  if (!combined) return null;
  if (!combined.available) {
    return (
      <section className="fees-hero fees-hero--amber" role="status">
        <span className="fees-hero-label">Combined fees</span>
        <strong className="fees-hero-value">—</strong>
        <span className="fees-hero-note">{combined.message}</span>
      </section>
    );
  }
  const outstanding = combined.outstanding;
  const label = outstanding > 0 ? "Outstanding across your children" : "All children paid";
  return (
    <>
      <section className="fees-hero" aria-label="Family fees">
        <span className="fees-hero-label">{label}</span>
        <strong className="fees-hero-value">
          {outstanding > 0 ? formatNaira(outstanding) : formatNaira(0)}
        </strong>
        {combined.billed > 0 && combined.outstanding > 0 && (
          <>
            <div className="fees-progress-label">
              <span>Paid so far</span>
              <span>
                {formatNaira(combined.paid)} of {formatNaira(combined.billed)}
              </span>
            </div>
            <div className="fees-progress" aria-hidden="true">
              <span
                style={{
                  width: `${Math.max(
                    0,
                    Math.min(100, (combined.paid / combined.billed) * 100),
                  )}%`,
                }}
              />
            </div>
          </>
        )}
        <span className="fees-hero-note">
          {outstanding > 0
            ? `${formatNaira(combined.paid)} paid so far across your children.`
            : combined.billed > 0
              ? "Nothing is outstanding right now. Thank you."
              : "No bills on your family account yet."}
        </span>
      </section>
      <div className="fees-stats">
        <Stat label="Total billed" value={formatNaira(combined.billed)} />
        <Stat label="Paid so far" value={formatNaira(combined.paid)} />
      </div>
      {payAll && payAll.total > 0 && (
        <PayAllCta payAll={payAll} offline={offline} />
      )}
    </>
  );
}

function PayAllCta({ payAll, offline }: { payAll: PayAll; offline: boolean }) {
  const steps = payAll.steps.length;
  if (steps === 0) return null;
  return (
    <section className="fees-pay-all-card">
      <div>
        <strong>Pay every outstanding bill</strong>
        <p>
          {steps} {steps === 1 ? "payment" : "payments"}, one for each child, totalling{" "}
          <b>{formatNaira(payAll.total)}</b>. The gateway takes them one at a time.
        </p>
      </div>
      {offline ? (
        <p className="fees-pay-all-offline">
          You can start the sequence when you&apos;re back online.
        </p>
      ) : (
        <Link to="/fees/pay-all" className="fees-pay-all-link">
          <CreditCard size={17} aria-hidden="true" />
          Start pay all
        </Link>
      )}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="fees-stat">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ChildFeesCard({
  entry,
  minPartPayment: _minPartPayment,
  offline,
  showBranch: _showBranch,
}: {
  entry: ChildFeesEntry;
  minPartPayment: number;
  offline: boolean;
  showBranch: boolean;
}) {
  if (!entry.available) {
    return (
      <article className="fees-child-card">
        <header className="fees-child-head">
          <ChildAvatar name={entry.child.full_name} size={36} />
          <div>
            <strong>{entry.child.first_name}</strong>
            <small>Fees unavailable</small>
          </div>
        </header>
        <p className="fees-empty">{entry.message}</p>
      </article>
    );
  }
  const invoices = entry.invoices;
  const owing = entry.balance;
  return (
    <article className="fees-child-card">
      <header className="fees-child-head">
        <ChildAvatar name={entry.child.full_name} size={36} />
        <div className="fees-child-name">
          <strong>{entry.child.first_name}</strong>
          <small>
            {owing > 0
              ? `${formatNaira(owing)} outstanding`
              : owing < 0
                ? `${formatNaira(Math.abs(owing))} in credit`
                : invoices.length === 0
                  ? "No bills yet"
                  : "All paid"}
          </small>
        </div>
      </header>
      {invoices.length === 0 ? (
        <p className="fees-child-empty">No bills on {entry.child.first_name}&apos;s account yet.</p>
      ) : (
        <ul className="fees-invoices">
          {invoices.map((invoice, index) => (
            <InvoiceCard
              key={invoice.invoice_ref}
              invoice={invoice}
              openAtFirst={index === 0}
              offline={offline}
            />
          ))}
        </ul>
      )}
    </article>
  );
}

function InvoiceCard({
  invoice,
  openAtFirst,
  offline,
}: {
  invoice: Invoice;
  openAtFirst: boolean;
  offline: boolean;
}) {
  const [open, setOpen] = useState(openAtFirst);
  return (
    <li className="fees-invoice fees-surface">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={`fees-invoice-${invoice.invoice_ref}`}
        onClick={() => setOpen((value) => !value)}
        className="fees-invoice-toggle"
      >
        <span className="fees-invoice-title">
          <strong>{invoice.title}</strong>
          <small>
            {[invoice.number, invoice.due_date ? `Due ${formatDate(invoice.due_date)}` : null]
              .filter(Boolean)
              .join(" · ")}
          </small>
        </span>
        <span
          className={cn(
            "fees-invoice-status",
            invoice.status === "PAID"
              ? "is-paid"
              : invoice.status === "PARTIAL"
                ? "is-partial"
                : "is-due",
          )}
        >
          {invoice.status_label}
        </span>
        <ChevronDown className={cn("fees-invoice-chevron", open && "is-open")} size={17} aria-hidden="true" />
      </button>
      {open && (
        <div className="fees-invoice-detail" id={`fees-invoice-${invoice.invoice_ref}`}>
          <dl>
            {invoice.lines.map((line, index) => (
              <div className="fees-invoice-line" key={index}>
                <dt>{line.description}</dt>
                <dd>{formatNaira(line.amount)}</dd>
              </div>
            ))}
            <div className="fees-invoice-line is-total">
              <dt>Total billed</dt>
              <dd>{formatNaira(invoice.total)}</dd>
            </div>
            <div className="fees-invoice-line">
              <dt>Paid</dt>
              <dd>{formatNaira(invoice.paid)}</dd>
            </div>
            <div className="fees-invoice-line is-balance">
              <dt>Balance</dt>
              <dd>{formatNaira(invoice.balance)}</dd>
            </div>
          </dl>
          <div className="fees-invoice-actions">
            <Link className="fees-view-link" to={`/fees/invoices/${invoice.invoice_ref}`}>
              View invoice
            </Link>
            {invoice.balance > 0 && !offline && (
              <Link className="fees-pay-link" to={`/fees/pay/${invoice.invoice_ref}`}>
                Pay <span aria-hidden="true">→</span>
              </Link>
            )}
            {invoice.balance > 0 && offline && (
              <p className="fees-invoice-note">You can pay when you&apos;re back online.</p>
            )}
            {invoice.balance <= 0 && (
              <p className="fees-invoice-note is-paid">
                <Check size={16} aria-hidden="true" />
                This bill is fully paid. Thank you.
              </p>
            )}
          </div>
        </div>
      )}
    </li>
  );
}

function PaymentRow({ payment }: { payment: Payment }) {
  const confirmed = payment.status === "CONFIRMED";
  const by = payment.payer_name ? `by ${payment.payer_name}` : payment.source_label || "";
  const method = confirmed ? payment.method_label : "Waiting for confirmation";
  const parts = [
    payment.child.first_name,
    payment.paid_on ? formatDate(payment.paid_on) : null,
    method,
    by,
  ].filter(Boolean);
  return (
    <li className="fees-payment">
      <span className={cn("fees-payment-icon", !confirmed && "is-pending")}>
        {confirmed ? <Check size={18} aria-hidden="true" /> : <Clock3 size={18} aria-hidden="true" />}
      </span>
      <div className="fees-payment-main">
        <strong>{formatNaira(payment.amount)}</strong>
        <span>{parts.join(" · ")}</span>
      </div>
      <div className="fees-payment-side">
        <b className={cn(!confirmed && "is-pending")}>{payment.status_label}</b>
        {payment.has_receipt && payment.payment_ref ? (
          <Link to={`/fees/receipts/${payment.payment_ref}`}>
            <ReceiptIcon size={13} aria-hidden="true" />
            Receipt
          </Link>
        ) : (
          <small>No receipt yet</small>
        )}
      </div>
    </li>
  );
}
