import { useEffect, useRef, useSyncExternalStore } from "react";

import { usePollNewerMessagesMutation } from "@/redux/services/messages-api";

/** How often an open conversation asks for newer messages and ticks, in ms, while the app is in front. */
export const FOLLOW_MS = 10_000;

/** The most pages one catch-up asks for, so a long absence cannot loop. */
const MAX_PAGES = 5;

function subscribeVisibility(notify: () => void): () => void {
  document.addEventListener("visibilitychange", notify);
  return () => document.removeEventListener("visibilitychange", notify);
}

/** Whether the app is in front, kept current as the parent switches away and back. */
export function usePageVisible(): boolean {
  return useSyncExternalStore(
    subscribeVisibility,
    () => document.visibilityState === "visible",
    () => true,
  );
}

/**
 * Keeps an open conversation current: newer messages, and whether the
 * parent's own have been read.
 *
 * While the conversation is open and the app is in front it asks for what
 * came after `newestId` every ten seconds, and once more on returning to the
 * app (the page becoming visible, the window regaining focus). It stops when
 * the app is hidden or the conversation closes, and does nothing before the
 * first page of messages is held (`newestId` null). A catch-up that finds more
 * than one page waiting asks again, up to a few pages, and a request still in
 * flight is never doubled. A failed request, offline included, is let go: the
 * next tick asks again.
 *
 * It reads a watched child's conversation the same way, for its new
 * messages; the backend sends no ticks for one, and the thread draws none.
 */
export function useFollowThread(id: number, newestId: number | null): void {
  const [pollNewer] = usePollNewerMessagesMutation();
  const visible = usePageVisible();
  const latest = useRef(newestId);
  const busy = useRef(false);
  const wasHidden = useRef(false);
  const ready = newestId !== null;

  useEffect(() => {
    latest.current = newestId;
  }, [newestId]);

  useEffect(() => {
    if (!visible) {
      wasHidden.current = true;
      return;
    }
    if (!ready) return;

    const catchUp = async () => {
      if (busy.current || latest.current === null) return;
      busy.current = true;
      try {
        let after = latest.current;
        for (let page = 0; page < MAX_PAGES; page += 1) {
          const answer = await pollNewer({ id, after }).unwrap();
          after = answer.newest;
          if (!answer.more) break;
        }
      } catch {
        // Offline or refused: the next tick asks again.
      } finally {
        busy.current = false;
      }
    };

    if (wasHidden.current) {
      wasHidden.current = false;
      void catchUp();
    }
    const timer = window.setInterval(() => void catchUp(), FOLLOW_MS);
    const onFocus = () => void catchUp();
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [id, visible, ready, pollNewer]);
}
