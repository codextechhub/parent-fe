import { ReceiptText } from "lucide-react";
import { Link } from "react-router";

import { formatTimestampDate } from "@/lib/format";
import { describeNotice } from "@/lib/payment-notices";
import { useFamilyPaymentsQuery } from "@/redux/services/portal-api";
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
 * block. The family's payments are read only once there is a notice to match,
 * to turn the receipt number the notice names into the receipt's address.
 */
export function PaymentNotices() {
  const { data: notices } = usePaymentNoticesQuery(undefined, { refetchOnMountOrArgChange: true });
  const shown = notices ?? [];
  const { data: payments } = useFamilyPaymentsQuery(undefined, { skip: shown.length === 0 });
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
        {shown.map((notice) => {
          const line = describeNotice(notice, payments);
          return (
            <li key={notice.id}>
              <Link
                to={line.href}
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
                      {line.title}
                    </strong>
                    <time dateTime={notice.createdAt}>{formatTimestampDate(notice.createdAt)}</time>
                  </span>
                  <span className="home-notice-excerpt">
                    {line.receiptNumber ? `Receipt ${line.receiptNumber}` : "Open Fees to see your receipt"}
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
