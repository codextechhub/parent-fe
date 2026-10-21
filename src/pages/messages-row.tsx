import { Link } from "react-router";

import { firstName, listTime } from "@/lib/messages";
import { cn } from "@/lib/utils";
import type { Conversation } from "@/redux/services/messages-api";

/** A person's initials on a tinted disc: the parent's staff have no photographs here. */
export function Initials({ name, className }: { name: string; className?: string }) {
  const letters = name
    .replace(/^(mr|mrs|ms|miss|dr|prof|engr|chief)\.?\s+/i, "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");
  return (
    <span className={cn("msg-avatar", className)} aria-hidden="true">
      {letters || "?"}
    </span>
  );
}

/**
 * One conversation in the list.
 *
 * A conversation of the parent's own shows the member of staff, their label
 * ("Class teacher, JSS1 A"), the child it is about (only when the parent has
 * more than one), the last words and an unread count. A watched pupil
 * conversation says whose it is and that it cannot be answered; it carries no
 * unread count because opening it changes nothing for anyone.
 */
export function ConversationRow({
  convo,
  childFirst,
  showChild,
  selected,
}: {
  convo: Conversation;
  childFirst: string;
  showChild: boolean;
  selected: boolean;
}) {
  const other = convo.counterpart;
  const name = other?.name || convo.display_name || "School staff";
  const watching = convo.kind === "PUPIL";
  const last = convo.last_message;
  const preview = last
    ? watching
      ? `${firstName(last.sender_name)}: ${last.preview}`
      : `${last.mine ? "You: " : ""}${last.preview}`
    : "No messages yet";
  const unread = convo.unread_count;
  return (
    <li className={cn("msg-row", unread > 0 && "is-unread", selected && "is-selected")}>
      <Link
        to={`/messages/${convo.id}`}
        aria-label={
          watching
            ? `Open ${childFirst}'s conversation with ${name}`
            : `Open conversation with ${name}${unread ? `, ${unread} unread` : ""}`
        }
      >
        <Initials name={name} />
        <span className="msg-row-main">
          <span className="msg-row-top">
            <strong className="msg-row-name">{name}</strong>
            {last && <time dateTime={last.sent_at}>{listTime(last.sent_at)}</time>}
          </span>
          {watching ? (
            <span className="msg-row-watch">
              {childFirst}&apos;s conversation with {name}. You can read it but not reply.
            </span>
          ) : (
            other?.label && <span className="msg-row-label">{other.label}</span>
          )}
          <span className="msg-row-bottom">
            <span className="msg-row-preview">{preview}</span>
            {unread > 0 && (
              <span className="msg-unread" aria-hidden="true">
                {unread > 99 ? "99+" : unread}
              </span>
            )}
          </span>
          {!watching && showChild && <span className="msg-row-child">About {childFirst}</span>}
        </span>
      </Link>
    </li>
  );
}
