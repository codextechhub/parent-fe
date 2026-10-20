import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Building2, CreditCard, Lock } from "lucide-react";
import { Link, useParams, useSearchParams } from "react-router";

import { GetTransferAccount } from "@/components/fees/get-transfer-account";
import { TransferAccountCard } from "@/components/fees/transfer-account-card";
import { PageShell } from "@/components/layout/page-shell";
import { Button } from "@/components/ui/button";
import { formatDate, formatNaira, parseNaira } from "@/lib/format";
import { cn } from "@/lib/utils";
import { clearPayAllQueue, readPayAllQueue } from "@/pages/pay-all-queue";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import { baseApi } from "@/redux/services/base-api";
import {
  refusal,
  useChildDepositsQuery,
  useChildTransferAccountQuery,
  useFamilyFeesQuery,
  useInvoiceSheetQuery,
  useStartPaymentMutation,
  type ChildFeesEntry,
  type FamilyFeesData,
  type Invoice,
} from "@/redux/services/portal-api";

import "./fees.css";
import "./pay.css";

/** Pay one invoice, by card or by bank transfer into the child's own account. */
export function PayPage() {
  const { invoiceRef } = useParams();
  const [searchParams] = useSearchParams();
  const ref = Number(invoiceRef);
  const { data: fees, isLoading } = useFamilyFeesQuery();
  const { data: sheet } = useInvoiceSheetQuery(ref, { skip: !Number.isSafeInteger(ref) || ref <= 0 });
  const offline = useAppSelector((s) => s.connectivity.offline);
  const [method, setMethod] = useState<"card" | "transfer">("card");
  const { invoice, childEntry } = findInvoice(fees, ref);
  const isPayAllStep = searchParams.get("pay-all") === "1";
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
              <p className="pay-help">{isPayAllStep
                ? "Pay all uses a separate secure checkout for each bill. You can review each amount before paying."
                : <>Card details go on the secure gateway page, never in this app. A transfer goes into {childEntry.child.first_name}&apos;s own account number.</>}</p>
            </div>
            <div className="pay-detail">
              {invalidQueue ? (
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
                    <CardPayment fees={fees} invoice={invoice} queuedAmount={queuedAmount} />
                  ) : (
                    <TransferPayment childId={childEntry.child.id} firstName={childEntry.child.first_name} />
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

function CardPayment({ fees, invoice, queuedAmount }: { fees: FamilyFeesData; invoice: Invoice; queuedAmount?: number }) {
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
      window.location.assign(checkout.checkout_url);
    } catch (failure) {
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

/** How often the transfer panel asks whether a deposit has arrived. */
const WATCH_EVERY_MS = 5_000;

function TransferPayment({ childId, firstName }: { childId: number; firstName: string }) {
  const { data: account, isLoading, isError, error } = useChildTransferAccountQuery(childId);
  if (isLoading) return <div className="pay-loading" role="status" aria-label="Loading transfer account" />;
  if (isError || !account)
    return <Note>{refusal(error).message || "The account number can't be shown right now."}</Note>;
  if (account.state === "UNAVAILABLE") return <Note>{account.message}</Note>;
  if (account.state === "NONE") return <GetTransferAccount childId={childId} firstName={firstName} />;
  return (
    <div className="pay-transfer">
      <TransferAccountCard account={account} childName={firstName} title={`Pay into ${firstName}'s account`} />
      <p className="pay-transfer-note">
        Transfer any amount from a bank app. There is no card-payment minimum for a bank
        transfer. Anything over what is owed waits as credit for the next bill.
      </p>
      <DepositWatch childId={childId} since={account.as_of} firstName={firstName} />
    </div>
  );
}

function DepositWatch({ childId, since, firstName }: { childId: number; since: string; firstName: string }) {
  const dispatch = useAppDispatch();
  const { data } = useChildDepositsQuery(
    { childId, since },
    { pollingInterval: WATCH_EVERY_MS, skipPollingIfUnfocused: true, refetchOnFocus: true },
  );
  const deposits = data?.deposits ?? [];
  const confirmed = deposits.filter((deposit) => deposit.status === "CONFIRMED").length;
  const seen = useRef(0);
  useEffect(() => {
    if (confirmed > seen.current) {
      seen.current = confirmed;
      dispatch(baseApi.util.invalidateTags(["Fees", "Me", "Payments"]));
    }
  }, [confirmed, dispatch]);
  return (
    <section className="pay-watch" aria-label="Transfer activity">
      <h3>{firstName}&apos;s transfers</h3>
      {deposits.length === 0 ? (
        <p className="pay-watch-message" role="status">
          Waiting for the transfer. Keep this page open to see it arrive.
        </p>
      ) : (
        <ul role="status">
          {deposits.map((deposit) => (
            <li
              key={deposit.reference}
              className={cn(
                "pay-watch-message",
                deposit.status === "CONFIRMED" ? "is-received" : "is-pending",
              )}
            >
              {formatNaira(deposit.amount)}{" "}
              {deposit.status === "CONFIRMED"
                ? "received. Thank you."
                : "on its way. Waiting for the bank to confirm."}
              {deposit.has_receipt && deposit.payment_ref && (
                <Link to={`/fees/receipts/${deposit.payment_ref}`}>View receipt</Link>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
