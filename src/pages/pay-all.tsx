import { useEffect } from "react";
import { ArrowLeft, ArrowRight, X } from "lucide-react";
import { Navigate, useNavigate } from "react-router";

import { PageShell } from "@/components/layout/page-shell";
import { formatNaira } from "@/lib/format";
import { cardPaymentsOn, useFamilyFeesQuery } from "@/redux/services/portal-api";
import {
  clearPayAllQueue,
  readPayAllQueue,
  savePayAllQueue,
} from "./pay-all-queue";

import "./fees.css";
import "./pay.css";
import "./pay-all.css";

/**
 * The pay-all route: one checkout per child, in the server's order.
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
      <PageShell className="pay-page">
        <div className="pay-wrap">
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

  const start = () => navigate(`/fees/pay/${step.invoice_ref}?pay-all=1`);
  const stop = () => {
    clearPayAllQueue();
    navigate("/fees");
  };

  return (
    <PageShell className="pay-page pay-all-page">
      <div className="pay-wrap pay-all-wrap">
        <button type="button" onClick={stop} className="pay-back">
          <ArrowLeft size={17} aria-hidden="true" />
          Back to Fees
        </button>
        <div className="pay-all-layout">
          <div className="pay-all-main">
            <section className="pay-all-summary" aria-labelledby="pay-all-title">
              <div className="pay-all-summary-top"><span>Pay all balances</span><span>Step {queue.index + 1} of {queue.steps.length}</span></div>
              <h1 id="pay-all-title">Remaining to pay</h1>
              <strong>{formatNaira(remainingTotal)}</strong>
              <p>{remaining.length === 1 ? "One bill left in this payment flow." : `${remaining.length} bills left, paid one at a time.`}</p>
            </section>
            <section className="pay-all-current" aria-labelledby="pay-all-current-title">
              <div className="pay-all-current-heading"><span className="pay-all-step-number">{queue.index + 1}</span><div><small>Paying now</small><h2 id="pay-all-current-title">{step.first_name}{step.title ? ` · ${step.title}` : ""}</h2>{step.number && <p>{step.number}</p>}</div></div>
              <div className="pay-all-step-amount"><span>Amount for this bill</span><strong>{formatNaira(step.amount)}</strong></div>
              <p className="pay-all-help">You&apos;ll confirm this payment first, then move to the next bill.</p>
              <button type="button" className="pay-all-primary" onClick={start}>Continue to payment <ArrowRight size={18} aria-hidden="true" /></button>
              <button type="button" className="pay-all-cancel" onClick={stop}><X size={16} aria-hidden="true" /> Stop all and return to Fees</button>
            </section>
          </div>
          {remaining.length > 1 && <aside className="pay-all-upcoming" aria-label="Upcoming bills"><h2>Coming up next</h2><ul>{remaining.slice(1).map((item, index) => <li key={item.invoice_ref}><span className="pay-all-upcoming-number">{queue.index + 2 + index}</span><span><strong>{item.first_name}</strong><small>{item.title || item.number}</small></span><b>{formatNaira(item.amount)}</b></li>)}</ul></aside>}
        </div>
      </div>
    </PageShell>
  );
}
