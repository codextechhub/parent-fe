import { useRef, useState, type ChangeEvent, type KeyboardEvent } from "react";
import { SendHorizontal } from "lucide-react";

import { BODY_MAX, newClientToken, useOnline } from "@/lib/messages";
import { cn } from "@/lib/utils";

/** Past this many characters the counter shows, so it never nags a short message. */
const COUNTER_FROM = 3500;
/** The tallest the box grows before it scrolls, in px. */
const MAX_HEIGHT = 144;

/**
 * The box a parent writes a message in, with its Send button.
 *
 * `onSend` returns true once the message is stored; the box then empties.
 * A refused or failed send leaves the text where it is. The `client_token`
 * belongs to the text and `scope`: pressing Send again on the same text,
 * after a failure or a double tap, hands the backend the same token, which
 * answers the stored message instead of writing a second one. Changing the
 * text starts a new token.
 *
 * Send waits for a connection: offline, the text stays and the button says
 * so rather than failing. Command or Control plus Enter sends; a plain Enter
 * adds a line, which is what a phone keyboard expects.
 */
export function Composer({
  onSend,
  scope,
  label,
  placeholder,
  sendLabel = "Send",
  canSend = true,
  className,
}: {
  onSend: (text: string, token: string) => Promise<boolean>;
  /** What else makes two sends the same send, such as the child and member of staff chosen. */
  scope: string;
  label: string;
  placeholder: string;
  sendLabel?: string;
  /** False when something else on the screen has to be chosen first. */
  canSend?: boolean;
  className?: string;
}) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const online = useOnline();
  const area = useRef<HTMLTextAreaElement>(null);
  const attempt = useRef<{ key: string; token: string } | null>(null);
  const inFlight = useRef(false);

  const trimmed = text.trim();
  const length = trimmed.length;
  const tooLong = length > BODY_MAX;
  const ready = canSend && length > 0 && !tooLong && online && !sending;

  const grow = (el: HTMLTextAreaElement) => {
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT)}px`;
  };

  const change = (event: ChangeEvent<HTMLTextAreaElement>) => {
    setText(event.target.value);
    grow(event.target);
  };

  const send = async () => {
    if (!ready || inFlight.current) return;
    inFlight.current = true;
    setSending(true);
    const key = `${scope}\n${trimmed}`;
    if (attempt.current?.key !== key) attempt.current = { key, token: newClientToken() };
    try {
      const stored = await onSend(trimmed, attempt.current.token);
      if (stored) {
        attempt.current = null;
        setText("");
        if (area.current) area.current.style.height = "";
      }
    } finally {
      inFlight.current = false;
      setSending(false);
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      void send();
    }
  };

  return (
    <div className={cn("msg-composer", className)}>
      {!online && (
        <p className="msg-composer-note" role="status">
          You are offline. Your message can be sent when you reconnect.
        </p>
      )}
      <div className="msg-composer-row">
        <textarea
          ref={area}
          value={text}
          rows={1}
          onChange={change}
          onKeyDown={onKeyDown}
          aria-label={label}
          aria-invalid={tooLong}
          placeholder={placeholder}
          className="msg-composer-input"
        />
        <button
          type="button"
          className="msg-send"
          onClick={() => void send()}
          disabled={!ready}
          aria-label={sendLabel}
        >
          <SendHorizontal size={19} aria-hidden="true" />
          <span>{sending ? "Sending…" : sendLabel}</span>
        </button>
      </div>
      {(length >= COUNTER_FROM || tooLong) && (
        <p className={cn("msg-composer-count", tooLong && "is-over")} aria-live="polite">
          {length.toLocaleString("en-NG")} of {BODY_MAX.toLocaleString("en-NG")} characters
          {tooLong ? ". Shorten the message to send it." : ""}
        </p>
      )}
    </div>
  );
}
