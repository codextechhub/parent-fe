import { ChevronRight, ReceiptText } from "lucide-react";
import { Link } from "react-router";

import { formatTimestampDate } from "@/lib/format";
import { firstName } from "@/lib/messages";
import { describeNotice, noticePath } from "@/lib/payment-notices";
import {
  useMarkPaymentNoticeReadMutation,
  usePaymentNoticesQuery,
} from "@/redux/services/payment-notices-api";

/**
 * The payments the school has booked that the parent has not yet opened.
 *
 * One green card (design 1b) per unread "payment received" notice from the
 * parent's own notification feed: "Payment received", then the amount, the
 * child it was for and when the school booked it. The card opens the receipt
 * and clears itself as it is opened. It draws nothing while there
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
    <section className="home-payments" aria-labelledby="home-payments-title">
      <h2 id="home-payments-title" className="sr-only">
        Payments, {shown.length === 1 ? "1 new" : `${shown.length} new`}
      </h2>
      <ul>
        {shown.map((notice) => {
          const parts = describeNotice(notice.subject);
          const when = formatTimestampDate(notice.createdAt);
          return (
            <li key={notice.id}>
              <Link
                to={noticePath(notice.actionUrl)}
                className="home-payment"
                aria-label={`${parts ? `Payment received: ${parts.amount} for ${parts.child}` : notice.subject || "Payment received"}. View receipt`}
                onClick={() => void markRead(notice.id)}
              >
                <span className="home-payment-icon">
                  <ReceiptText size={18} aria-hidden="true" />
                </span>
                <span className="home-payment-text">
                  <strong>Payment received</strong>
                  {parts
                    ? <>{parts.amount} for {firstName(parts.child)}, booked by the school{when ? ` on ${when}` : ""}.</>
                    : <>{notice.subject || "A payment was booked."}{when ? ` ${when}.` : ""}</>}
                </span>
                <ChevronRight size={17} aria-hidden="true" className="home-payment-go" />
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
