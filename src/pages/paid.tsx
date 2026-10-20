import { useEffect, useState, type ReactNode } from "react";
import { ArrowLeft, ArrowUpRight, Check, CircleAlert, Clock3, ReceiptText, X } from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router";

import { PageShell } from "@/components/layout/page-shell";
import { formatNaira } from "@/lib/format";
import { useAppDispatch } from "@/redux/hooks";
import { baseApi } from "@/redux/services/base-api";
import {
  useFamilyFeesQuery,
  useFamilyPaymentsQuery,
  usePaymentStatusQuery,
  type PaymentStatus,
} from "@/redux/services/portal-api";
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
  receiptRef?: number | null;
};

/**
 * The gateway return page.
 *
 * `?reference=` names the payment the gateway just handled. We poll the
 * public collection status route until it settles, flipping between
 * confirming / confirmed / failed. On a confirmed payment the family
 * fees cache invalidates and the receipt link appears once the receipt
 * is ready. If the parent came from a Pay-all step, Continue starts the
 * next one; otherwise Back goes to Fees.
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
  const { data: payments } = useFamilyPaymentsQuery(undefined, {
    skip: status?.status !== "CONFIRMED",
  });
  const { data: fees } = useFamilyFeesQuery(undefined, {
    skip: status?.status !== "CONFIRMED",
  });
  const matchingPayment = payments?.find((payment) => payment.reference === reference);
  const receiptRef = matchingPayment?.has_receipt ? matchingPayment.payment_ref ?? null : null;
  const payeeChildName = matchingPayment?.child.first_name;

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

  const outcome = describeOutcome({
    reference,
    status,
    feesOutstanding:
      fees?.combined?.available
        ? fees.children.some((entry) => entry.available)
          ? fees.children.reduce((total, entry) => total + (entry.available ? Math.max(0, entry.balance) : 0), 0)
          : fees.combined.outstanding
        : undefined,
    receiptRef,
    gaveUp,
    isError: !!isError,
    payeeChildName,
  });

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

  return (
    <PageShell className="paid-page">
      <div className="paid-wrap">
        <h1 className="sr-only">Payment status</h1>
        <Link to="/fees" className="paid-back">
          <ArrowLeft size={17} aria-hidden="true" />
          Fees
        </Link>
        <div className="paid-layout">
          <section className="paid-cover" aria-labelledby="paid-outcome-title" role="status">
            <div className="paid-cover-top">
              <span>
                Payment update
                {queue && ` · Step ${queue.index + 1} of ${queue.steps.length}`}
              </span>
              <span className="paid-status-chip">{outcome.chip}</span>
            </div>
            <span className="paid-cover-icon" aria-hidden="true">
              {outcome.icon}
            </span>
            <h2 id="paid-outcome-title">{outcome.title}</h2>
            <p className="paid-cover-text">{outcome.text}</p>
            {outcome.amount && (
              <p className="paid-amount">
                <strong>{outcome.amount}</strong>
                <span>
                  {status?.status === "CONFIRMED" ? "paid by card" : "card payment"}
                </span>
              </p>
            )}
          </section>
          <section className="paid-card" aria-labelledby="paid-detail-title">
            <h2 id="paid-detail-title">
              <ReceiptText size={19} aria-hidden="true" />
              Payment details
            </h2>
            <dl className="paid-details">
              {outcome.details.map(({ label, value, emphasis }) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd className={emphasis ? "is-" + emphasis : undefined}>{value}</dd>
                </div>
              ))}
            </dl>
            <div className={"paid-note is-" + outcome.tone} role="status">
              <CircleAlert size={18} aria-hidden="true" />
              <span>{outcome.note}</span>
            </div>
            <div className="paid-actions">
              {outcome.receiptRef && (
                <Link to={"/fees/receipts/" + outcome.receiptRef} className="paid-primary">
                  View receipt
                  <ArrowUpRight size={17} aria-hidden="true" />
                </Link>
              )}
              {isError && !status && reference && (
                <button type="button" className="paid-primary" onClick={() => void refetch()}>
                  Check again
                </button>
              )}
              {queue && status?.status === "CONFIRMED" && (
                <button type="button" className="paid-primary" onClick={continueQueue}>
                  Continue pay all
                </button>
              )}
              {queue && (status?.status === "FAILED" || status?.status === "ABANDONED") && (
                <>
                  <Link to={`/fees/pay/${queue.steps[queue.index].invoice_ref}?pay-all=1`} className="paid-primary">
                    Try this step again
                  </Link>
                  <button type="button" className="paid-secondary" onClick={skipStep}>
                    Skip this step
                  </button>
                </>
              )}
              <Link
                to="/fees"
                className={
                  outcome.receiptRef || queue || (isError && !status && reference)
                    ? "paid-secondary"
                    : "paid-primary"
                }
              >
                Back to Fees
              </Link>
            </div>
            <p className="paid-hint">{outcome.hint}</p>
          </section>
        </div>
      </div>
    </PageShell>
  );
}

function describeOutcome({
  reference,
  status,
  feesOutstanding,
  receiptRef,
  gaveUp,
  isError,
  payeeChildName,
}: {
  reference: string;
  status?: PaymentStatus;
  feesOutstanding?: number;
  receiptRef: number | null;
  gaveUp: boolean;
  isError: boolean;
  payeeChildName?: string;
}): Outcome {
  if (!reference)
    return {
      chip: "No reference",
      icon: <Clock3 size={36} />,
      title: "Thank you",
      text: "If a payment went through, it will appear in Fees once the bank confirms it.",
      tone: "neutral",
      details: [{ label: "Status", value: "Awaiting bank confirmation" }],
      note: "This return did not include a payment reference, so we can't check it.",
      hint: "Open Fees to see the latest balance and payments.",
    };

  const details: Detail[] = [
    ...(status ? [{ label: "Amount", value: status.amount_naira, emphasis: "money" as const }] : []),
    ...(status?.status === "CONFIRMED" ? [{ label: "Paid to", value: status.payee_name }] : []),
    ...(payeeChildName ? [{ label: "On behalf of", value: payeeChildName }] : []),
    { label: "Reference", value: reference },
  ];

  if (!status)
    return {
      chip: isError ? "Check unavailable" : "Checking",
      icon: isError ? <CircleAlert size={36} /> : <Clock3 size={36} />,
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

  if (status.status === "CONFIRMED") {
    const outstandingDetail: Detail[] =
      feesOutstanding === undefined
        ? []
        : [
            {
              label: feesOutstanding <= 0 ? "Family outstanding" : "Family outstanding",
              value: formatNaira(Math.max(0, feesOutstanding)),
              emphasis: feesOutstanding <= 0 ? "positive" : "money",
            },
          ];
    const outstandingLine =
      feesOutstanding === undefined
        ? ""
        : feesOutstanding > 0
          ? ` The family still owes ${formatNaira(feesOutstanding)}.`
          : " Your family has nothing outstanding.";
    return {
      chip: "Confirmed",
      icon: <Check size={36} />,
      title: "Payment received",
      text:
        "Your payment to " +
        status.payee_name +
        " has been confirmed." +
        outstandingLine,
      amount: status.amount_naira,
      tone: receiptRef ? "confirmed" : "neutral",
      details: [...details, ...outstandingDetail],
      note: receiptRef
        ? "The payment is confirmed. The receipt is ready to view."
        : "The receipt is being prepared. It will appear in Fees when ready.",
      hint: receiptRef
        ? "A copy of this payment appears in Fees."
        : "The payment is confirmed even while the receipt is being prepared.",
      receiptRef,
    };
  }

  if (status.status === "PENDING")
    return {
      chip: gaveUp ? "Still confirming" : "Confirming",
      icon: <Clock3 size={36} />,
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
    icon: <X size={36} />,
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
