import { ReceiptText } from "lucide-react";
import { Link } from "react-router";

import { formatTimestampDate } from "@/lib/format";
import { noticePath } from "@/lib/payment-notices";
import {
  useMarkPaymentNoticeReadMutation,
  usePaymentNoticesQuery,
} from "@/redux/services/payment-notices-api";

/**
 * The payments the school has booked that the parent has not yet opened.
 *
 * One line per unread "payment received" notice from the parent's own
 * notification feed, each opening the receipt and clearing itself as it is
 * opened. It draws nothing while there is nothing new, while the feed is still
 * loading and when the feed cannot be read, so a quiet family sees no empty
 * block. A notice opens the receipt its address names, or Fees when it names none.
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
      <ul className="home-payments">
        {shown.map((notice) => (
            <li key={notice.id}>
              <Link
                to={noticePath(notice.actionUrl)}
                className="home-surface home-notice home-notice-link"
                onClick={() => void markRead(notice.id)}
              >
                <span className="home-notice-icon">
                  <ReceiptText size={19} aria-hidden="true" />
                </span>
                <span className="home-notice-body">
                  <span className="home-notice-top">
                    <strong>
                      <span className="home-unread-dot" aria-label="Unread" />
                      {notice.subject || "Payment received"}
                    </strong>
                    <time dateTime={notice.createdAt}>{formatTimestampDate(notice.createdAt)}</time>
                  </span>
                </span>
              </Link>
            </li>
        ))}
      </ul>
    </section>
  );
}
