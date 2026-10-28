import { useEffect, useState, type ReactNode } from "react";
import { ArrowRight, Check, CircleAlert, Clock3, ReceiptText, X } from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router";

import { PageShell } from "@/components/layout/page-shell";
import { BottomBar, DetailBar } from "@/components/layout/screen";
import { formatNaira, formatTimestampDate } from "@/lib/format";
import { useAppDispatch } from "@/redux/hooks";
import { baseApi } from "@/redux/services/base-api";
import {
  useFamilyFeesQuery,
  useFamilyPaymentsQuery,
  usePaymentStatusQuery,
  type FamilyFeesData,
  type PaymentStatus,
} from "@/redux/services/portal-api";
import { StepAvatar } from "@/pages/pay-all";
import {
  advancePayAllQueue,
  readPayAllQueue,
  clearPayAllQueue,
} from "@/pages/pay-all-queue";

import "./paid.css";

const POLL_EVERY_MS = 3_000;
const GIVE_UP_AFTER_MS = 3 * 60_000;

type Detail = { label: string; value: string; emphasis?: "money" | "positive" };
type Tone = "confirmed" | "pending" | "failed" | "neutral";
type Outcome = {
  chip: string;
  icon: ReactNode;
  title: string;
  text: string;
  tone: Tone;
  amount?: string;
  details: Detail[];
  note: string;
  hint: string;
};

/**
 * Where card checkout comes back to (designs 1o, 1i, 1q, 1r, 1s, 1u).
 *
 * `?reference=` names the payment the gateway just handled. We poll the
 * public collection status route until it settles, and say nothing was
 * received until the server says so. The colour follows the outcome: amber
 * while confirming, green once confirmed, red when not completed, grey when
 * the status could not be read.
 *
 * A confirmed payment is a screen of its own with no bar on top: the amount,
 * whose bill it was, when and how it was paid, what that child still owes,
 * and the receipt once it is ready. In a Pay all run the next bill waits at
 * the foot with Continue to it; a step that did not go through offers Try
 * again, Skip or Back to Fees.
 */
export function PaidPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const reference = params.get("reference") || params.get("trxref") || "";
  const dispatch = useAppDispatch();
  const [gaveUp, setGaveUp] = useState(false);
  const [settled, setSettled] = useState(false);
  const queue = readPayAllQueue();
  const stillAsking = !settled && !gaveUp;
  const { data: status, isError, refetch } = usePaymentStatusQuery(reference, {
    skip: !reference,
    pollingInterval: stillAsking ? POLL_EVERY_MS : 0,
    refetchOnFocus: true,
  });
  const done =
    status?.status === "CONFIRMED" || status?.status === "FAILED" || status?.status === "ABANDONED";
  if (done && !settled) setSettled(true);
  const confirmed = status?.status === "CONFIRMED";
  const { data: payments } = useFamilyPaymentsQuery(undefined, { skip: !confirmed });
  const { data: fees } = useFamilyFeesQuery(undefined, { skip: !confirmed });
  const matchingPayment = payments?.find((payment) => payment.reference === reference);
  const receiptRef = matchingPayment?.has_receipt ? matchingPayment.payment_ref ?? null : null;
  const step = queue?.steps[queue.index];
  const childName = step?.first_name ?? matchingPayment?.child.first_name;

  useEffect(() => {
    const stop = window.setTimeout(() => setGaveUp(true), GIVE_UP_AFTER_MS);
    return () => window.clearTimeout(stop);
  }, [reference]);
  useEffect(() => {
    if (status?.status === "CONFIRMED")
      dispatch(baseApi.util.invalidateTags(["Fees", "Me", "Payments"]));
  }, [status?.status, dispatch]);
  useEffect(() => {
    if (status?.status !== "CONFIRMED" || receiptRef) return;
    const again = window.setInterval(
      () => dispatch(baseApi.util.invalidateTags(["Payments"])),
      POLL_EVERY_MS,
    );
    return () => window.clearInterval(again);
  }, [status?.status, receiptRef, dispatch]);

  const continueQueue = () => {
    const next = advancePayAllQueue();
    if (next) navigate(`/fees/pay/${next.invoice_ref}?pay-all=1`);
    else navigate("/fees");
  };

  const skipStep = () => {
    const next = advancePayAllQueue();
    if (next) navigate(`/fees/pay/${next.invoice_ref}?pay-all=1`);
    else {
      clearPayAllQueue();
      navigate("/fees");
    }
  };

  if (status && confirmed) {
    const next = queue?.steps[queue.index + 1];
    const childId = step?.child_id ?? matchingPayment?.child.id;
    return (
      <PageShell className="paid-page is-confirmed">
        <h1 className="sr-only">Payment update</h1>
        <div className="paid-wrap">
          <section className="paid-cover is-confirmed" aria-labelledby="paid-outcome-title" role="status">
            <span className="paid-cover-icon" aria-hidden="true"><Check size={40} strokeWidth={2.5} /></span>
            <h2 id="paid-outcome-title" className="paid-confirmed-label">Payment confirmed</h2>
            <strong className="paid-confirmed-amount">{status.amount_naira}</strong>
            <p className="paid-cover-text">
              {[childName, step?.title || matchingPayment?.invoice_number].filter(Boolean).join(" · ") || `Paid to ${status.payee_name}`}
            </p>
          </section>
          <section className="screen-card paid-card" aria-label="Payment details">
            <dl className="paid-details">
              {status.paid_at && <Row label="Paid on" value={paidAt(status.paid_at)} />}
              <Row label="Method" value={matchingPayment?.method_label || "Card"} />
              <Row label="Reference" value={reference} />
              <BalanceRow fees={fees} childId={childId} childName={childName} />
            </dl>
          </section>
          {receiptRef ? (
            <Link to={"/fees/receipts/" + receiptRef} className="paid-receipt-link"><ReceiptText size={17} aria-hidden="true" />View receipt</Link>
          ) : (
            <p className="paid-receipt-wait">The receipt is being prepared. It will appear in Fees when ready.</p>
          )}
        </div>
        <BottomBar>
          <div className="paid-actions">
            {next && queue && (
              <div className="paid-next" aria-label="Next bill">
                <StepAvatar step={next} size={32} />
                <span className="paid-next-text">
                  <span>Next · Step {queue.index + 2} of {queue.steps.length}</span>
                  <strong>{next.first_name}{next.title ? ` · ${next.title}` : ""}</strong>
                </span>
                <strong className="paid-next-amount">{formatNaira(next.amount)}</strong>
              </div>
            )}
            {queue ? (
              <button type="button" className="xs-button" onClick={continueQueue}>
                {next ? <>Continue to {next.first_name}&apos;s bill <ArrowRight size={18} aria-hidden="true" /></> : "Back to Fees"}
              </button>
            ) : (
              <Link to="/fees" className="xs-button">Back to Fees</Link>
            )}
          </div>
        </BottomBar>
      </PageShell>
    );
  }

  const outcome = describeOutcome({ reference, status, gaveUp, isError: !!isError, childName });
  const checkAgain = isError && !status && !!reference;
  const failed = outcome.tone === "failed";

  return (
    <PageShell className={"paid-page is-" + outcome.tone}>
      <DetailBar
        title={"Payment update" + (queue ? ` · Step ${queue.index + 1} of ${queue.steps.length}` : "")}
        back="/fees"
        backLabel="Back to Fees"
        action={<span className={"paid-status-chip is-" + outcome.tone}>{outcome.chip}</span>}
      />
      <div className="paid-wrap">
        <section className="paid-cover" aria-labelledby="paid-outcome-title" role="status">
          <span className="paid-cover-icon" aria-hidden="true">{outcome.icon}</span>
          <h2 id="paid-outcome-title">{outcome.title}</h2>
          <p className="paid-cover-text">{outcome.text}</p>
          {outcome.amount && <p className="paid-amount"><strong>{outcome.amount}</strong><span>card payment</span></p>}
        </section>
        <section className="screen-card paid-card" aria-labelledby="paid-detail-title">
          <h2 id="paid-detail-title"><ReceiptText size={17} aria-hidden="true" />Payment details</h2>
          <dl className="paid-details">
            {outcome.details.map(({ label, value, emphasis }) => <Row key={label} label={label} value={value} emphasis={emphasis} />)}
          </dl>
        </section>
        <div className={"paid-note is-" + outcome.tone} role="status">
          <CircleAlert size={17} aria-hidden="true" /><span>{outcome.note}</span>
        </div>
      </div>
      <BottomBar>
        <div className="paid-actions">
          {checkAgain && <button type="button" className="xs-button" onClick={() => void refetch()}>Check again</button>}
          {queue && failed ? (
            <>
              <Link to={`/fees/pay/${queue.steps[queue.index].invoice_ref}?pay-all=1`} className="xs-button">Try this step again</Link>
              <div className="paid-actions-pair">
                <button type="button" className="xs-button xs-button--plain" onClick={skipStep}>Skip this step</button>
                <Link to="/fees" className="xs-button xs-button--plain">Back to Fees</Link>
              </div>
            </>
          ) : (
            <Link to="/fees" className="xs-button xs-button--plain">Back to Fees</Link>
          )}
          <p className="paid-hint">{outcome.hint}</p>
        </div>
      </BottomBar>
    </PageShell>
  );
}

/** One row of the details card; the status row carries a dot in the outcome's colour. */
function Row({ label, value, emphasis }: Detail) {
  const kind = [emphasis ? "is-" + emphasis : "", label === "Reference" ? "is-reference" : "", label === "Status" ? "is-status" : ""].filter(Boolean).join(" ");
  return (
    <div>
      <dt>{label}</dt>
      <dd className={kind || undefined}>{label === "Status" && <span className="paid-status-dot" aria-hidden="true" />}{value}</dd>
    </div>
  );
}

/**
 * What is left after the payment: the paying child's balance where we know
 * whose bill it was, otherwise the family's. Never netted against another
 * child's credit.
 */
function BalanceRow({ fees, childId, childName }: { fees?: FamilyFeesData; childId?: number; childName?: string }) {
  // Read defensively, as before: an answer without the children or the family block shows no balance.
  if (!fees?.children || !fees.combined) return null;
  const entry = fees.children.find((item) => item.child.id === childId);
  if (entry?.available) {
    return <Row label={`${childName ?? entry.child.first_name}'s balance now`} value={formatNaira(Math.max(0, entry.owing))} emphasis={entry.owing > 0 ? "money" : "positive"} />;
  }
  if (!fees.combined.available) return null;
  const owing = fees.children.some((item) => item.available)
    ? fees.children.reduce((total, item) => total + (item.available ? item.owing : 0), 0)
    : fees.combined.outstanding;
  return owing > 0
    ? <Row label="Family still owes" value={formatNaira(owing)} emphasis="money" />
    : <Row label="Family still owes" value={formatNaira(0)} emphasis="positive" />;
}

/** "26 Oct 2026, 10:42am", on the reader's own clock. */
function paidAt(value: string): string {
  const at = new Date(value);
  if (Number.isNaN(at.getTime())) return "";
  const hour = at.getHours() % 12 || 12;
  const minutes = String(at.getMinutes()).padStart(2, "0");
  return `${formatTimestampDate(value)}, ${hour}:${minutes}${at.getHours() < 12 ? "am" : "pm"}`;
}

function describeOutcome({
  reference,
  status,
  gaveUp,
  isError,
  childName,
}: {
  reference: string;
  status?: PaymentStatus;
  gaveUp: boolean;
  isError: boolean;
  childName?: string;
}): Outcome {
  if (!reference)
    return {
      chip: "No reference",
      icon: <Clock3 size={38} />,
      title: "Thank you",
      text: "If a payment went through, it will appear in Fees once the bank confirms it.",
      tone: "neutral",
      details: [{ label: "Status", value: "Awaiting bank confirmation" }],
      note: "This return did not include a payment reference, so we can't check it.",
      hint: "Open Fees to see the latest balance and payments.",
    };

  const details: Detail[] = [
    ...(status ? [{ label: "Amount", value: status.amount_naira, emphasis: "money" as const }] : []),
    ...(childName ? [{ label: "On behalf of", value: childName }] : []),
    { label: "Reference", value: reference },
  ];

  if (!status)
    return {
      chip: isError ? "Check unavailable" : "Checking",
      icon: isError ? <CircleAlert size={38} /> : <Clock3 size={38} />,
      title: isError ? "Could not check yet" : "Checking the payment",
      text: isError
        ? "We could not get the latest payment status right now."
        : "Asking the bank for the latest status.",
      tone: "neutral",
      details: [...details, { label: "Status", value: isError ? "Check unavailable" : "Checking" }],
      note: isError
        ? "Try checking again, or return to Fees later."
        : "A moment. The result will show here as soon as it is available.",
      hint: "You can return to Fees at any time.",
    };

  if (status.status === "PENDING")
    return {
      chip: gaveUp ? "Still confirming" : "Confirming",
      icon: <Clock3 size={38} />,
      title: gaveUp ? "Still checking" : "Almost there",
      text: gaveUp
        ? "This is taking longer than usual. The payment is still being checked."
        : "The bank has not confirmed this payment yet. This usually takes a few seconds.",
      amount: status.amount_naira,
      tone: "pending",
      details: [...details, { label: "Status", value: "Waiting for confirmation" }],
      note: gaveUp
        ? "The family's fees will update once the bank confirms. You will be told in the app and by email."
        : "You can leave this page. It will not change the payment.",
      hint: gaveUp
        ? "Please check Fees later for the latest status."
        : "The family's fees update after the bank confirms the payment.",
    };

  return {
    chip: "Not completed",
    icon: <X size={40} strokeWidth={2.5} />,
    title: status.status === "ABANDONED" ? "Payment was cancelled" : "Payment did not go through",
    text: "You have not been charged, and the family's fees have not changed.",
    amount: status.amount_naira,
    tone: "failed",
    details: [...details, { label: "Status", value: "Not completed" }],
    note:
      status.status === "ABANDONED"
        ? "Return to Fees when you are ready to try again."
        : "Return to Fees to start another payment.",
    hint:
      status.status === "ABANDONED"
        ? "The bill is still available in Fees."
        : "If you need help, keep this reference for the school.",
  };
}
