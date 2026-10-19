import { useEffect } from "react";
import { ArrowLeft, Check } from "lucide-react";
import { Link, Navigate, useNavigate } from "react-router";

import { PageShell } from "@/components/layout/page-shell";
import { Button } from "@/components/ui/button";
import { formatNaira } from "@/lib/format";
import { useFamilyFeesQuery } from "@/redux/services/portal-api";
import {
  clearPayAllQueue,
  readPayAllQueue,
  savePayAllQueue,
} from "./pay-all-queue";

import "./fees.css";
import "./pay.css";

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
  const { data: fees, isLoading } = useFamilyFeesQuery();
  const existing = readPayAllQueue();

  useEffect(() => {
    if (existing) return;
    if (!fees) return;
    if (fees.pay_all.steps.length === 0) return;
    savePayAllQueue({ steps: fees.pay_all.steps, index: 0 });
  }, [fees, existing]);

  if (isLoading && !fees) {
    return (
      <PageShell className="pay-page">
        <div className="pay-wrap">
          <div className="pay-loading" role="status" aria-label="Loading pay-all" />
        </div>
      </PageShell>
    );
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
    <PageShell className="pay-page">
      <div className="pay-wrap">
        <Link to="/fees" className="pay-back">
          <ArrowLeft size={17} aria-hidden="true" />
          Fees
        </Link>
        <div className="pay-layout">
          <div className="pay-overview">
            <section className="pay-bill" aria-label="Pay all - current step">
              <span className="pay-bill-label">
                Payment {queue.index + 1} of {queue.steps.length}
              </span>
              <h2>
                {step.first_name}
                {step.title ? ` · ${step.title}` : ""}
              </h2>
              {step.number && <p>{step.number}</p>}
              <strong>{formatNaira(step.amount)}</strong>
              <div className="pay-bill-chips">
                <span>Full balance on this bill</span>
              </div>
            </section>
          </div>
          <div className="pay-detail">
            <section className="pay-card-panel">
              <h3>Pay this bill</h3>
              <p className="pay-help">
                You&apos;ll pay <strong>{formatNaira(step.amount)}</strong> for{" "}
                {step.first_name}&apos;s <b>{step.title}</b>. After confirmation you&apos;ll be
                offered the next payment in the queue.
              </p>
              <dl className="pay-review">
                <div>
                  <dt>Remaining in this queue</dt>
                  <dd>
                    {queue.steps.length - queue.index}{" "}
                    {queue.steps.length - queue.index === 1 ? "step" : "steps"}
                  </dd>
                </div>
                <div>
                  <dt>Totalling</dt>
                  <dd>{formatNaira(remainingTotal)}</dd>
                </div>
              </dl>
              <Button className="pay-primary-action" onClick={start}>
                <Check size={17} aria-hidden="true" />
                Start this step
              </Button>
              <button type="button" className="pay-secondary-action" onClick={stop}>
                Stop pay all and return to Fees
              </button>
            </section>
            <section className="pay-watch" aria-label="Upcoming payments in this queue">
              <h3>Also in this queue</h3>
              {remaining.length <= 1 ? (
                <p className="pay-watch-message">This is the last step.</p>
              ) : (
                <ul>
                  {remaining.slice(1).map((item, index) => (
                    <li key={item.invoice_ref} className="pay-watch-message is-pending">
                      Step {queue.index + 2 + index}: {item.first_name} ·{" "}
                      {item.title || item.number} · {formatNaira(item.amount)}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </div>
      </div>
    </PageShell>
  );
}
