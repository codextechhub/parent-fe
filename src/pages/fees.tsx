import { useState } from "react";
import { Check, ChevronDown, Clock3, CreditCard, Receipt as ReceiptIcon } from "lucide-react";
import { Link } from "react-router";

import { ChildAvatar } from "@/components/child-avatar";
import { SAVED_NUMBER_HINT } from "@/components/fees/transfer-account-card";
import { TransferCardsForChildren } from "@/components/fees/transfer-cards-for-children";
import { PageShell } from "@/components/layout/page-shell";
import { clearPayAllQueue } from "@/pages/pay-all-queue";
import { formatDate, formatNaira } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useAppSelector } from "@/redux/hooks";
import {
  cardPaymentsOn,
  useFamilyFeesQuery,
  useFamilyPaymentsQuery,
  type ChildFeesEntry,
  type DebitNote,
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
  // "Pay by transfer" on a charge opens the account numbers and brings them into view.
  const showTransfer = () => {
    setTransferOpen(true);
    window.setTimeout(() => document.getElementById("fees-bank-transfer")?.scrollIntoView?.({ block: "nearest", behavior: "smooth" }), 50);
  };
  const { data: payments, isLoading: paymentsLoading, isError: paymentsError } =
    useFamilyPaymentsQuery(undefined, { skip: !historyOpen });
  const offline = useAppSelector((s) => s.connectivity.offline);
  const children = fees?.children ?? [];
  const cardOn = cardPaymentsOn(fees);
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
              cardOn={cardOn}
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
                  {orderedChildren.map((entry) => <li key={entry.child.id}><ChildFeesRow entry={entry} offline={offline} cardOn={cardOn} onShowTransfer={showTransfer} /></li>)}
                </ul>
              )}
            </section>

            <div className="fees-secondary-actions">
              <DisclosureButton title="Payment history" description="See payments and receipts" open={historyOpen} onClick={() => setHistoryOpen((value) => !value)} controls="fees-payment-history" />
              <DisclosureButton
                title={(transferOpen ? "Hide" : "Show") + (children.length === 1 ? " account number" : " account numbers")}
                description={children.length === 1 ? "Pay by bank transfer into your child's own account" : "Pay by bank transfer into each child's own account"}
                open={transferOpen}
                onClick={() => setTransferOpen((value) => !value)}
                controls="fees-bank-transfer"
              />
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
                <p className="fees-secondary-message">{children.length === 1 ? "Your child has" : "Each child has"} an account number of their own. Pay into the one for the child you are paying for.</p>
                <TransferCardsForChildren children={children} hint={cardOn ? SAVED_NUMBER_HINT : undefined} />
              </>}
            </section>
          </div>
        )}
      </div>
    </PageShell>
  );
}

function childFeesOrder(entry: ChildFeesEntry): number {
  if (!entry.available) return 2;
  if (entry.owing > 0) return 0;
  if (entry.credit > 0) return 1;
  return entry.invoices.length + entry.debit_notes.length === 0 ? 4 : 3;
}

function earliestUnpaidDue(entry: ChildFeesEntry): string | null {
  if (!entry.available) return null;
  return entry.invoices
    .filter((invoice) => invoice.balance > 0 && invoice.due_date)
    .map((invoice) => invoice.due_date as string)
    .sort()[0] ?? null;
}

function FamilySummary({ combined, payAll, children, offline, cardOn }: {
  combined: FamilyFeesBlock; payAll: PayAll; children: ChildFeesEntry[]; offline: boolean; cardOn: boolean;
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
    ? availableChildren.reduce((total, entry) => total + entry.owing, 0)
    : combined.outstanding;
  const credit = availableChildren.length
    ? availableChildren.reduce((total, entry) => total + entry.credit, 0)
    : combined.credit;
  const owingCount = availableChildren.filter((entry) => entry.owing > 0).length;
  const canPayAll = cardOn && due > 0 && payAll.total > 0 && payAll.steps.length > 0;
  return (
    <section className="fees-simple-summary" aria-label="Fee balance">
      <div>
        <span className="fees-summary-label">Total left to pay</span>
        <strong className="fees-summary-amount">{formatNaira(due)}</strong>
        <p>{due > 0
          ? children.length > 1
            ? `${owingCount} of your ${children.length} children ${owingCount === 1 ? "has" : "have"} a balance.`
            : "One child has a balance."
          : combined.billed > 0 ? "No bills left to pay right now." : "No bills on your family account yet."}</p>
        {!cardOn && due > 0 && <p>Pay by bank transfer into each child&apos;s own account number. Tap Pay beside a bill, or choose Show account numbers below.</p>}
        {cardOn && payAll.charges_total > 0 && <p>
          Added charges ({formatNaira(payAll.charges_total)}) are not paid by card. Pay them by bank transfer into the child&apos;s account number.
        </p>}
        {credit > 0 && <p className="fees-summary-credit">{due > 0
          ? `${formatNaira(credit)} credit held by the school. Ask the school to apply it before you pay.`
          : `${formatNaira(credit)} in credit.`}</p>}
      </div>
      {canPayAll && <div className="fees-summary-action">
        {offline ? <span className="fees-summary-offline">You can pay when you&apos;re back online.</span>
          : <Link to="/fees/pay-all" onClick={clearPayAllQueue} className="fees-summary-pay"><CreditCard size={17} aria-hidden="true" /> Pay all balances <span aria-hidden="true">→</span></Link>}
        <small>{payAll.steps.length} {payAll.steps.length === 1 ? "payment" : "payments"}, confirmed one at a time</small>
      </div>}
    </section>
  );
}

function ChildFeesRow({ entry, offline, cardOn, onShowTransfer }: { entry: ChildFeesEntry; offline: boolean; cardOn: boolean; onShowTransfer: () => void }) {
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
  const charges = entry.debit_notes;
  const unpaid = invoices.filter((invoice) => invoice.balance > 0);
  const nextDue = unpaid.map((invoice) => invoice.due_date).filter((date): date is string => !!date).sort()[0];
  const hasBills = invoices.length > 0 || charges.length > 0;
  const oneUnpaid = unpaid.length === 1 ? unpaid[0] : undefined;
  const status = entry.owing > 0 ? nextDue ? `Due ${formatDate(nextDue)}` : "Outstanding"
    : entry.credit > 0 ? `${formatNaira(entry.credit)} in credit`
      : hasBills ? "Nothing due" : "No bills yet";
  const countLine = [
    invoices.length > 0 ? `${invoices.length} ${invoices.length === 1 ? "bill" : "bills"}` : null,
    charges.length > 0 ? `${charges.length} ${charges.length === 1 ? "charge" : "charges"}` : null,
  ].filter(Boolean).join(" · ") || "No bills yet";
  const toggleLabel = unpaid.length > 1 && !open ? "Choose bill"
    : invoices.length > 0 && charges.length > 0 ? "Bills and charges"
      : invoices.length === 0 ? "Charges" : "Bills";

  return (
    <article className="fees-simple-child">
      <div className="fees-child-summary-row">
        <div className="fees-child-identity">
          <ChildAvatar name={entry.child.full_name} childId={entry.child.id} size={44} />
          <div><strong>{entry.child.first_name}</strong><small>{countLine}</small></div>
        </div>
        <div className={cn("fees-child-balance", entry.owing <= 0 && "is-clear")}>
          <strong>{entry.owing > 0 ? formatNaira(entry.owing) : entry.credit > 0 ? "In credit" : hasBills ? "All paid" : "-"}</strong>
          <small>{status}</small>
        </div>
        {hasBills && <div className="fees-child-actions">
          {oneUnpaid && !offline && <Link className="fees-child-pay" to={`/fees/pay/${oneUnpaid.invoice_ref}`}>Pay {entry.child.first_name}</Link>}
          <button type="button" className="fees-child-bills-button" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen((value) => !value)}>
            {toggleLabel}<ChevronDown size={15} aria-hidden="true" />
          </button>
        </div>}
      </div>
      {entry.owing > 0 && entry.credit > 0 && <p className="fees-child-credit-note">
        {formatNaira(entry.credit)} credit held by the school. Ask the school to apply it before you pay.
      </p>}
      {hasBills && <div className="fees-child-bills-panel" id={panelId} hidden={!open}>
        {open && <ul className="fees-simple-bills">
          {invoices.map((invoice) => <InvoiceRow key={invoice.invoice_ref} invoice={invoice} offline={offline} />)}
          {charges.map((charge) => <ChargeRow key={`charge-${charge.note_ref}`} charge={charge} firstName={entry.child.first_name} cardOn={cardOn} onShowTransfer={onShowTransfer} />)}
        </ul>}
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

/** An added charge is settled by transfer into the child's account number, never by card. */
function ChargeRow({ charge, firstName, cardOn, onShowTransfer }: { charge: DebitNote; firstName: string; cardOn: boolean; onShowTransfer: () => void }) {
  return <li className="fees-simple-bill fees-simple-charge">
    <div className="fees-bill-main">
      <strong>{charge.reason || "Additional charge"}</strong>
      <small>{["Added charge", charge.status_label, charge.date ? `Added ${formatDate(charge.date)}` : null].filter(Boolean).join(" · ")}</small>
    </div>
    <div className="fees-bill-side"><strong>{formatNaira(Math.max(0, charge.balance))}</strong><small>remaining</small></div>
    <div className="fees-bill-links">
      {charge.balance <= 0
        ? <small>Paid</small>
        : <button type="button" className="fees-charge-transfer" onClick={onShowTransfer}>Pay by transfer</button>}
    </div>
    {charge.balance > 0 && <p className="fees-charge-note">
      {cardOn
        ? <>Pay this charge by bank transfer into {firstName}&apos;s account number. It can&apos;t be paid by card.</>
        : <>Pay this charge by bank transfer into {firstName}&apos;s account number. Choose Pay by transfer to see it.</>}
    </p>}
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
