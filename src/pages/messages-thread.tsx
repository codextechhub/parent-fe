import { useEffect, useLayoutEffect, useRef } from "react";
import { ArrowLeft, Lock } from "lucide-react";
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
  type ThreadMessage,
} from "@/redux/services/messages-api";
import { refusal } from "@/redux/services/portal-api";

import { Composer } from "./messages-composer";
import { Initials } from "./messages-row";

/** How often an open conversation reads again, in ms, while the app is in view. */
const OPEN_POLL_MS = 20_000;

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
  } = useThreadQuery(id, {
    pollingInterval: OPEN_POLL_MS,
    skipPollingIfUnfocused: true,
    refetchOnFocus: true,
    refetchOnReconnect: true,
  });
  const [markRead] = useMarkConversationReadMutation();
  const [send] = useSendMessageMutation();
  const [loadOlder, { isLoading: loadingOlder }] = useLoadOlderMessagesMutation();
  const children = useAppSelector((s) => s.auth.me?.children ?? []);

  const watching = convo?.kind === "PUPIL";
  const unread = convo?.unread_count ?? 0;

  useEffect(() => {
    if (watching || unread === 0) return;
    void markRead(id);
  }, [id, watching, unread, markRead]);

  // Scroll to the newest message on opening, after sending, or when the parent is already near the end.
  const seenNewest = useRef<number | null>(null);
  const end = useRef<HTMLDivElement>(null);
  const newest = thread?.messages.at(-1);
  const newestId = newest?.id ?? null;
  const newestMine = newest?.mine ?? false;
  const headerShown = convo !== undefined;
  useEffect(() => {
    // Wait for the header: it sets the height everything below it sits at.
    if (newestId === null || !headerShown) return;
    const opening = seenNewest.current === null;
    const root = document.documentElement;
    const nearEnd = window.innerHeight + window.scrollY >= root.scrollHeight - 240;
    if (opening || newestMine || nearEnd) end.current?.scrollIntoView({ block: "nearest" });
    seenNewest.current = newestId;
  }, [newestId, newestMine, headerShown]);

  // Paging back adds height above the view; keep the same message under the parent's thumb.
  const anchor = useRef<{ height: number; y: number } | null>(null);
  const oldestId = thread?.messages[0]?.id ?? null;
  useLayoutEffect(() => {
    if (!anchor.current) return;
    const { height, y } = anchor.current;
    anchor.current = null;
    window.scrollTo({ top: y + (document.documentElement.scrollHeight - height) });
  }, [oldestId]);

  const showOlder = async () => {
    if (!thread?.nextBefore) return;
    anchor.current = { height: document.documentElement.scrollHeight, y: window.scrollY };
    try {
      await loadOlder({ id, before: thread.nextBefore }).unwrap();
    } catch (error) {
      anchor.current = null;
      toast.error(refusal(error).message);
    }
  };

  const sendText = async (body: string, token: string): Promise<boolean> => {
    try {
      await send({ id, body, client_token: token }).unwrap();
      return true;
    } catch (error) {
      toast.error(sendRefusalMessage(error));
      return false;
    }
  };

  if (isGone(rowError) || isGone(threadError)) {
    return (
      <div className="msg-detail-error" role="alert">
        This conversation isn&apos;t available any more. <Link to="/messages">Back to messages</Link>
      </div>
    );
  }

  const groups = groupByDay(thread?.messages ?? []);
  const childFirst = convo ? childFirstName(convo, children) : "";

  return (
    <section className="msg-thread" aria-label="Conversation">
      <Link to="/messages" className="msg-detail-back">
        <ArrowLeft size={17} aria-hidden="true" />
        All messages
      </Link>
      {convo ? <ThreadHeader convo={convo} childFirst={childFirst} /> : <div className="msg-head-loading" />}

      <div className="msg-thread-body">
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
              <Bubble key={message.id} message={message} named={watching} />
            ))}
          </div>
        ))}
      </div>
      <div ref={end} className="msg-end" aria-hidden="true" />

      {convo &&
        (convo.can_send ? (
          <Composer
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

function ThreadHeader({ convo, childFirst }: { convo: Conversation; childFirst: string }) {
  const other = convo.counterpart;
  const watching = convo.kind === "PUPIL";
  return (
    <header className="msg-head">
      <Initials name={other?.name ?? convo.display_name} />
      <div className="msg-head-text">
        <h2>{other?.name || convo.display_name || "School staff"}</h2>
        {other?.label && <p>{other.label}</p>}
        <p className="msg-head-about">
          {watching ? `${childFirst}'s conversation` : `About ${childFirst}`}
          {convo.child.class_name ? `, ${convo.child.class_name}` : ""}
        </p>
      </div>
    </header>
  );
}

function Bubble({ message, named }: { message: ThreadMessage; named: boolean }) {
  return (
    <div className={cn("msg-bubble-row", message.mine && "is-mine")}>
      <div className="msg-bubble">
        {named && !message.mine && message.sender && (
          <strong className="msg-bubble-name">{message.sender.name}</strong>
        )}
        <p className="msg-bubble-text">{message.body}</p>
        <time dateTime={message.sent_at}>{clockTime(new Date(message.sent_at))}</time>
      </div>
    </div>
  );
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
