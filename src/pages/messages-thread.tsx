import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowDown, ArrowLeft, Check, CheckCheck, Clock, Lock } from "lucide-react";
import { Link } from "react-router";
import { toast } from "sonner";

import { childFirstName, clockTime, dayHeading, dayKey, sendRefusalMessage } from "@/lib/messages";
import { cn } from "@/lib/utils";
import { useAppSelector } from "@/redux/hooks";
import {
  useConversationQuery,
  useLoadOlderMessagesMutation,
  useMarkConversationReadMutation,
  useSendMessageMutation,
  useThreadQuery,
  type Conversation,
  type Receipt,
  type ThreadMessage,
} from "@/redux/services/messages-api";
import { refusal } from "@/redux/services/portal-api";

import { Composer, type ComposerHandle } from "./messages-composer";
import { useFollowThread, usePageVisible } from "./messages-follow";
import { Initials } from "./messages-row";

/** How often the open conversation's own row (unread count, who can reply) reads again, in ms, while the app is in view. */
const OPEN_POLL_MS = 20_000;

/** How far from the end, in px, still counts as reading the newest message. */
const NEAR_END_PX = 80;

const nearEnd = (el: HTMLElement) => el.scrollHeight - el.scrollTop - el.clientHeight <= NEAR_END_PX;

const isGone = (error: unknown) => (error as { status?: number } | undefined)?.status === 404;

/**
 * One open conversation: who it is with and about, its messages oldest to
 * newest, and the box to answer in.
 *
 * Opening a conversation of the parent's own marks it read, and so does a
 * message that arrives while it is open. A conversation the parent only
 * watches (their child's own, read as primary parent) is never marked and
 * shows the reason instead of a box. The newest page is read again every
 * twenty seconds, on regaining focus and on reconnecting; what was last
 * loaded stays on screen when the connection drops.
 *
 * The view is a column that fills the height it is given: the header on top,
 * the messages in their own scroll area, the box at the bottom. Only the
 * messages scroll. Opening lands on the newest message. A message that
 * arrives scrolls into view when the parent is already at the end, and
 * otherwise raises a "New messages" pill that jumps down; a parent's own
 * message always scrolls into view. Showing earlier messages keeps the one
 * the parent was reading under their thumb. The end stays in view as the
 * scroll area resizes (the keyboard opening, the box growing a line) for a
 * parent who was at the end.
 */
export function ThreadView({ id }: { id: number }) {
  const { data: convo, error: rowError } = useConversationQuery(id, {
    pollingInterval: OPEN_POLL_MS,
    skipPollingIfUnfocused: true,
    refetchOnFocus: true,
    refetchOnReconnect: true,
  });
  const {
    data: thread,
    error: threadError,
    refetch,
  } = useThreadQuery(id, { refetchOnReconnect: true });
  const [markRead] = useMarkConversationReadMutation();
  const [send] = useSendMessageMutation();
  const [loadOlder, { isLoading: loadingOlder }] = useLoadOlderMessagesMutation();
  const children = useAppSelector((s) => s.auth.me?.children ?? []);

  const watching = convo?.kind === "PUPIL";
  const unread = convo?.unread_count ?? 0;
  const ticks = convo?.receipts === true;
  const visible = usePageVisible();

  const scroller = useRef<HTMLDivElement>(null);
  // Whether the parent is reading the end; scrolls and resizes keep it current.
  const atEnd = useRef(true);
  const [atEndNow, setAtEndNow] = useState(true);
  const [unseen, setUnseen] = useState(false);
  const setEnd = (value: boolean) => {
    atEnd.current = value;
    setAtEndNow(value);
  };

  const onScroll = () => {
    const el = scroller.current;
    if (!el) return;
    setEnd(nearEnd(el));
    if (atEnd.current) setUnseen(false);
  };

  // Land on the newest message when opening and after sending; otherwise only if already at the end.
  const seenNewest = useRef<number | null>(null);
  const newest = thread?.messages.at(-1);
  const newestId = newest?.id ?? null;
  const newestMine = newest?.mine ?? false;

  // A conversation is read only as far as the parent has seen it: at the end of the list, with
  // the app in front, and no New messages pill waiting. Watched conversations are never marked.
  useEffect(() => {
    if (watching || unread === 0 || newestId === null) return;
    if (!atEndNow || unseen || !visible) return;
    void markRead({ id, up_to: newestId });
  }, [id, watching, unread, newestId, atEndNow, unseen, visible, markRead]);

  useFollowThread(id, newestId);

  useLayoutEffect(() => {
    const el = scroller.current;
    if (newestId === null || !el) return;
    const opening = seenNewest.current === null;
    seenNewest.current = newestId;
    if (opening || newestMine || atEnd.current) {
      el.scrollTop = el.scrollHeight;
      setEnd(true);
      setUnseen(false);
    } else {
      setUnseen(true);
    }
  }, [newestId, newestMine]);

  // Keep the end in view as the scroll area resizes under a parent who is at it.
  useEffect(() => {
    const el = scroller.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const watch = new ResizeObserver(() => {
      if (atEnd.current) el.scrollTop = el.scrollHeight;
    });
    watch.observe(el);
    return () => watch.disconnect();
  }, []);

  // Paging back adds height above the view; keep the same message under the parent's thumb.
  const anchor = useRef<{ height: number; top: number } | null>(null);
  const oldestId = thread?.messages[0]?.id ?? null;
  useLayoutEffect(() => {
    const el = scroller.current;
    const held = anchor.current;
    if (!el || !held) return;
    anchor.current = null;
    el.scrollTop = held.top + (el.scrollHeight - held.height);
  }, [oldestId]);

  const showOlder = async () => {
    const el = scroller.current;
    if (!thread?.nextBefore || !el) return;
    anchor.current = { height: el.scrollHeight, top: el.scrollTop };
    try {
      await loadOlder({ id, before: thread.nextBefore }).unwrap();
    } catch (error) {
      anchor.current = null;
      toast.error(refusal(error).message);
    }
  };

  const jumpToNewest = () => {
    const el = scroller.current;
    if (!el) return;
    if (typeof el.scrollTo === "function") el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    else el.scrollTop = el.scrollHeight;
    setEnd(true);
    setUnseen(false);
  };

  // A message on its way is part of the end of the list: bring it into view as it appears.
  const [pending, setPending] = useState<Pending | null>(null);
  const composer = useRef<ComposerHandle>(null);
  const pendingToken = pending?.token ?? null;
  useLayoutEffect(() => {
    const el = scroller.current;
    if (pendingToken === null || !el) return;
    el.scrollTop = el.scrollHeight;
    setEnd(true);
    setUnseen(false);
  }, [pendingToken]);

  const sendText = async (body: string, token: string): Promise<boolean> => {
    setPending({ token, body, failed: false, after: newestId });
    try {
      await send({ id, body, client_token: token }).unwrap();
      setPending(null);
      return true;
    } catch (error) {
      setPending((held) => ({ token, body, failed: true, after: held?.after ?? newestId }));
      toast.error(sendRefusalMessage(error));
      return false;
    }
  };

  if (isGone(rowError) || isGone(threadError)) {
    return (
      <div className="msg-detail-error" role="alert">
        This conversation isn&apos;t available any more. <Link to="/inbox?show=messages">Back to the inbox</Link>
      </div>
    );
  }

  const groups = groupByDay(thread?.messages ?? []);
  const childFirst = convo ? childFirstName(convo, children) : "";

  return (
    <section className="msg-thread" aria-label="Conversation">
      <ThreadHeader convo={convo} childFirst={childFirst} />

      <div className="msg-thread-main">
        <div ref={scroller} className="msg-thread-body" onScroll={onScroll}>
          {thread?.hasMore && (
            <button type="button" className="msg-older" onClick={showOlder} disabled={loadingOlder}>
              {loadingOlder ? "Loading…" : "Show earlier messages"}
            </button>
          )}
          {!thread && !threadError && (
            <div className="msg-thread-loading" role="status" aria-label="Loading messages" />
          )}
          {!thread && threadError && (
            <div className="msg-detail-error" role="alert">
              Messages can&apos;t be shown right now.{" "}
              <button type="button" onClick={() => refetch()}>
                Try again
              </button>
            </div>
          )}
          {thread && thread.messages.length === 0 && (
            <p className="msg-thread-empty">No messages yet. Say hello below.</p>
          )}
          {groups.map((group) => (
            <div key={group.key} className="msg-day">
              <p className="msg-day-heading">{group.heading}</p>
              {group.messages.map((message) => (
                <Bubble key={message.id} message={message} named={watching} ticks={ticks} />
              ))}
            </div>
          ))}
          {pending && !arrived(pending, thread?.messages ?? []) && (
            <PendingBubble
              pending={pending}
              ticks={ticks}
              onRetry={() => composer.current?.send()}
            />
          )}
        </div>
        {unseen && (
          <button type="button" className="msg-new-pill" onClick={jumpToNewest}>
            <ArrowDown size={15} aria-hidden="true" />
            New messages
          </button>
        )}
      </div>

      {convo &&
        !watching &&
        (convo.can_send ? (
          <Composer
            ref={composer}
            onEdit={() => setPending((held) => (held?.failed ? null : held))}
            scope={`reply-${id}`}
            onSend={sendText}
            label={`Message to ${convo.display_name || "staff"}`}
            placeholder="Write a message"
          />
        ) : (
          <div className="msg-composer msg-readonly" role="note">
            <Lock size={17} aria-hidden="true" />
            <p>{convo.read_only_reason || "You can read this conversation but not reply."}</p>
          </div>
        ))}
    </section>
  );
}

/**
 * The person on the other end, pinned above the messages, with the way back
 * to the list. While the conversation loads it shows the way back and a
 * placeholder, so the parent is never stranded.
 */
function ThreadHeader({ convo, childFirst }: { convo: Conversation | undefined; childFirst: string }) {
  const other = convo?.counterpart;
  const watching = convo?.kind === "PUPIL";
  return (
    <header className="msg-head">
      <Link to="/inbox?show=messages" className="msg-head-back" aria-label="Back to the inbox">
        <ArrowLeft size={20} aria-hidden="true" />
      </Link>
      {convo ? (
        <>
          <Initials name={other?.name ?? convo.display_name} />
          <div className="msg-head-text">
            <h2>{other?.name || convo.display_name || "School staff"}</h2>
            {other?.label && <p>{other.label}</p>}
            <p className="msg-head-about">
              {watching ? `${childFirst}'s conversation` : `About ${childFirst}`}
              {convo.child.class_name ? `, ${convo.child.class_name}` : ""}
            </p>
          </div>
        </>
      ) : (
        <div className="msg-head-loading" />
      )}
    </header>
  );
}

/** `after` is the newest message held when it was sent, to tell when the stored copy has arrived. */
type Pending = { token: string; body: string; failed: boolean; after: number | null };

/** What the parent's own message shows beside its time: a clock, one tick or two. */
function Ticks({ receipt, sending }: { receipt?: Receipt; sending?: boolean }) {
  if (sending) {
    return <Clock size={13} className="msg-tick" role="img" aria-label="Sending" />;
  }
  if (receipt?.state === "read") {
    return <CheckCheck size={15} className="msg-tick is-read" role="img" aria-label="Read" />;
  }
  return <Check size={15} className="msg-tick" role="img" aria-label="Sent" />;
}

/**
 * One message. The parent's own carry ticks while the conversation shows
 * receipts (`ticks`): one once the school has it, two once it has been read.
 * A message that came without a receipt counts as sent.
 */
function Bubble({ message, named, ticks }: { message: ThreadMessage; named: boolean; ticks: boolean }) {
  return (
    <div className={cn("msg-bubble-row", message.mine && "is-mine")}>
      <div className="msg-bubble">
        {named && !message.mine && message.sender && (
          <strong className="msg-bubble-name">{message.sender.name}</strong>
        )}
        <p className="msg-bubble-text">{message.body}</p>
        <div className="msg-bubble-foot">
          <time dateTime={message.sent_at}>{clockTime(new Date(message.sent_at))}</time>
          {ticks && message.mine && <Ticks receipt={message.receipt} />}
        </div>
      </div>
    </div>
  );
}

/**
 * The message the parent just sent, before the school has stored it. It shows
 * a clock while it goes, and when it fails a red line to tap, which presses
 * Send again on the same text and the same token (the text is still in the
 * box).
 */
function PendingBubble({
  pending,
  ticks,
  onRetry,
}: {
  pending: Pending;
  ticks: boolean;
  onRetry: () => void;
}) {
  return (
    <div className="msg-bubble-row is-mine">
      <div className={cn("msg-bubble", pending.failed && "is-failed")}>
        <p className="msg-bubble-text">{pending.body}</p>
        {pending.failed ? (
          <button type="button" className="msg-retry" onClick={onRetry} aria-label="Not sent">
            Not sent. Tap to retry.
          </button>
        ) : (
          <div className="msg-bubble-foot">{ticks && <Ticks sending />}</div>
        )}
      </div>
    </div>
  );
}

/** Whether the stored copy of a pending message is already in the thread, so it is not drawn twice. */
function arrived(pending: Pending, messages: ThreadMessage[]): boolean {
  return messages.some((m) => m.mine && m.id > (pending.after ?? 0));
}

type DayGroup = { key: string; heading: string; messages: ThreadMessage[] };

function groupByDay(messages: ThreadMessage[]): DayGroup[] {
  const groups: DayGroup[] = [];
  for (const message of messages) {
    const key = dayKey(message.sent_at);
    const last = groups.at(-1);
    if (last && last.key === key) last.messages.push(message);
    else groups.push({ key, heading: dayHeading(message.sent_at), messages: [message] });
  }
  return groups;
}
