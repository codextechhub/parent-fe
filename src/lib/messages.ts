import { useSyncExternalStore } from "react";

import { formatTimestampDate } from "@/lib/format";
import type { Conversation } from "@/redux/services/messages-api";
import { refusal } from "@/redux/services/portal-api";

/** The longest message the school accepts, in characters after trimming. */
export const BODY_MAX = 4000;

/** Said when the send limit is reached and the server sent no sentence of its own. */
export const SENDING_TOO_FAST = "You are sending messages too quickly. Wait a moment and try again.";

/**
 * The sentence for a send, start or reply the school refused.
 *
 * The school words its own refusals, the send limit among them (429,
 * `MESSAGE_RATE_LIMITED`), and that sentence is shown as it stands. A 429 with
 * no sentence of its own gets the same wording here, so a parent is told to
 * wait rather than that the message could not be saved. The text and its
 * token are untouched either way: the composer keeps both when a send fails,
 * so the next tap sends the same words once.
 */
export function sendRefusalMessage(error: unknown): string {
  const failed = error as { status?: unknown; data?: { message?: unknown } } | undefined;
  const said = typeof failed?.data?.message === "string" && failed.data.message.trim() !== "";
  if (failed?.status === 429 && !said) return SENDING_TOO_FAST;
  return refusal(error).message;
}

/**
 * A fresh token for one send.
 *
 * `crypto.randomUUID` needs a secure context; the fallback builds a version 4
 * UUID from random bytes so a plain-HTTP preview still sends.
 */
export function newClientToken(): string {
  const c = globalThis.crypto;
  if (typeof c?.randomUUID === "function") return c.randomUUID();
  const bytes = new Uint8Array(16);
  c.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0"));
  return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex.slice(6, 8).join("")}-${hex
    .slice(8, 10)
    .join("")}-${hex.slice(10).join("")}`;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** "2:05 pm" on the reader's own clock. */
export function clockTime(at: Date): string {
  const hours = at.getHours();
  const minutes = String(at.getMinutes()).padStart(2, "0");
  return `${hours % 12 === 0 ? 12 : hours % 12}:${minutes} ${hours < 12 ? "am" : "pm"}`;
}

function startOfDay(at: Date): number {
  return new Date(at.getFullYear(), at.getMonth(), at.getDate()).getTime();
}

const DAY = 24 * 60 * 60 * 1000;

/**
 * When a conversation last moved, as a list row words it: the time today,
 * "Yesterday", the weekday within the last week, else the date.
 */
export function listTime(value: string, now: Date = new Date()): string {
  const at = new Date(value);
  if (Number.isNaN(at.getTime())) return "";
  const ago = Math.round((startOfDay(now) - startOfDay(at)) / DAY);
  if (ago <= 0) return clockTime(at);
  if (ago === 1) return "Yesterday";
  if (ago < 7) return WEEKDAYS[at.getDay()];
  return formatTimestampDate(value);
}

/** The heading a day's messages sit under in a thread. */
export function dayHeading(value: string, now: Date = new Date()): string {
  const at = new Date(value);
  if (Number.isNaN(at.getTime())) return "";
  const ago = Math.round((startOfDay(now) - startOfDay(at)) / DAY);
  if (ago <= 0) return "Today";
  if (ago === 1) return "Yesterday";
  return `${WEEKDAYS[at.getDay()]}, ${formatTimestampDate(value)}`;
}

/** The calendar day a timestamp falls on, for grouping a thread. */
export function dayKey(value: string): string {
  const at = new Date(value);
  return Number.isNaN(at.getTime()) ? "" : `${at.getFullYear()}-${at.getMonth()}-${at.getDate()}`;
}

/** The first word of a full name. */
export function firstName(full: string): string {
  return full.trim().split(/\s+/)[0] ?? "";
}

/** The child's first name: from the parent's own list where it is there, else the row's full name. */
export function childFirstName(
  convo: Conversation,
  children: { id: number; first_name: string }[],
): string {
  return children.find((c) => c.id === convo.child.id)?.first_name ?? firstName(convo.child.name);
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

/** Whether the browser reports a connection, kept current as it changes. */
export function useOnline(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );
}
