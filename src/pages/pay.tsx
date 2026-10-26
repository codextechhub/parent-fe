import { useEffect, useState } from "react";
import { ArrowLeft, Building2, CreditCard, Lock } from "lucide-react";
import { Link, useParams, useSearchParams } from "react-router";

import { ChildTransferAccount } from "@/components/fees/child-transfer-account";
import { SAVED_NUMBER_HINT } from "@/components/fees/transfer-account-card";
import { PageShell } from "@/components/layout/page-shell";
import { Button } from "@/components/ui/button";
import { formatDate, formatNaira, parseNaira } from "@/lib/format";
import { cn } from "@/lib/utils";
import { openCheckout } from "@/native/checkout";
import { isNativeApp } from "@/native/platform";
import { clearPayAllQueue, readPayAllQueue } from "@/pages/pay-all-queue";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import { baseApi } from "@/redux/services/base-api";
import {
  CARD_PAYMENTS_OFF,
  cardPaymentsOn,
  refusal,
  refusalCode,
  useFamilyFeesQuery,
  useInvoiceSheetQuery,
  useStartPaymentMutation,
  type ChildFeesEntry,
  type FamilyFeesData,
  type Invoice,
} from "@/redux/services/portal-api";

import "./fees.css";
import "./pay.css";

/**
 * Pay one invoice. Where the school takes cards it is by card or by bank
 * transfer into the child's own account; where families pay by transfer alone
 * it is the child's account, with the transfer arriving on this screen.
 */
export function PayPage() {
  const { invoiceRef } = useParams();
  const [searchParams] = useSearchParams();
  const ref = Number(invoiceRef);
  const { data: fees, isLoading } = useFamilyFeesQuery();
  const { data: sheet } = useInvoiceSheetQuery(ref, { skip: !Number.isSafeInteger(ref) || ref <= 0 });
  const offline = useAppSelector((s) => s.connectivity.offline);
  const [method, setMethod] = useState<"card" | "transfer">("card");
  // Set when the server refuses a card checkout because this school's families pay by transfer.
  const [cardRefused, setCardRefused] = useState(false);
  const cardOn = cardPaymentsOn(fees) && !cardRefused;
  const { invoice, childEntry } = findInvoice(fees, ref);
  const isPayAllStep = cardOn && searchParams.get("pay-all") === "1";
  useEffect(() => {
    if (!cardOn) clearPayAllQueue();
  }, [cardOn]);
  const queue = isPayAllStep ? readPayAllQueue() : null;
  const currentStep = queue?.steps[queue.index];
  const queueStep = currentStep?.invoice_ref === ref ? currentStep : undefined;
  const queuedAmount = queueStep?.amount;
  const invalidQueue = isPayAllStep && (!queuedAmount || !invoice || queuedAmount > invoice.balance);

  return (
    <PageShell className="pay-page">
      <div className="pay-wrap">
        <h1 className="sr-only">Pay a bill</h1>
        <Link to="/fees" className="pay-back" onClick={isPayAllStep ? clearPayAllQueue : undefined}>
          <ArrowLeft size={17} aria-hidden="true" />
          Fees
        </Link>
        {isLoading && !fees && <div className="pay-loading" role="status" aria-label="Loading bill" />}
        {fees && !invoice && <Note>This bill isn&apos;t on your family&apos;s account.</Note>}
        {fees && invoice && childEntry && (
          <div className="pay-layout">
            <div className="pay-overview">
              <section className="pay-bill" aria-label="Selected bill">
                <span className="pay-bill-label">
                  Selected bill · {sheet?.child.first_name ?? childEntry.child.first_name}
                </span>
                <h2>{invoice.title}</h2>
                {invoice.number && <p>{invoice.number}</p>}
                <strong>{formatNaira(Math.max(0, invalidQueue ? invoice.balance : queuedAmount ?? invoice.balance))}</strong>
                <div className="pay-bill-chips">
                  <span>{queuedAmount && !invalidQueue ? "This payment step" : invoice.balance > 0 ? "Balance to pay" : "Fully paid"}</span>
                  {queuedAmount && !invalidQueue && queuedAmount < invoice.balance && <span>Bill balance {formatNaira(invoice.balance)}</span>}
                  {invoice.due_date && invoice.balance > 0 && (
                    <span>Due {formatDate(invoice.due_date)}</span>
                  )}
                </div>
              </section>
              {cardOn && <p className="pay-help">{isPayAllStep
                ? "Pay all uses a separate secure checkout for each bill. You can review each amount before paying."
                : <>Card details go on the secure gateway page, never in this app. A transfer goes into {childEntry.child.first_name}&apos;s own account number.</>}</p>}
            </div>
            <div className="pay-detail">
              {!cardOn ? (
                <div className="pay-transfer">
                  <div className="pay-section-heading"><h2>Pay by bank transfer</h2></div>
                  {cardRefused && (
                    <p className="fees-transfer-switched" role="status">
                      Card payments aren&apos;t available at this school. Pay by bank transfer into{" "}
                      {childEntry.child.first_name}&apos;s account number instead.
                    </p>
                  )}
                  {invoice.balance <= 0 && <Note>This bill is fully paid. Thank you.</Note>}
                  <ChildTransferAccount
                    childId={childEntry.child.id}
                    firstName={childEntry.child.first_name}
                    fullName={childEntry.child.full_name}
                    owing={childEntry.owing}
                    title={`Pay into ${childEntry.child.first_name}'s account`}
                    showAccount={invoice.balance > 0}
                    waiting
                  />
                </div>
              ) : invalidQueue ? (
                <Note>This payment step has changed. Return to Fees and start Pay all balances again.</Note>
              ) : invoice.balance <= 0 ? (
                <Note>This bill is fully paid. Thank you.</Note>
              ) : offline ? (
                <Note>You&apos;re offline. You can pay when you&apos;re back online.</Note>
              ) : (
                <>
                  {!isPayAllStep && <><div className="pay-section-heading">
                    <h2>How would you like to pay?</h2>
                  </div>
                  <div className="pay-methods" role="radiogroup" aria-label="How would you like to pay?">
                    <MethodButton active={method === "card"} onClick={() => setMethod("card")} icon={<CreditCard size={19} />} label="Card" description="Secure checkout" />
                    <MethodButton active={method === "transfer"} onClick={() => setMethod("transfer")} icon={<Building2 size={19} />} label="Bank transfer" description="Into the child's own account" />
                  </div></>}
                  {isPayAllStep || method === "card" ? (
                    <CardPayment fees={fees} invoice={invoice} queuedAmount={queuedAmount} onCardOff={() => setCardRefused(true)} />
                  ) : (
                    <div className="pay-transfer">
                      <ChildTransferAccount
                        childId={childEntry.child.id}
                        firstName={childEntry.child.first_name}
                        fullName={childEntry.child.full_name}
                        title={`Pay into ${childEntry.child.first_name}'s account`}
                        hint={SAVED_NUMBER_HINT}
                        waiting
                      />
                      <p className="pay-transfer-note">
                        Transfer any amount from a bank app. There is no card-payment minimum for a
                        bank transfer. Anything over what is owed waits as credit for the next bill.
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </PageShell>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return <div className="pay-note">{children}</div>;
}

function MethodButton({
  active,
  onClick,
  icon,
  label,
  description,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  description?: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className={cn("pay-method", active && "is-active")}
    >
      <span className="pay-method-icon">{icon}</span>
      <span>
        <strong>{label}</strong>
        {description && <small>{description}</small>}
      </span>
    </button>
  );
}

function findInvoice(fees: FamilyFeesData | undefined, ref: number): {
  invoice?: Invoice;
  childEntry?: Extract<ChildFeesEntry, { available: true }>;
} {
  if (!fees) return {};
  for (const entry of fees.children) {
    if (!entry.available) continue;
    const found = entry.invoices.find((inv) => inv.invoice_ref === ref);
    if (found) return { invoice: found, childEntry: entry };
  }
  return {};
}

function CardPayment({ fees, invoice, queuedAmount, onCardOff }: {
  fees: FamilyFeesData; invoice: Invoice; queuedAmount?: number; onCardOff: () => void;
}) {
  const dispatch = useAppDispatch();
  const [mode, setMode] = useState<"full" | "part">("full");
  const [typed, setTyped] = useState("");
  const [error, setError] = useState("");
  const [start, { isLoading }] = useStartPaymentMutation();
  const partKobo = parseNaira(typed);
  const amount = queuedAmount ?? (mode === "full" ? invoice.balance : partKobo);

  const problem = (): string => {
    if (queuedAmount) return "";
    if (mode === "full") return "";
    if (!typed.trim()) return "Enter an amount.";
    if (partKobo === null) return "Enter an amount in naira, such as 20,000.";
    if (partKobo > invoice.balance)
      return `You can pay at most the balance, ${formatNaira(invoice.balance)}.`;
    if (partKobo < invoice.balance && partKobo < fees.min_part_payment)
      return `The smallest part payment this school accepts is ${formatNaira(fees.min_part_payment)}.`;
    return "";
  };

  const go = async () => {
    const found = problem();
    if (found || !amount) return setError(found || "Enter an amount.");
    setError("");
    try {
      const checkout = await start({ invoiceRef: invoice.invoice_ref, amount }).unwrap();
      if (!isNativeApp()) {
        window.location.assign(checkout.checkout_url);
        return;
      }
      // The store app opens the checkout in the phone's in-app browser and keeps the app where it is.
      try {
        await openCheckout(checkout.checkout_url, checkout.reference);
      } catch {
        setError("The payment page couldn't be opened. Try again.");
      }
    } catch (failure) {
      if (refusalCode(failure) === CARD_PAYMENTS_OFF) {
        // A stale screen: read the fees again, which now say card is off, and show the transfer view.
        dispatch(baseApi.util.invalidateTags(["Fees"]));
        clearPayAllQueue();
        return onCardOff();
      }
      setError(refusal(failure).message);
    }
  };

  return (
    <section className="pay-card-panel">
      <h3>{queuedAmount ? "This payment step" : "How much to pay?"}</h3>
      {queuedAmount ? <p className="pay-panel-intro">The amount for this step is {formatNaira(queuedAmount)}.</p> : <div className="pay-amount-options" role="radiogroup" aria-label="How much">
        <MethodButton
          active={mode === "full"}
          onClick={() => {
            setMode("full");
            setError("");
          }}
          icon={<span className="pay-amount-icon">{formatNaira(invoice.balance)}</span>}
          label="Pay in full"
        />
        <MethodButton
          active={mode === "part"}
          onClick={() => {
            setMode("part");
            setError("");
          }}
          icon={<span className="pay-amount-icon">Choose an amount</span>}
          label="Part payment"
        />
      </div>}
      {!queuedAmount && mode === "part" && (
        <label className="pay-amount-label">
          Amount to pay
          <div className="pay-amount-field">
            <span>₦</span>
            <input
              inputMode="decimal"
              placeholder="e.g. 5,000"
              value={typed}
              onChange={(event) => {
                setTyped(event.target.value);
                setError("");
              }}
              aria-invalid={!!error}
              aria-describedby="pay-minimum"
            />
          </div>
          <small id="pay-minimum">
            At least {formatNaira(fees.min_part_payment)} for a part payment, or pay the full
            balance.
          </small>
        </label>
      )}
      <dl className="pay-review">
        <div>
          <dt>You&apos;ll pay</dt>
          <dd>{amount ? formatNaira(amount) : "–"}</dd>
        </div>
        <div>
          <dt>Left to pay after</dt>
          <dd>
            {amount && amount <= invoice.balance
              ? formatNaira(Math.max(0, invoice.balance - amount))
              : "–"}
          </dd>
        </div>
      </dl>
      {error && (
        <p className="pay-error" role="alert">
          {error}
        </p>
      )}
      <Button
        className="pay-primary-action"
        onClick={go}
        loading={isLoading}
        disabled={isLoading}
      >
        <Lock size={17} aria-hidden="true" />
        Continue to secure payment
      </Button>
      <p className="pay-secure">
        <Lock size={15} aria-hidden="true" />
        Card details go on the secure gateway page, never in this app. The gateway may offer
        other methods there.
      </p>
    </section>
  );
}
