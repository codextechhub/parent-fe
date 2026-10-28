import { useState, type ReactNode } from "react";
import { Building2, Check, ChevronDown, Clock3, CreditCard, Info, Receipt as ReceiptIcon } from "lucide-react";
import { Link } from "react-router";

import { ChildAvatar } from "@/components/child-avatar";
import { TRANSFER_HINT } from "@/components/fees/child-transfer-account";
import { SAVED_NUMBER_HINT } from "@/components/fees/transfer-account-card";
import { TransferCardsForChildren } from "@/components/fees/transfer-cards-for-children";
import { PageShell } from "@/components/layout/page-shell";
import { ScreenTitle } from "@/components/layout/screen";
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
import "./fees-family.css";

/**
 * The family's fees (design 1g), under the large title "Fees".
 *
 * First the deep blue card: what the family still has to pay, how many
 * children have a balance, any credit the school holds, and Pay all balances
 * where the school takes cards. Added charges are never paid by card, so an
 * amber note under the card says so. Then a card per child, owing first and
 * soonest due first: what they owe and when, Pay where one bill is open, and
 * their bills and charges folded away until asked for. Last, one card with
 * Payment history and Show account numbers, each opening in place; the
 * history is read only once opened. From 900px the money sits on the left
 * and the children on the right.
 */
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
  const one = children.length === 1;

  return (
    <PageShell className="fees-page">
      <div className="fees-layout">
        <div className="fees-side">
          <ScreenTitle title="Fees" eyebrow={one ? "Your child" : "Your family"} />
          {isLoading && !fees && <div className="fees-loading" role="status" aria-label="Loading fees" />}
          {isError && !fees && (
            <div className="screen-card fees-notice" role="alert">
              Your family&apos;s fees can&apos;t be shown right now.{" "}
              <button type="button" onClick={() => refetch()}>Try again</button>
            </div>
          )}
          {fees && (
            <>
              <FamilySummary combined={fees.combined} payAll={fees.pay_all} children={children} offline={offline} cardOn={cardOn} />
              {cardOn && fees.pay_all.charges_total > 0 && (
                <div className="fees-charges-note">
                  <Info size={18} aria-hidden="true" />
                  <p>Added charges ({formatNaira(fees.pay_all.charges_total)}) are not paid by card. Pay them by bank transfer into the child&apos;s account number.</p>
                </div>
              )}
            </>
          )}
        </div>

        {fees && (
          <div className="fees-content">
            <section className="fees-section" aria-labelledby="fees-children-heading">
              <div className="screen-section">
                <h2 id="fees-children-heading">{one ? "Bills" : "By child"}</h2>
                {children.length > 1 && <span className="screen-section-aside">Choose a child to see their bills</span>}
              </div>
              {children.length === 0 ? (
                <p className="screen-card fees-empty">No children on your account yet.</p>
              ) : (
                <ul className="fees-simple-children">
                  {orderedChildren.map((entry) => <li key={entry.child.id}><ChildFeesRow entry={entry} offline={offline} cardOn={cardOn} onShowTransfer={showTransfer} /></li>)}
                </ul>
              )}
            </section>

            <div className="screen-card fees-more">
              <DisclosureButton
                icon={<ReceiptIcon size={18} aria-hidden="true" />}
                tone="good"
                title="Payment history"
                description="See payments and receipts"
                open={historyOpen}
                onClick={() => setHistoryOpen((value) => !value)}
                controls="fees-payment-history"
              />
              <section className="fees-more-panel" id="fees-payment-history" aria-label="Payment history" hidden={!historyOpen}>
                {historyOpen && (paymentsLoading && !payments ? <p className="fees-more-message">Loading payments…</p>
                  : paymentsError && !payments ? <p className="fees-more-message">Payments can&apos;t be shown right now.</p>
                  : !payments || payments.length === 0 ? <p className="fees-more-message">No payments yet.</p>
                  : <ul className="fees-payment-list">{payments.map((payment) => <PaymentRow key={`${payment.reference}:${payment.child.id}`} payment={payment} />)}</ul>)}
              </section>
              <DisclosureButton
                icon={<Building2 size={18} aria-hidden="true" />}
                title={(transferOpen ? "Hide" : "Show") + (one ? " account number" : " account numbers")}
                description={one ? "Pay by bank transfer into your child's own account" : "Pay by bank transfer into each child's own account"}
                open={transferOpen}
                onClick={() => setTransferOpen((value) => !value)}
                controls="fees-bank-transfer"
              />
              <section className="fees-more-panel" id="fees-bank-transfer" aria-label="Pay by bank transfer" hidden={!transferOpen}>
                {transferOpen && <>
                  <p className="fees-more-message">
                    {one ? "Your child has" : "Each child has"} an account number of their own. Pay into the one for the child you are paying for.{" "}
                    {cardOn ? SAVED_NUMBER_HINT : TRANSFER_HINT}
                  </p>
                  <TransferCardsForChildren children={children} />
                </>}
              </section>
            </div>
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
    return <section className="fees-summary is-unavailable" role="status" aria-label="Fee balance">
      <span className="fees-summary-label">Total left to pay</span>
      <p className="fees-summary-line">{combined.message}</p>
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
  const [whole, kobo] = formatNaira(due).split(".");
  return (
    <section className="fees-summary" aria-label="Fee balance">
      <span className="screen-orb" aria-hidden="true" />
      <span className="fees-summary-label">Total left to pay</span>
      <strong className="fees-summary-amount">{whole}<span>.{kobo}</span></strong>
      <p className="fees-summary-line">{due > 0
        ? children.length > 1
          ? `${owingCount} of your ${children.length} children ${owingCount === 1 ? "has" : "have"} a balance.`
          : "One child has a balance."
        : combined.billed > 0 ? "No bills left to pay right now." : "No bills on your family account yet."}</p>
      {!cardOn && due > 0 && <p className="fees-summary-line">Pay by bank transfer into each child&apos;s own account number. Tap Pay beside a bill, or choose Show account numbers below.</p>}
      {credit > 0 && <p className="fees-summary-credit">{due > 0
        ? `${formatNaira(credit)} credit held by the school. Ask the school to apply it before you pay.`
        : `${formatNaira(credit)} in credit.`}</p>}
      {canPayAll && (offline
        ? <p className="fees-summary-offline">You can pay when you&apos;re back online.</p>
        : <>
          <Link to="/fees/pay-all" onClick={clearPayAllQueue} className="fees-summary-pay"><CreditCard size={18} aria-hidden="true" /> Pay all balances</Link>
          <small className="fees-summary-steps">{payAll.steps.length} {payAll.steps.length === 1 ? "payment" : "payments"}, confirmed one at a time</small>
        </>)}
    </section>
  );
}

function ChildFeesRow({ entry, offline, cardOn, onShowTransfer }: { entry: ChildFeesEntry; offline: boolean; cardOn: boolean; onShowTransfer: () => void }) {
  const [open, setOpen] = useState(false);
  const panelId = `fees-child-bills-${entry.child.id}`;
  if (!entry.available) {
    return <article className="screen-card fees-simple-child"><div className="fees-child-summary-row">
      <div className="fees-child-identity"><ChildAvatar name={entry.child.full_name} childId={entry.child.id} size={44} />
        <div><strong>{entry.child.first_name}</strong><small>Fees unavailable</small></div></div>
    </div><p className="fees-child-unavailable">{entry.message}</p></article>;
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
    <article className="screen-card fees-simple-child">
      <div className="fees-child-summary-row">
        <div className="fees-child-identity">
          <ChildAvatar name={entry.child.full_name} childId={entry.child.id} size={44} />
          <div><strong>{entry.child.first_name}</strong><small>{countLine}</small></div>
        </div>
        {(hasBills || entry.credit > 0) && <div className={cn("fees-child-balance", entry.owing <= 0 && "is-clear")}>
          <strong>{entry.owing > 0 ? formatNaira(entry.owing) : entry.credit > 0 ? "In credit" : "All paid"}</strong>
          <small>{status}</small>
        </div>}
      </div>
      {entry.owing > 0 && entry.credit > 0 && <p className="fees-child-credit-note">
        {formatNaira(entry.credit)} credit held by the school. Ask the school to apply it before you pay.
      </p>}
      {hasBills && <div className="fees-child-actions">
        {oneUnpaid && !offline && <Link className="fees-child-pay" to={`/fees/pay/${oneUnpaid.invoice_ref}`} aria-label={`Pay ${entry.child.first_name}'s bill`}>Pay</Link>}
        <button type="button" className="fees-child-bills-button" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen((value) => !value)}>
          {toggleLabel}<ChevronDown size={15} aria-hidden="true" />
        </button>
      </div>}
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
    <div className="fees-bill-links">
      <Link to={`/fees/invoices/${invoice.invoice_ref}`}>View bill</Link>
      {invoice.balance > 0
        ? !offline && <Link to={`/fees/pay/${invoice.invoice_ref}`}>Pay bill</Link>
        : <span className="fees-bill-paid"><Check size={14} aria-hidden="true" />Paid</span>}
    </div>
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
        ? <span className="fees-bill-paid"><Check size={14} aria-hidden="true" />Paid</span>
        : <button type="button" className="fees-charge-transfer" onClick={onShowTransfer}>Pay by transfer</button>}
    </div>
    {charge.balance > 0 && <p className="fees-charge-note">
      {cardOn
        ? <>Pay this charge by bank transfer into {firstName}&apos;s account number. It can&apos;t be paid by card.</>
        : <>Pay this charge by bank transfer into {firstName}&apos;s account number. Choose Pay by transfer to see it.</>}
    </p>}
  </li>;
}

/** A row of the Payment history and account numbers card: an icon tile, its words, and a chevron that turns when open. */
function DisclosureButton({ icon, tone, title, description, open, onClick, controls }: {
  icon: ReactNode; tone?: "good"; title: string; description: string; open: boolean; onClick: () => void; controls: string;
}) {
  return <button type="button" className="fees-more-button" aria-expanded={open} aria-controls={controls} onClick={onClick}>
    <span className={cn("icon-tile", tone === "good" && "icon-tile--good")}>{icon}</span>
    <span className="fees-more-text"><strong>{title}</strong><small>{description}</small></span>
    <ChevronDown className="fees-more-chevron" size={18} aria-hidden="true" />
  </button>;
}

/** One payment: a tick or a clock, the amount, whose and when, and the receipt once there is one. */
function PaymentRow({ payment }: { payment: Payment }) {
  const confirmed = payment.status === "CONFIRMED";
  const by = payment.payer_name ? `by ${payment.payer_name}` : payment.source_label || "";
  const method = confirmed ? payment.method_label : "Waiting for confirmation";
  const parts = [payment.child.first_name, payment.paid_on ? formatDate(payment.paid_on) : null, method, by].filter(Boolean);
  return <li className="fees-payment">
    <span className={cn("fees-payment-icon", !confirmed && "is-pending")}>
      {confirmed ? <Check size={15} aria-hidden="true" /> : <Clock3 size={15} aria-hidden="true" />}
    </span>
    <div className="fees-payment-main"><strong>{formatNaira(payment.amount)}</strong><span>{parts.join(" · ")}</span></div>
    {payment.has_receipt && payment.payment_ref
      ? <Link className="fees-payment-receipt" to={`/fees/receipts/${payment.payment_ref}`}><ReceiptIcon size={13} aria-hidden="true" />Receipt</Link>
      : <small className="fees-payment-none">No receipt yet</small>}
  </li>;
}
