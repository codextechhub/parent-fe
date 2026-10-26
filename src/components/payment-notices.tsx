import { ChevronRight, ReceiptText } from "lucide-react";
import { Link } from "react-router";

import { formatTimestampDate } from "@/lib/format";
import { describeNotice, noticePath } from "@/lib/payment-notices";
import {
  useMarkPaymentNoticeReadMutation,
  usePaymentNoticesQuery,
} from "@/redux/services/payment-notices-api";

/**
 * The payments the school has booked that the parent has not yet opened.
 *
 * One card with one row per unread "payment received" notice from the
 * parent's own notification feed. A row leads with the amount, says which
 * child it was for and when, and offers "View receipt"; the whole row opens
 * the receipt and clears itself as it is opened. It draws nothing while there
 * is nothing new, while the feed is still loading and when the feed cannot be
 * read, so a quiet family sees no empty block. A notice opens the receipt its
 * address names, or Fees when it names none. A subject that is not in the
 * school's usual wording is shown whole, wrapped, never cut.
 */
export function PaymentNotices() {
  const { data: notices } = usePaymentNoticesQuery(undefined, { refetchOnMountOrArgChange: true });
  const shown = notices ?? [];
  const [markRead] = useMarkPaymentNoticeReadMutation();
  if (shown.length === 0) return null;

  return (
    <section aria-labelledby="home-payments-title">
      <div className="home-section-heading">
        <div>
          <h2 id="home-payments-title">Payments</h2>
          <p>{shown.length === 1 ? "1 new" : `${shown.length} new`}</p>
        </div>
      </div>
      <ul className="home-surface home-payments">
        {shown.map((notice) => {
          const parts = describeNotice(notice.subject);
          return (
            <li key={notice.id}>
              <Link
                to={noticePath(notice.actionUrl)}
                className="home-payment"
                onClick={() => void markRead(notice.id)}
              >
                <span className="home-notice-icon">
                  <ReceiptText size={19} aria-hidden="true" />
                </span>
                <span className="home-payment-body">
                  <span className="home-payment-top">
                    <strong>
                      <span className="home-unread-dot" aria-label="Unread" />
                      {parts ? parts.amount : notice.subject || "Payment received"}
                    </strong>
                    <time dateTime={notice.createdAt}>{formatTimestampDate(notice.createdAt)}</time>
                  </span>
                  {parts && <span className="home-payment-for">Received for {parts.child}</span>}
                  <span className="home-payment-view">
                    View receipt <ChevronRight size={14} aria-hidden="true" />
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
