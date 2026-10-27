import { Navigate, useLocation, useParams } from "react-router";

import { PageShell } from "@/components/layout/page-shell";
import { DetailBar } from "@/components/layout/screen";

import "./messages.css";
import { NewMessage } from "./messages-new";
import { ThreadView } from "./messages-thread";

/** The conversation id in the address, or null when it is missing or not a whole number. */
function conversationId(raw: string | undefined): number | null {
  const id = raw ? Number(raw) : null;
  return id !== null && Number.isSafeInteger(id) && id > 0 ? id : null;
}

/**
 * An open conversation with the school's staff, or a new message, each a
 * screen of its own at every size. The list of conversations is the
 * Inbox's, so an address with neither goes there; a message alert opens
 * `/messages/<id>`.
 *
 * An open conversation (`is-fixed`) fills the height the app shell gives it
 * rather than growing with its messages: the person stays at the top with
 * the way back to the Inbox, the box at the bottom, and only the messages
 * between them scroll. A new message sits under a back bar of its own.
 */
export function MessagesPage() {
  const { pathname } = useLocation();
  const openId = conversationId(useParams().id);
  if (pathname === "/messages/new") {
    return (
      <PageShell className="msg-page msg-new-page">
        <DetailBar title="New message" back="/inbox?show=messages" backLabel="Back to the inbox" />
        <div className="msg-wrap msg-new-wrap"><NewMessage /></div>
      </PageShell>
    );
  }
  if (openId === null) return <Navigate to="/inbox?show=messages" replace />;
  return (
    <PageShell className="msg-page is-fixed">
      <div className="msg-wrap">
        <ThreadView key={openId} id={openId} />
      </div>
    </PageShell>
  );
}
