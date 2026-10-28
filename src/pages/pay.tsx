import { useEffect, useState } from "react";
import { Building2, Check, CreditCard, Lock } from "lucide-react";
import { useParams, useSearchParams } from "react-router";

import { ChildAvatar } from "@/components/child-avatar";
import { ChildTransferAccount } from "@/components/fees/child-transfer-account";
import { PageShell } from "@/components/layout/page-shell";
import { BottomBar, DetailBar } from "@/components/layout/screen";
import { Button } from "@/components/ui/button";
import { formatDate, formatNaira, parseNaira } from "@/lib/format";
import { cn } from "@/lib/utils";
import { openCheckout } from "@/native/checkout";
import { isNativeApp } from "@/native/platform";
import { StepAvatar, StepPill } from "@/pages/pay-all";
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
  type PayAllStep,
} from "@/redux/services/portal-api";

import "./fees.css";
import "./pay.css";

/**
 * Pay one invoice (design 1m), a screen of its own over Fees with a back bar.
 *
 * The bill in a blue card, with the child's avatar and name over it. Where
 * the school takes cards the parent picks Card or Bank transfer: by card,
 * how much (in full or part) with what is left after, and "Continue to
 * secure payment" in the bar at the foot; by transfer, the child's account
 * number large, with the transfer arriving on this screen. Where families
 * pay by transfer alone there is no choice, only the number. A Pay all step
 * (`?pay-all=1`, design 1n) charges the queued amount and offers no choice
 * either: the bar shows which step of how many, the next bill waits under
 * the amount, and the way back is to the Pay all list, not Fees.
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
  const firstName = sheet?.child.first_name ?? childEntry?.child.first_name ?? "";

  return (
    <PageShell className="pay-page">
      {isPayAllStep && queue ? (
        <DetailBar title="Pay a bill" back="/fees/pay-all" backLabel="Back to Pay all balances" action={<StepPill index={queue.index} count={queue.steps.length} />} />
      ) : (
        <DetailBar title="Pay a bill" back="/fees" backLabel="Back to Fees" />
      )}
      <div className="pay-wrap">
        {isPayAllStep && queue && (
          <div className="pay-step-bar" aria-hidden="true">
            {queue.steps.map((item, index) => <span key={item.invoice_ref} className={index <= queue.index ? "is-done" : undefined} />)}
          </div>
        )}
        {isLoading && !fees && <div className="pay-loading" role="status" aria-label="Loading bill" />}
        {fees && !invoice && <Note>This bill isn&apos;t on your family&apos;s account.</Note>}
        {fees && invoice && childEntry && (
          <div className="pay-layout">
            <div className="pay-overview">
              <section className="pay-bill" aria-label="Selected bill">
                <div className="screen-orb" aria-hidden="true" />
                <span className="pay-bill-label">
                  <ChildAvatar name={childEntry.child.full_name} childId={childEntry.child.id} size={24} />
                  Selected bill · {firstName}
                </span>
                <h2>{invoice.title}</h2>
                {invoice.number && <p>{invoice.number}</p>}
                <strong>{formatNaira(Math.max(0, invalidQueue ? invoice.balance : queuedAmount ?? invoice.balance))}</strong>
                <div className="pay-bill-chips">
                  <span>{queuedAmount && !invalidQueue ? "This payment step" : invoice.balance > 0 ? "Balance to pay" : "Fully paid"}</span>
                  {queuedAmount && !invalidQueue && queuedAmount < invoice.balance && <span>Bill balance {formatNaira(invoice.balance)}</span>}
                  {invoice.due_date && invoice.balance > 0 && <span>Due {formatDate(invoice.due_date)}</span>}
                </div>
              </section>
              {cardOn && <p className="pay-help">{isPayAllStep
                ? "Pay all uses a separate secure checkout for each bill. You can review each amount before paying."
                : <>Card details go on the secure gateway page, never in this app. A transfer goes into {firstName}&apos;s own account number.</>}</p>}
            </div>
            <div className="pay-detail">
              {!cardOn ? (
                <div className="pay-transfer">
                  <div className="screen-section pay-section-heading"><h2>Pay by bank transfer</h2></div>
                  {cardRefused && (
                    <p className="pay-card-off" role="status">
                      Card payments aren&apos;t available at this school. Pay by bank transfer into {firstName}&apos;s account number instead.
                    </p>
                  )}
                  {invoice.balance <= 0 && <Note>This bill is fully paid. Thank you.</Note>}
                  <ChildTransferAccount
                    childId={childEntry.child.id}
                    firstName={childEntry.child.first_name}
                    fullName={childEntry.child.full_name}
                    title={`Pay into ${childEntry.child.first_name}'s account`}
                    showAccount={invoice.balance > 0}
                    layout="lead"
                    waiting
                  />
                  {invoice.balance > 0 && <p className="pay-transfer-note">{TRANSFER_NOTE}</p>}
                </div>
              ) : invalidQueue ? (
                <Note>This payment step has changed. Return to Fees and start Pay all balances again.</Note>
              ) : invoice.balance <= 0 ? (
                <Note>This bill is fully paid. Thank you.</Note>
              ) : offline ? (
                <Note>You&apos;re offline. You can pay when you&apos;re back online.</Note>
              ) : (
                <>
                  {!isPayAllStep && <>
                    <div className="screen-section pay-section-heading"><h2>How would you like to pay?</h2></div>
                    <div className="pay-methods" role="radiogroup" aria-label="How would you like to pay?">
                      <MethodButton active={method === "card"} onClick={() => setMethod("card")} icon={<CreditCard size={19} />} label="Card" description="Secure checkout" />
                      <MethodButton active={method === "transfer"} onClick={() => setMethod("transfer")} icon={<Building2 size={19} />} label="Bank transfer" description="Into the child's own account" />
                    </div>
                  </>}
                  {isPayAllStep || method === "card" ? (
                    <CardPayment fees={fees} invoice={invoice} queuedAmount={queuedAmount} next={isPayAllStep ? queue?.steps[queue.index + 1] : undefined} onCardOff={() => setCardRefused(true)} />
                  ) : (
                    <div className="pay-transfer">
                      <div className="screen-section pay-section-heading"><h2>Pay into {childEntry.child.first_name}&apos;s account</h2></div>
                      <ChildTransferAccount
                        childId={childEntry.child.id}
                        firstName={childEntry.child.first_name}
                        fullName={childEntry.child.full_name}
                        title={`Pay into ${childEntry.child.first_name}'s account`}
                        layout="lead"
                        waiting
                      />
                      <p className="pay-transfer-note">{TRANSFER_NOTE}</p>
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

const TRANSFER_NOTE =
  "Transfer any amount from a bank app. There is no card-payment minimum for a bank transfer. Anything over what is owed waits as credit for the next bill.";

function Note({ children }: { children: React.ReactNode }) {
  return <div className="screen-card pay-note">{children}</div>;
}

/** A way to pay, as a tile: the chosen one ringed in blue with a tick in its corner. */
function MethodButton({ active, onClick, icon, label, description }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string; description?: string }) {
  return (
    <button type="button" role="radio" aria-checked={active} onClick={onClick} className={cn("pay-method", active && "is-active")}>
      {active && <span className="pay-method-tick" aria-hidden="true"><Check size={12} /></span>}
      <span className="pay-method-icon">{icon}</span>
      <strong>{label}</strong>
      {description && <small>{description}</small>}
    </button>
  );
}

/** How much, as a row with a round radio: the amount or a word on the right. */
function AmountOption({ active, onClick, label, aside }: { active: boolean; onClick: () => void; label: string; aside: string }) {
  return (
    <button type="button" role="radio" aria-checked={active} onClick={onClick} className={cn("pay-amount-option", active && "is-active")}>
      <span className="pay-radio" aria-hidden="true" />
      <strong>{label}</strong>
      <span className="pay-amount-aside">{aside}</span>
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

function CardPayment({ fees, invoice, queuedAmount, next, onCardOff }: {
  fees: FamilyFeesData; invoice: Invoice; queuedAmount?: number; next?: PayAllStep; onCardOff: () => void;
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
    <section className="pay-card-panel" aria-label="Card payment">
      <div className="screen-section"><h2>{queuedAmount ? "This payment step" : "How much to pay?"}</h2></div>
      {queuedAmount ? null : (
        <div className="screen-card pay-amount-options" role="radiogroup" aria-label="How much">
          <AmountOption active={mode === "full"} onClick={() => { setMode("full"); setError(""); }} label="Pay in full" aside={formatNaira(invoice.balance)} />
          <AmountOption active={mode === "part"} onClick={() => { setMode("part"); setError(""); }} label="Part payment" aside="Choose an amount" />
          {mode === "part" && (
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
              <small id="pay-minimum">At least {formatNaira(fees.min_part_payment)} for a part payment, or pay the full balance.</small>
            </label>
          )}
        </div>
      )}
      <div className="screen-card pay-review">
        {queuedAmount && <p className="pay-panel-intro">The amount for this step is {formatNaira(queuedAmount)}.</p>}
        <dl>
          <div><dt>You&apos;ll pay</dt><dd>{amount ? formatNaira(amount) : "–"}</dd></div>
          <div><dt>Left to pay after</dt><dd>{amount && amount <= invoice.balance ? formatNaira(Math.max(0, invoice.balance - amount)) : "–"}</dd></div>
        </dl>
      </div>
      {error && <p className="pay-error" role="alert">{error}</p>}
      {next && (
        <div className="pay-next" aria-label="Next bill">
          <span className="pay-next-label">Next</span>
          <StepAvatar step={next} size={26} />
          <span className="pay-next-name">{next.first_name}{next.title ? ` · ${next.title}` : ""}</span>
          <span className="pay-next-amount">{formatNaira(next.amount)}</span>
        </div>
      )}
      <p className="pay-secure">
        <Lock size={14} aria-hidden="true" />
        Card details go on the secure gateway page, never in this app. The gateway may offer other methods there.
      </p>
      <BottomBar>
        <Button className="xs-button pay-primary-action" onClick={go} loading={isLoading} disabled={isLoading}>
          <Lock size={17} aria-hidden="true" />
          Continue to secure payment
        </Button>
      </BottomBar>
    </section>
  );
}
