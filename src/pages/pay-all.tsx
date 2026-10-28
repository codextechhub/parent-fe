import { useEffect } from "react";
import { ArrowRight, X } from "lucide-react";
import { Navigate, useNavigate } from "react-router";

import { ChildAvatar } from "@/components/child-avatar";
import { PageShell } from "@/components/layout/page-shell";
import { BottomBar, DetailBar } from "@/components/layout/screen";
import { formatNaira } from "@/lib/format";
import { useAppSelector } from "@/redux/hooks";
import { cardPaymentsOn, useFamilyFeesQuery, type FamilyFeesData, type PayAllStep } from "@/redux/services/portal-api";
import {
  clearPayAllQueue,
  readPayAllQueue,
  savePayAllQueue,
} from "./pay-all-queue";

import "./fees.css";
import "./pay.css";
import "./pay-all.css";

/**
 * The pay-all route (design 1h): one checkout per bill, in the server's
 * order. What is left to pay with a bar split by bill, then the bills as a
 * numbered list down a dotted line, the one being paid now ringed in blue,
 * and Continue to payment or Stop all at the foot.
 *
 * On the first visit it reads `fees.pay_all.steps` and seeds the queue
 * in sessionStorage, then shows the first step for the parent to start.
 * Each confirmed step on the return page offers Continue, which lands
 * back here on the next step; a failed step offers Try again or Skip.
 * The queue survives the trip to the gateway because it is kept in
 * sessionStorage, not in the RTK Query cache.
 */
export function PayAllPage() {
  const navigate = useNavigate();
  const { data: fees, isLoading, isFetching } = useFamilyFeesQuery(undefined, { refetchOnMountOrArgChange: true });
  const existing = readPayAllQueue();

  useEffect(() => {
    if (existing) return;
    if (!fees || !cardPaymentsOn(fees)) return;
    if (isFetching) return;
    if (fees.pay_all.steps.length === 0) return;
    savePayAllQueue({ steps: fees.pay_all.steps, index: 0 });
  }, [fees, existing, isFetching]);

  if ((isLoading || isFetching) && !existing) {
    return (
      <PageShell className="pay-page pay-all-page">
        <DetailBar title="Pay all balances" back="/fees" backLabel="Back to Fees" />
        <div className="pay-wrap pay-all-wrap">
          <div className="pay-loading" role="status" aria-label="Loading pay-all" />
        </div>
      </PageShell>
    );
  }

  // Where families pay by transfer alone there is no card queue to run: back to the account cards.
  if (fees && !cardPaymentsOn(fees)) {
    clearPayAllQueue();
    return <Navigate to="/fees" replace />;
  }

  // Pay-all without open invoices sends the parent back to Fees.
  if (!existing && fees && fees.pay_all.steps.length === 0) {
    return <Navigate to="/fees" replace />;
  }

  const queue = existing ?? (fees ? { steps: fees.pay_all.steps, index: 0 } : null);
  if (!queue) return null;

  const step = queue.steps[queue.index];
  const remaining = queue.steps.slice(queue.index);
  const remainingTotal = remaining.reduce((sum, s) => sum + s.amount, 0);
  const [whole, kobo] = formatNaira(remainingTotal).split(".");

  const start = () => navigate(`/fees/pay/${step.invoice_ref}?pay-all=1`);
  const stop = () => {
    clearPayAllQueue();
    navigate("/fees");
  };

  return (
    <PageShell className="pay-page pay-all-page">
      <DetailBar
        title="Pay all balances"
        back="/fees"
        backLabel="Stop and go back to Fees"
        onBack={clearPayAllQueue}
        action={<StepPill index={queue.index} count={queue.steps.length} />}
      />
      <div className="pay-wrap pay-all-wrap">
        <section className="pay-all-summary" aria-labelledby="pay-all-title">
          <h1 id="pay-all-title">Remaining to pay</h1>
          <strong aria-label={formatNaira(remainingTotal)}>{whole}<span>.{kobo}</span></strong>
          <p>{remaining.length === 1 ? "One bill left in this payment flow." : `${remaining.length} bills left, paid one at a time.`}</p>
          <div className="pay-all-bar" aria-hidden="true">
            {remaining.map((item, index) => (
              <span key={item.invoice_ref} className={index === 0 ? "is-now" : undefined} style={{ flexGrow: item.amount }} />
            ))}
          </div>
        </section>

        <ol className="pay-all-steps" aria-label="Bills in this payment">
          <li className="pay-all-step is-now">
            <span className="pay-all-step-number">{queue.index + 1}</span>
            <section className="pay-all-current" aria-labelledby="pay-all-current-title">
              <span className="pay-all-now">Paying now</span>
              <div className="pay-all-current-heading">
                <StepAvatar step={step} size={36} />
                <div>
                  <h2 id="pay-all-current-title">{step.first_name}{step.title ? ` · ${step.title}` : ""}</h2>
                  {step.number && <p>{step.number}</p>}
                </div>
              </div>
              <div className="pay-all-step-amount"><span>Amount for this bill</span><strong>{formatNaira(step.amount)}</strong></div>
              <p className="pay-all-help">You&apos;ll confirm this payment first, then move to the next bill.</p>
            </section>
          </li>
          {remaining.slice(1).map((item, index) => (
            <li className="pay-all-step pay-all-upcoming" key={item.invoice_ref}>
              <span className="pay-all-step-number">{queue.index + 2 + index}</span>
              <div className="pay-all-upcoming-card">
                <StepAvatar step={item} size={34} />
                <span className="pay-all-upcoming-text"><strong>{item.first_name}</strong><small>{item.title || item.number}</small></span>
                <b>{formatNaira(item.amount)}</b>
              </div>
            </li>
          ))}
        </ol>
        {fees && <ChargesNote fees={fees} />}
      </div>
      <BottomBar>
        <div className="pay-all-actions">
          <button type="button" className="xs-button" onClick={start}>Continue to payment <ArrowRight size={18} aria-hidden="true" /></button>
          <button type="button" className="pay-all-cancel" onClick={stop}><X size={16} aria-hidden="true" /> Stop all and return to Fees</button>
        </div>
      </BottomBar>
    </PageShell>
  );
}

/** "Step 1 of 2", the pill on the right of a Pay all screen's back bar. */
export function StepPill({ index, count }: { index: number; count: number }) {
  return <span className="pay-step-pill">Step {index + 1} of {count}</span>;
}

/** A step's child, in their colour. */
export function StepAvatar({ step, size }: { step: PayAllStep; size: number }) {
  const fullName = useAppSelector((s) => s.auth.me?.children.find((child) => child.id === step.child_id)?.full_name);
  return <ChildAvatar name={fullName ?? step.first_name} childId={step.child_id} size={size} />;
}

/**
 * Added charges are never in Pay all, since they are paid by transfer: one
 * line under the steps says whose and how much, so a parent does not think
 * they were forgotten.
 */
function ChargesNote({ fees }: { fees: FamilyFeesData }) {
  const owing = fees.children.flatMap((entry) => {
    if (!entry.available) return [];
    const open = entry.debit_notes.filter((note) => note.balance > 0);
    return open.length ? [{ name: entry.child.first_name, count: open.length, total: open.reduce((sum, note) => sum + note.balance, 0) }] : [];
  });
  if (owing.length === 0) return null;
  if (owing.length === 1) {
    const [{ name, count, total }] = owing;
    return <p className="pay-all-charges">{count === 1
      ? `${name}'s added charge of ${formatNaira(total)} is paid by bank transfer, so it isn't in this list.`
      : `${name}'s added charges of ${formatNaira(total)} are paid by bank transfer, so they aren't in this list.`}</p>;
  }
  const total = owing.reduce((sum, child) => sum + child.total, 0);
  return <p className="pay-all-charges">Added charges of {formatNaira(total)} are paid by bank transfer, so they aren&apos;t in this list.</p>;
}
