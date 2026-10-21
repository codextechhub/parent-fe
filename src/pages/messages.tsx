import { useState } from "react";
import { ChevronDown, Eye, MessageSquare, Plus } from "lucide-react";
import { Link, useLocation, useParams } from "react-router";

import { PageShell } from "@/components/layout/page-shell";
import { childFirstName } from "@/lib/messages";
import { cn } from "@/lib/utils";
import { useAppSelector } from "@/redux/hooks";
import {
  useConversationsQuery,
  type Conversation,
} from "@/redux/services/messages-api";

import "./messages.css";
import { NewMessage } from "./messages-new";
import { ConversationRow } from "./messages-row";
import { ThreadView } from "./messages-thread";

/**
 * The parent's messages with the school's staff.
 *
 * Family-scoped like Notices: every conversation about every child, newest
 * first, narrowed to one child with the chips when the parent has several.
 * The conversations of the parent's own come first. The ones a child holds
 * with staff, which the parent reads as primary parent and cannot answer,
 * sit in a section of their own so nobody mistakes them for a thread they
 * can write in.
 *
 * On a phone the list and an open conversation are separate full screens
 * (`/messages`, `/messages/<id>`, and `/messages/new` for a new one); from
 * 900px wide they sit side by side. A message alert opens
 * `/messages/<id>`.
 */
export function MessagesPage() {
  const { id } = useParams();
  const { pathname } = useLocation();
  const composing = pathname === "/messages/new";
  const requested = id ? Number(id) : null;
  const openId =
    requested !== null && Number.isSafeInteger(requested) && requested > 0 ? requested : null;
  const detailOpen = composing || openId !== null;

  const children = useAppSelector((s) => s.auth.me?.children ?? []);
  const [filter, setFilter] = useState<number | null>(null);
  const [pages, setPages] = useState(1);
  const { data: first, isLoading, isError, refetch } = useConversationsQuery({
    page: 1,
    child: filter,
  });

  const unread = first?.unreadCount ?? 0;
  const own = first?.conversations.filter((c) => c.kind !== "PUPIL") ?? [];
  const watched = first?.conversations.filter((c) => c.kind === "PUPIL") ?? [];
  const showChild = children.length > 1;
  const filterName = children.find((c) => c.id === filter)?.first_name;

  const choose = (child: number | null) => {
    setFilter(child);
    setPages(1);
  };

  return (
    <PageShell className="msg-page">
      <div className="msg-wrap">
        <div className="msg-layout">
          <div className={cn("msg-list-panel", detailOpen && "is-hidden-on-detail")}>
            <section className="msg-cover" aria-label="Message summary">
              <span className="msg-cover-label">Messages</span>
              <h2>{unread > 0 ? `${unread} unread` : "All caught up"}</h2>
              <Link to="/messages/new" className="msg-new">
                <Plus size={17} aria-hidden="true" />
                New message
              </Link>
            </section>

            {showChild && (
              <div className="msg-chips" role="group" aria-label="Show messages about">
                <button
                  type="button"
                  aria-pressed={filter === null}
                  className={cn("msg-chip", filter === null && "is-on")}
                  onClick={() => choose(null)}
                >
                  All children
                </button>
                {children.map((child) => (
                  <button
                    key={child.id}
                    type="button"
                    aria-pressed={filter === child.id}
                    className={cn("msg-chip", filter === child.id && "is-on")}
                    onClick={() => choose(child.id)}
                  >
                    {child.first_name}
                  </button>
                ))}
              </div>
            )}

            {isLoading && !first && (
              <div className="msg-loading" role="status" aria-label="Loading messages" />
            )}
            {isError && !first && (
              <div className="msg-error" role="alert">
                Messages can&apos;t be shown right now.{" "}
                <button type="button" onClick={() => refetch()}>
                  Try again
                </button>
              </div>
            )}

            {first && first.conversations.length === 0 && (
              <div className="msg-empty">
                <span className="msg-empty-icon">
                  <MessageSquare size={25} aria-hidden="true" />
                </span>
                <h2>{filterName ? `No messages about ${filterName}` : "No messages yet"}</h2>
                <p>
                  Write to your child&apos;s teacher or the school office, and their replies will
                  appear here.
                </p>
              </div>
            )}

            {own.length > 0 && (
              <>
                <div className="msg-section-heading">
                  <h2>Your conversations</h2>
                  <span>Newest first</span>
                </div>
                <ul className="msg-list">
                  {own.map((convo) => (
                    <ConversationRow
                      key={convo.id}
                      convo={convo}
                      childFirst={childFirstName(convo, children)}
                      showChild={showChild}
                      selected={convo.id === openId}
                    />
                  ))}
                </ul>
              </>
            )}

            {watched.length > 0 && (
              <>
                <div className="msg-section-heading">
                  <h2>Your child&apos;s conversations with staff</h2>
                </div>
                <p className="msg-section-note">
                  <Eye size={15} aria-hidden="true" />
                  You can read these but not reply. Only your child can write in them.
                </p>
                <ul className="msg-list">
                  {watched.map((convo) => (
                    <ConversationRow
                      key={convo.id}
                      convo={convo}
                      childFirst={childFirstName(convo, children)}
                      showChild={showChild}
                      selected={convo.id === openId}
                    />
                  ))}
                </ul>
              </>
            )}

            {Array.from({ length: pages - 1 }, (_, index) => (
              <MoreRows
                key={index + 2}
                page={index + 2}
                child={filter}
                openId={openId}
                showChild={showChild}
              />
            ))}
            <MoreButton pages={pages} child={filter} onMore={() => setPages((value) => value + 1)} />
          </div>

          <div className={cn("msg-detail-panel", !detailOpen && "is-hidden-on-list")}>
            {composing ? (
              <NewMessage />
            ) : openId !== null ? (
              <ThreadView key={openId} id={openId} />
            ) : (
              <div className="msg-placeholder">
                <MessageSquare size={26} aria-hidden="true" />
                <p>Choose a conversation to read it, or write a new message.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </PageShell>
  );
}

/** Rows from a later page of the list, after the sections above. */
function MoreRows({
  page,
  child,
  openId,
  showChild,
}: {
  page: number;
  child: number | null;
  openId: number | null;
  showChild: boolean;
}) {
  const { data } = useConversationsQuery({ page, child });
  const children = useAppSelector((s) => s.auth.me?.children ?? []);
  if (!data) return null;
  return (
    <ul className="msg-list msg-list-more">
      {data.conversations.map((convo: Conversation) => (
        <ConversationRow
          key={convo.id}
          convo={convo}
          childFirst={childFirstName(convo, children)}
          showChild={showChild}
          selected={convo.id === openId}
        />
      ))}
    </ul>
  );
}

function MoreButton({
  pages,
  child,
  onMore,
}: {
  pages: number;
  child: number | null;
  onMore: () => void;
}) {
  const { data } = useConversationsQuery({ page: pages, child });
  if (!data?.nextPage) return null;
  return (
    <button type="button" className="msg-older" onClick={onMore}>
      Show older conversations <ChevronDown size={16} aria-hidden="true" />
    </button>
  );
}
