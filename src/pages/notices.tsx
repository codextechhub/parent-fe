import { Bell, Check } from "lucide-react";
import { Link, useParams } from "react-router";
import { toast } from "sonner";

import { PageShell } from "@/components/layout/page-shell";
import { DetailBar } from "@/components/layout/screen";
import { formatTimestampDate } from "@/lib/format";
import { forChildren } from "@/lib/inbox";
import { useAppSelector } from "@/redux/hooks";
import { refusal, useMarkNoticeReadMutation, useNoticeQuery } from "@/redux/services/portal-api";

import "./notices.css";

/** The notice id in the address, or null when it is missing or not a whole number. */
function noticeId(raw: string | undefined): number | null {
  const id = raw ? Number(raw) : null;
  return id !== null && Number.isSafeInteger(id) && id > 0 ? id : null;
}

/**
 * One school notice, opened from the Inbox, Home or a notification: a screen
 * of its own with a back bar to the Inbox and the notice whole in one card.
 * The list of notices is the Inbox's.
 *
 * Opening a notice does not mark it read: the parent marks it, here, or all
 * of them from the Inbox (the plan's notice detail, unread with "Mark as
 * read", then read).
 */
export function NoticesPage() {
  const id = noticeId(useParams().id);
  return (
    <PageShell className="notice-page">
      <DetailBar title="Notice" back="/inbox" backLabel="Back to the inbox" />
      <div className="notice-wrap">
        {id === null ? <Missing /> : <NoticeView id={id} />}
      </div>
    </PageShell>
  );
}

function NoticeView({ id }: { id: number }) {
  const { data: notice, isError } = useNoticeQuery(id);
  const [markRead, { isLoading }] = useMarkNoticeReadMutation();
  const offline = useAppSelector((s) => s.connectivity.offline);

  if (isError) return <Missing />;
  if (!notice) return <div className="notice-loading" role="status" aria-label="Loading notice" />;

  const read = async () => {
    try {
      await markRead(notice.id).unwrap();
    } catch (error) {
      toast.error(refusal(error).message);
    }
  };

  return (
    <article className="screen-card notice-card">
      <div className="notice-top">
        <span className="notice-audience"><Bell size={14} aria-hidden="true" />{forChildren(notice.children, notice.audience_label)}</span>
        <time dateTime={notice.published_at}>{formatTimestampDate(notice.published_at)}</time>
      </div>
      <h2>{notice.title}</h2>
      {notice.edited_at && <p className="notice-edited"><span className="pill pill--warn">Edited</span>Changed on {formatTimestampDate(notice.edited_at)}</p>}
      <p className="notice-body">{notice.body}</p>
      <div className="notice-foot">
        {notice.unread ? (
          <button type="button" className="xs-button notice-read" onClick={read} disabled={isLoading || offline}>
            <Check size={17} aria-hidden="true" />
            {isLoading ? "Marking…" : "Mark as read"}
          </button>
        ) : (
          <span className="notice-read-done"><Check size={16} aria-hidden="true" />You&apos;ve marked this notice as read</span>
        )}
      </div>
    </article>
  );
}

function Missing() {
  return (
    <div className="screen-card notice-missing" role="alert">
      <span className="icon-tile"><Bell size={20} aria-hidden="true" /></span>
      <p>This notice isn&apos;t available any more.</p>
      <Link to="/inbox?show=notices">Back to notices</Link>
    </div>
  );
}
