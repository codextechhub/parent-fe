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
  type FamilyFeesBlock,
  type Invoice,
  type PayAll,
  type Payment,
} from "@/redux/services/portal-api";

import "./fees.css";
import "./fees-parent.css";

/** Family balance first; individual bills and supporting tools open on demand. */
export function FeesPage() {
  const { data: fees, isLoading, isError, refetch } = useFamilyFeesQuery();
  const [historyOpen, setHistoryOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const { data: payments, isLoading: paymentsLoading, isError: paymentsError } =
    useFamilyPaymentsQuery(undefined, { skip: !historyOpen });
  const offline = useAppSelector((s) => s.connectivity.offline);
  const children = fees?.children ?? [];
  const orderedChildren = [...children].sort((left, right) => {
    const leftGroup = childFeesOrder(left);
    const rightGroup = childFeesOrder(right);
    if (leftGroup !== rightGroup) return leftGroup - rightGroup;
    if (leftGroup !== 0) return 0;
    const leftDue = earliestUnpaidDue(left);
    const rightDue = earliestUnpaidDue(right);
    if (!leftDue) return rightDue ? 1 : 0;
    if (!rightDue) return -1;
    return leftDue.localeCompare(rightDue);
  });

  return (
    <PageShell className="fees-page">
      <div className="fees-wrap">
        {isLoading && !fees && <div className="fees-loading" role="status" aria-label="Loading fees" />}
        {isError && !fees && (
          <div className="fees-notice" role="alert">
            Your family&apos;s fees can&apos;t be shown right now.{" "}
            <button type="button" onClick={() => refetch()}>Try again</button>
          </div>
        )}
        {fees && (
          <div className="fees-simple-layout">
            <FamilySummary
              combined={fees.combined}
              payAll={fees.pay_all}
              children={children}
              offline={offline}
            />
            <section aria-labelledby="fees-children-heading">
              <div className="fees-simple-heading">
                <h2 id="fees-children-heading">By child</h2>
                {children.length > 1 && <span>Choose a child to see their bills</span>}
              </div>
              {children.length === 0 ? (
                <div className="fees-surface fees-empty">No children on your account yet.</div>
              ) : (
                <ul className="fees-simple-children">
                  {orderedChildren.map((entry) => <li key={entry.child.id}><ChildFeesRow entry={entry} offline={offline} /></li>)}
                </ul>
              )}
            </section>

            <div className="fees-secondary-actions">
              <DisclosureButton title="Payment history" description="See payments and receipts" open={historyOpen} onClick={() => setHistoryOpen((value) => !value)} controls="fees-payment-history" />
              <DisclosureButton title="Pay by bank transfer" description="Find each child's account number" open={transferOpen} onClick={() => setTransferOpen((value) => !value)} controls="fees-bank-transfer" />
            </div>
            <section className="fees-secondary-panel" id="fees-payment-history" aria-label="Payment history" hidden={!historyOpen}>
              {historyOpen && <>
                <h2>Payment history</h2>
                {paymentsLoading && !payments ? <p className="fees-secondary-message">Loading payments…</p>
                  : paymentsError && !payments ? <p className="fees-secondary-message">Payments can&apos;t be shown right now.</p>
                  : !payments || payments.length === 0 ? <p className="fees-secondary-message">No payments yet.</p>
                  : <ul className="fees-payment-list">{payments.map((payment) => <PaymentRow key={`${payment.reference}:${payment.child.id}`} payment={payment} />)}</ul>}
              </>}
            </section>
            <section className="fees-secondary-panel" id="fees-bank-transfer" aria-label="Pay by bank transfer" hidden={!transferOpen}>
              {transferOpen && <>
                <h2>Pay by bank transfer</h2>
                <p className="fees-secondary-message">Each child has a separate account number.</p>
                <TransferCardsForChildren children={children} />
              </>}
            </section>
          </div>
        )}
      </div>
    </PageShell>
  );
}

function childFeesOrder(entry: ChildFeesEntry): number {
  if (!entry.available) return 3;
  if (entry.balance > 0) return 0;
  if (entry.balance < 0) return 1;
  return entry.invoices.length === 0 ? 2 : 4;
}

function earliestUnpaidDue(entry: ChildFeesEntry): string | null {
  if (!entry.available) return null;
  return entry.invoices
    .filter((invoice) => invoice.balance > 0 && invoice.due_date)
    .map((invoice) => invoice.due_date as string)
    .sort()[0] ?? null;
}

function FamilySummary({ combined, payAll, children, offline }: {
  combined: FamilyFeesBlock; payAll: PayAll; children: ChildFeesEntry[]; offline: boolean;
}) {
  if (!combined.available) {
    return <section className="fees-simple-summary is-unavailable" role="status" aria-label="Fee balance">
      <span className="fees-summary-label">Total left to pay</span>
      <strong className="fees-summary-amount">—</strong>
      <p>{combined.message}</p>
    </section>;
  }
  const availableChildren = children.filter((entry) => entry.available);
  const due = availableChildren.length
    ? availableChildren.reduce((total, entry) => total + Math.max(0, entry.balance), 0)
    : Math.max(0, combined.outstanding);
  const credit = availableChildren.reduce((total, entry) => total + Math.max(0, -entry.balance), 0);
  const owingCount = availableChildren.filter((entry) => entry.balance > 0).length;
  const canPayAll = due > 0 && payAll.total > 0 && payAll.steps.length > 0;
  return (
    <section className="fees-simple-summary" aria-label="Fee balance">
      <div>
        <span className="fees-summary-label">Bills still to pay</span>
        <strong className="fees-summary-amount">{formatNaira(due)}</strong>
        <p>{due > 0
          ? children.length > 1
            ? `${owingCount} of your ${children.length} children ${owingCount === 1 ? "has" : "have"} a balance.`
            : "One child has a balance."
          : combined.billed > 0 ? "No bills left to pay right now." : "No bills on your family account yet."}</p>
        {credit > 0 && <p className="fees-summary-credit">{formatNaira(credit)} in credit across child accounts. Credit does not settle another child&apos;s bill until the school transfers it.</p>}
      </div>
      {canPayAll && <div className="fees-summary-action">
        {offline ? <span className="fees-summary-offline">You can pay when you&apos;re back online.</span>
          : <Link to="/fees/pay-all" className="fees-summary-pay"><CreditCard size={17} aria-hidden="true" /> Pay all balances <span aria-hidden="true">→</span></Link>}
        <small>{payAll.steps.length} {payAll.steps.length === 1 ? "payment" : "payments"}, confirmed one at a time</small>
      </div>}
    </section>
  );
}

function ChildFeesRow({ entry, offline }: { entry: ChildFeesEntry; offline: boolean }) {
  const [open, setOpen] = useState(false);
  const panelId = `fees-child-bills-${entry.child.id}`;
  if (!entry.available) {
    return <article className="fees-simple-child"><div className="fees-child-summary-row">
      <div className="fees-child-identity"><ChildAvatar name={entry.child.full_name} childId={entry.child.id} size={44} />
        <div><strong>{entry.child.first_name}</strong><small>Fees unavailable</small></div></div>
      <p className="fees-child-unavailable">{entry.message}</p>
    </div></article>;
  }
  const invoices = entry.invoices;
  const unpaid = invoices.filter((invoice) => invoice.balance > 0);
  const nextDue = unpaid.map((invoice) => invoice.due_date).filter((date): date is string => !!date).sort()[0];
  const hasBills = invoices.length > 0;
  const oneUnpaid = unpaid.length === 1 ? unpaid[0] : undefined;
  const status = entry.balance > 0 ? nextDue ? `Due ${formatDate(nextDue)}` : "Outstanding"
    : entry.balance < 0 ? `${formatNaira(Math.abs(entry.balance))} in credit`
      : hasBills ? "Nothing due" : "No bills yet";

  return (
    <article className="fees-simple-child">
      <div className="fees-child-summary-row">
        <div className="fees-child-identity">
          <ChildAvatar name={entry.child.full_name} childId={entry.child.id} size={44} />
          <div><strong>{entry.child.first_name}</strong><small>{hasBills ? `${invoices.length} ${invoices.length === 1 ? "bill" : "bills"}` : "No bills yet"}</small></div>
        </div>
        <div className={cn("fees-child-balance", entry.balance <= 0 && "is-clear")}>
          <strong>{entry.balance > 0 ? formatNaira(entry.balance) : entry.balance < 0 ? "In credit" : hasBills ? "All paid" : "—"}</strong>
          <small>{status}</small>
        </div>
        {hasBills && <div className="fees-child-actions">
          {oneUnpaid && !offline && <Link className="fees-child-pay" to={`/fees/pay/${oneUnpaid.invoice_ref}`}>Pay {entry.child.first_name}</Link>}
          <button type="button" className="fees-child-bills-button" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen((value) => !value)}>
            {unpaid.length > 1 && !open ? "Choose bill" : "Bills"}<ChevronDown size={15} aria-hidden="true" />
          </button>
        </div>}
      </div>
      {hasBills && <div className="fees-child-bills-panel" id={panelId} hidden={!open}>
        {open && <ul className="fees-simple-bills">{invoices.map((invoice) => <InvoiceRow key={invoice.invoice_ref} invoice={invoice} offline={offline} />)}</ul>}
      </div>}
    </article>
  );
}

function InvoiceRow({ invoice, offline }: { invoice: Invoice; offline: boolean }) {
  return <li className="fees-simple-bill">
    <div className="fees-bill-main"><strong>{invoice.title}</strong><small>{[invoice.status_label, invoice.due_date ? `Due ${formatDate(invoice.due_date)}` : null].filter(Boolean).join(" · ")}</small></div>
    <div className="fees-bill-side"><strong>{formatNaira(Math.max(0, invoice.balance))}</strong><small>remaining</small></div>
    <div className="fees-bill-links"><Link to={`/fees/invoices/${invoice.invoice_ref}`}>View bill</Link>{invoice.balance > 0 && !offline && <Link to={`/fees/pay/${invoice.invoice_ref}`}>Pay bill</Link>}</div>
  </li>;
}

function DisclosureButton({ title, description, open, onClick, controls }: {
  title: string; description: string; open: boolean; onClick: () => void; controls: string;
}) {
  return <button type="button" className="fees-secondary-button" aria-expanded={open} aria-controls={controls} onClick={onClick}>
    <span><strong>{title}</strong><small>{description}</small></span><ChevronDown className={cn(open && "is-open")} size={18} aria-hidden="true" />
  </button>;
}

function PaymentRow({ payment }: { payment: Payment }) {
  const confirmed = payment.status === "CONFIRMED";
  const by = payment.payer_name ? `by ${payment.payer_name}` : payment.source_label || "";
  const method = confirmed ? payment.method_label : "Waiting for confirmation";
  const parts = [payment.child.first_name, payment.paid_on ? formatDate(payment.paid_on) : null, method, by].filter(Boolean);
  return <li className="fees-payment">
    <span className={cn("fees-payment-icon", !confirmed && "is-pending")}>
      {confirmed ? <Check size={18} aria-hidden="true" /> : <Clock3 size={18} aria-hidden="true" />}
    </span>
    <div className="fees-payment-main"><strong>{formatNaira(payment.amount)}</strong><span>{parts.join(" · ")}</span></div>
    <div className="fees-payment-side"><b className={cn(!confirmed && "is-pending")}>{payment.status_label}</b>
      {payment.has_receipt && payment.payment_ref ? <Link to={`/fees/receipts/${payment.payment_ref}`}><ReceiptIcon size={13} aria-hidden="true" /> Receipt</Link> : <small>No receipt yet</small>}
    </div>
  </li>;
}
