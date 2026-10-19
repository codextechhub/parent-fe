import { useState } from "react";
import { ArrowLeft, Bell, Check, ChevronDown } from "lucide-react";
import { Link, useParams } from "react-router";
import { toast } from "sonner";

import { PageShell } from "@/components/layout/page-shell";
import { formatTimestampDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  refusal,
  useMarkAllNoticesReadMutation,
  useMarkNoticeReadMutation,
  useNoticeQuery,
  useNoticesQuery,
  type Notice,
} from "@/redux/services/portal-api";

import "./notices.css";

/**
 * The parent's notice feed.
 *
 * Union across the children; each row shows which of the parent's children
 * the notice is for. Phone layout is list-then-detail; from `md` the two
 * sit side by side. Opening a notice does not mark it read; the parent
 * marks each one, or them all, themselves. The in-app notification
 * destination is `/notices/<id>`, matched by the `:id` route below.
 */
export function NoticesPage() {
  const { id } = useParams();
  const requestedId = id ? Number(id) : null;
  const openId =
    requestedId && Number.isSafeInteger(requestedId) && requestedId > 0 ? requestedId : null;
  const [pages, setPages] = useState(1);
  const { data: first, isLoading, isError, refetch } = useNoticesQuery(1);
  const [markAll, { isLoading: markingAll }] = useMarkAllNoticesReadMutation();
  const unread = first?.unreadCount ?? 0;
  const shownId = openId ?? first?.notices[0]?.id ?? null;

  const readAll = async () => {
    try {
      await markAll().unwrap();
      toast.success("All notices marked as read");
    } catch (error) {
      toast.error(refusal(error).message);
    }
  };

  return (
    <PageShell className="notices-page">
      <div className="notices-wrap">
        {isLoading && !first && (
          <div className="notices-loading" role="status" aria-label="Loading notices" />
        )}
        {isError && !first && (
          <div className="notices-error" role="alert">
            Notices can&apos;t be shown right now.{" "}
            <button type="button" onClick={() => refetch()}>
              Try again
            </button>
          </div>
        )}
        {(first || openId !== null) && (
          <div className="notices-layout">
            <div className={cn("notices-list-panel", openId !== null && "is-hidden-on-detail")}>
              <section className="notices-cover" aria-label="Notice summary">
                <span className="notices-cover-label">School notices</span>
                <h2>{unread > 0 ? `${unread} unread` : "All read"}</h2>
                {unread > 0 && (
                  <button
                    type="button"
                    className="notices-mark-all"
                    onClick={readAll}
                    disabled={markingAll}
                  >
                    <Check size={17} aria-hidden="true" />
                    {markingAll ? "Marking…" : "Mark all as read"}
                  </button>
                )}
              </section>
              <div className="notices-section-heading">
                <h2>Latest notices</h2>
                <span>Newest first</span>
              </div>
              {first?.notices.length === 0 ? (
                <div className="notices-empty">
                  <span className="notices-empty-icon">
                    <Bell size={25} aria-hidden="true" />
                  </span>
                  <h2>No notices yet</h2>
                  <p>
                    Your school&apos;s updates will appear here when they are posted.
                  </p>
                </div>
              ) : (
                <>
                  <ul className="notices-list">
                    {Array.from({ length: pages }, (_, index) => (
                      <NoticeRows key={index + 1} page={index + 1} shownId={shownId} />
                    ))}
                  </ul>
                  <MoreButton pages={pages} onMore={() => setPages((value) => value + 1)} />
                </>
              )}
            </div>
            {shownId !== null && (
              <div className={cn("notices-detail-panel", openId === null && "is-hidden-on-list")}>
                <Link to="/notices" className="notices-detail-back">
                  <ArrowLeft size={17} aria-hidden="true" />
                  All notices
                </Link>
                <NoticeDetail id={shownId} />
              </div>
            )}
          </div>
        )}
      </div>
    </PageShell>
  );
}

function NoticeRows({ page, shownId }: { page: number; shownId: number | null }) {
  const { data } = useNoticesQuery(page);
  return (
    <>
      {data?.notices.map((notice) => (
        <li
          key={notice.id}
          className={cn(
            "notices-row",
            notice.unread && "is-unread",
            notice.id === shownId && "is-selected",
          )}
        >
          <Link
            to={`/notices/${notice.id}`}
            aria-label={`Open ${notice.title}, ${notice.unread ? "unread" : "read"}`}
          >
            <span className="notices-row-icon">
              <Bell size={20} aria-hidden="true" />
            </span>
            <span className="notices-row-main">
              <span className="notices-row-top">
                <span>{notice.audience_label}</span>
                <time>{formatTimestampDate(notice.published_at)}</time>
              </span>
              <strong className="notices-row-title">{notice.title}</strong>
              <span className="notices-row-preview">{notice.body}</span>
              <span className="notices-row-flags">
                <Status unread={notice.unread} />
                {notice.edited_at && <span className="notices-flag is-edited">Edited</span>}
                {notice.children.length > 0 && (
                  <span className="notices-flag is-children">
                    For {notice.children.join(", ")}
                  </span>
                )}
              </span>
            </span>
          </Link>
        </li>
      ))}
    </>
  );
}

function MoreButton({ pages, onMore }: { pages: number; onMore: () => void }) {
  const { data } = useNoticesQuery(pages);
  if (!data?.nextPage) return null;
  return (
    <button type="button" className="notices-older" onClick={onMore}>
      Show older notices <ChevronDown size={16} aria-hidden="true" />
    </button>
  );
}

function NoticeDetail({ id }: { id: number }) {
  const { data: notice, isError } = useNoticeQuery(id);
  const [markRead, { isLoading }] = useMarkNoticeReadMutation();

  if (isError) {
    return (
      <div className="notices-detail-error" role="alert">
        This notice isn&apos;t available any more. <Link to="/notices">Back to notices</Link>
      </div>
    );
  }
  if (!notice) return <div className="notices-detail-loading" role="status" aria-label="Loading notice" />;

  const read = async () => {
    try {
      await markRead(notice.id).unwrap();
    } catch (error) {
      toast.error(refusal(error).message);
    }
  };

  return (
    <article className="notices-detail-card">
      <div className="notices-detail-accent" />
      <div className="notices-detail-inner">
        <h2>{notice.title}</h2>
        <div className="notices-detail-flags">
          <Status unread={notice.unread} />
          {notice.edited_at && <span className="notices-flag is-edited">Edited</span>}
        </div>
        <dl className="notices-detail-meta">
          <div>
            <dt>Audience</dt>
            <dd>{notice.audience_label}</dd>
          </div>
          <div>
            <dt>Published</dt>
            <dd>{formatTimestampDate(notice.published_at)}</dd>
          </div>
          {notice.children.length > 0 && (
            <div>
              <dt>For your {notice.children.length === 1 ? "child" : "children"}</dt>
              <dd>{notice.children.join(", ")}</dd>
            </div>
          )}
          {notice.edited_at && (
            <div>
              <dt>Last edited</dt>
              <dd>{formatTimestampDate(notice.edited_at)}</dd>
            </div>
          )}
        </dl>
        <p className="notices-detail-body">{notice.body}</p>
        <div className="notices-detail-bottom">
          {notice.unread ? (
            <button
              type="button"
              className="notices-mark-read"
              onClick={read}
              disabled={isLoading}
            >
              <Check size={17} aria-hidden="true" />
              {isLoading ? "Marking…" : "Mark as read"}
            </button>
          ) : (
            <span className="notices-read-confirmation">
              <Check size={17} aria-hidden="true" />
              You&apos;ve marked this notice as read
            </span>
          )}
        </div>
      </div>
    </article>
  );
}

function Status({ unread }: Pick<Notice, "unread">) {
  return (
    <span className={cn("notices-flag", unread && "is-unread")}>
      {unread ? "Unread" : "Read"}
    </span>
  );
}
