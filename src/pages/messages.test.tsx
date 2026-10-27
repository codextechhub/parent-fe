import { act } from "react";
import { createRoot } from "react-dom/client";
import { Provider } from "react-redux";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import { configureStore } from "@reduxjs/toolkit";
import { Toaster } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { setAccessToken } from "@/auth/access-token";
import { _resetCsrfCache } from "@/auth/csrf";
import { _resetRefreshForTests } from "@/auth/refresh";
import { authReducer, meLoaded, type MeData } from "@/redux/features/auth-slice";
import { connectivityReducer } from "@/redux/features/connectivity-slice";
import { baseApi } from "@/redux/services/base-api";
import "@/redux/services/portal-api";
import "@/redux/services/messages-api";

import { MessagesPage } from "./messages";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const child = (id: number, first: string, cls: string) => ({
  id,
  first_name: first,
  full_name: `${first} Okafor`,
  initials: first[0],
  photo_url: "",
  admission_number: "",
  class_name: cls,
  relationship: "Mother",
});

const ME: MeData = {
  parent: { first_name: "Patricia", full_name: "Patricia Okafor", initials: "PO" },
  school: { name: "Lagoon View", logo_url: "" },
  show_branch: false,
  session: null,
  term: null,
  children: [child(1, "Tobi", "JSS1 A"), child(2, "Adaeze", "Primary 4")],
};
const ONE_CHILD: MeData = { ...ME, children: [ME.children[0]] };

const sender = (name: string, mine: boolean) => ({ user_id: mine ? 10 : 20, name, mine });

const FAMILY_ROW = {
  id: 41,
  kind: "FAMILY",
  kind_label: "Parent",
  display_name: "Mrs Funke Bello",
  counterpart: { user_id: 20, name: "Mrs Funke Bello", label: "Class teacher, JSS1 A" },
  child: { id: 1, name: "Tobi Okafor", class_name: "JSS1 A" },
  last_message: {
    id: 903,
    preview: "Tobi was great today",
    sender_name: "Mrs Funke Bello",
    sent_at: "2026-10-21T08:00:00Z",
    mine: false,
  },
  last_activity_at: "2026-10-21T08:00:00Z",
  unread_count: 2,
  read_only: false,
  can_send: true,
  read_only_reason: "",
};

const WATCHED_ROW = {
  id: 52,
  kind: "PUPIL",
  kind_label: "Pupil",
  display_name: "Mr Kunle Adebayo",
  counterpart: { user_id: 21, name: "Mr Kunle Adebayo", label: "Mathematics" },
  child: { id: 2, name: "Adaeze Okafor", class_name: "Primary 4" },
  last_message: {
    id: 950,
    preview: "Please bring your workbook",
    sender_name: "Mr Kunle Adebayo",
    sent_at: "2026-10-20T08:00:00Z",
    mine: false,
  },
  last_activity_at: "2026-10-20T08:00:00Z",
  unread_count: 0,
  read_only: true,
  can_send: false,
  read_only_reason: "Adaeze's conversation. You can read it but not reply.",
};

const message = (id: number, body: string, mine: boolean, who = "Mrs Funke Bello") => ({
  id,
  body,
  sender: sender(mine ? "Patricia Okafor" : who, mine),
  sent_at: `2026-10-21T0${id % 10}:00:00Z`,
  mine,
});

const TOO_FAST = "You are sending messages too quickly. Wait a moment and try again.";

type Opts = {
  rows?: unknown[];
  messages?: Record<number, ReturnType<typeof message>[]>;
  /** Status the first send answers, to exercise a retry. */
  firstSend?: number;
  canStart?: boolean;
  contacts?: { user_id: number; name: string; label: string }[];
  /** Whether the conversation detail says to draw ticks. */
  receipts?: boolean;
  /** Ids of the parent's messages the other person has read; tests add to it. */
  readIds?: Set<number>;
  /** Milliseconds the first send takes to answer, to catch the clock. */
  sendDelay?: number;
};

const json = (data: unknown, status = 200, extra: Record<string, unknown> = {}) =>
  new Response(JSON.stringify({ success: status < 400, message: "ok", data, ...extra }), {
    status,
    headers: { "content-type": "application/json" },
  });

function server(opts: Opts = {}) {
  const rows = (opts.rows ?? [FAMILY_ROW, WATCHED_ROW]) as (typeof FAMILY_ROW)[];
  const threads: Record<number, ReturnType<typeof message>[]> = opts.messages ?? {
    41: [message(901, "Hello", false), message(902, "Hi, thanks", true), message(903, "Tobi was great today", false)],
    52: [message(950, "Please bring your workbook", false, "Mr Kunle Adebayo")],
  };
  const sends: { id: number; body: string; client_token: string }[] = [];
  const reads: number[] = [];
  const readUpTo: unknown[] = [];
  const polls: number[] = [];
  type Sent = ReturnType<typeof message> & { receipt?: { state: string; read_count: number; recipient_count: number } };
  const receiptOf = (m: ReturnType<typeof message>): Sent =>
    opts.receipts && m.mine
      ? { ...m, receipt: { state: opts.readIds?.has(m.id) ? "read" : "sent", read_count: 1, recipient_count: 1 } }
      : m;
  const starts: unknown[] = [];
  let firstSend = opts.firstSend;
  const fn = vi.fn(async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
    const request = input instanceof Request ? input : null;
    const url = new URL(request ? request.url : String(input), "http://test.local");
    const method = (request?.method ?? init?.method ?? "GET").toUpperCase();
    const path = url.pathname;
    const body = request ? await request.clone().json().catch(() => ({})) : JSON.parse(String(init?.body ?? "{}"));

    if (path.endsWith("/messages/unread-count/")) return json({ total: 2 });
    if (path.endsWith("/messages/contacts/")) {
      return new Response(
        JSON.stringify({
          success: true,
          data: opts.contacts ?? [
            { user_id: 20, name: "Mrs Funke Bello", label: "Class teacher, JSS1 A" },
            { user_id: 30, name: "Mr Segun Alade", label: "School office" },
          ],
          can_start: opts.canStart ?? true,
          can_start_reason: opts.canStart === false ? "Messaging with parents is switched off at this school." : "",
          pagination: { next: null },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }
    const messagesOf = path.match(/\/conversations\/(\d+)\/messages\/$/);
    if (messagesOf) {
      const id = Number(messagesOf[1]);
      if (method === "POST") {
        sends.push({ id, body: body.body, client_token: body.client_token });
        if (firstSend) {
          const status = firstSend;
          firstSend = undefined;
          return json(
            null,
            status,
            status === 429
              ? { message: TOO_FAST, error: { code: "MESSAGE_RATE_LIMITED", detail: { retry_after: 12 } } }
              : { message: "The school could not be reached." },
          );
        }
        if (opts.sendDelay) await new Promise((r) => setTimeout(r, opts.sendDelay));
        const stored = message(990 + sends.length, body.body, true);
        threads[id] = [...(threads[id] ?? []), stored];
        return json(receiptOf(stored), 201);
      }
      const after = url.searchParams.get("after");
      if (after !== null) {
        polls.push(Number(after));
        const newer = (threads[id] ?? []).filter((m) => m.id > Number(after)).sort((a, b) => a.id - b.id);
        return json({
          results: newer.map(receiptOf),
          has_more: false,
          ...(opts.receipts
            ? {
                receipts: (threads[id] ?? [])
                  .filter((m) => m.mine)
                  .map((m) => ({ id: m.id, ...receiptOf(m).receipt })),
              }
            : {}),
        });
      }
      const before = Number(url.searchParams.get("before") ?? 0);
      const limit = Number(url.searchParams.get("limit") ?? 50);
      const all = [...(threads[id] ?? [])].sort((a, b) => b.id - a.id).filter((m) => !before || m.id < before);
      const page = all.slice(0, limit);
      return json({
        results: page.map(receiptOf),
        has_more: all.length > limit,
        next_before: all.length > limit ? page[page.length - 1].id : null,
      });
    }
    const read = path.match(/\/conversations\/(\d+)\/read\/$/);
    if (read) {
      reads.push(Number(read[1]));
      readUpTo.push(body.up_to);
      return json({ conversation: Number(read[1]), unread_count: 0 });
    }
    const one = path.match(/\/conversations\/(\d+)\/$/);
    if (one) {
      const row = rows.find((r) => r.id === Number(one[1]));
      return row ? json({ ...row, receipts: row.kind === "PUPIL" ? false : (opts.receipts ?? false) }) : json(null, 404);
    }
    if (path.endsWith("/messages/conversations/")) {
      if (method === "POST") {
        starts.push(body);
        const row = { ...FAMILY_ROW, id: 77, unread_count: 0 };
        rows.push(row);
        threads[77] = [message(991, body.body, true)];
        return json({ conversation: row, message: threads[77][0] }, 201);
      }
      return json(rows, 200, {
        pagination: { currentPage: 1, pageSize: 100, totalItems: rows.length, totalPages: 1, next: null, previous: null },
        unread_count: 2,
      });
    }
    return new Response("{}", { status: 200 });
  });
  return { fn, sends, reads, readUpTo, polls, starts };
}

function Where() {
  return <output data-testid="where">{useLocation().pathname}</output>;
}

function render(path: string, fetchImpl: ReturnType<typeof server>["fn"], me: MeData = ME) {
  globalThis.fetch = fetchImpl as unknown as typeof fetch;
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  const store = configureStore({
    reducer: {
      [baseApi.reducerPath]: baseApi.reducer,
      auth: authReducer,
      connectivity: connectivityReducer,
    },
    middleware: (gd) => gd().concat(baseApi.middleware),
  });
  store.dispatch(meLoaded(me));
  act(() =>
    root.render(
      <Provider store={store}>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/messages" element={<MessagesPage />} />
            <Route path="/messages/new" element={<MessagesPage />} />
            <Route path="/messages/:id" element={<MessagesPage />} />
          </Routes>
          <Where />
          <Toaster />
        </MemoryRouter>
      </Provider>,
    ),
  );
  return { container, root, store };
}

let last: ReturnType<typeof render> | null = null;
const settle = (ms = 40) => act(() => new Promise((r) => setTimeout(r, ms)));

beforeEach(() => {
  document.cookie = "csrftoken=abc; path=/";
  _resetCsrfCache();
  _resetRefreshForTests();
  setAccessToken("stale");
  window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
  const happy = (window as unknown as { happyDOM?: { setURL: (u: string) => void } }).happyDOM;
  happy?.setURL("http://lagoon-view.localhost:5176/parent/");
});
afterEach(() => {
  if (last) {
    act(() => last!.root.unmount());
    last.container.remove();
    last = null;
  }
});

function typeInto(el: HTMLTextAreaElement, text: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!;
  act(() => {
    setter.call(el, text);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

const button = (container: HTMLElement, label: RegExp) =>
  Array.from(container.querySelectorAll("button")).find((b) => label.test(b.textContent ?? "") || label.test(b.getAttribute("aria-label") ?? "")) as HTMLButtonElement | undefined;

describe("The old list address", () => {
  it("opens the Inbox on Messages, where the conversations are listed now", async () => {
    const s = server();
    last = render("/messages", s.fn);
    await settle();
    expect(last.container.querySelector('[data-testid="where"]')?.textContent).toBe("/inbox");
  });
});

describe("Open conversation", () => {
  it("reads oldest to newest and marks a conversation of the parent's own read", async () => {
    const s = server();
    last = render("/messages/41", s.fn);
    await settle(80);
    const bubbles = Array.from(last.container.querySelectorAll(".msg-bubble-text")).map((n) => n.textContent);
    expect(bubbles).toEqual(["Hello", "Hi, thanks", "Tobi was great today"]);
    expect(s.reads).toEqual([41]);
    expect(last.container.querySelector("textarea")).toBeTruthy();
  });

  it("shows no composer and no read-only note on a watched conversation, and never marks it read", async () => {
    const s = server();
    last = render("/messages/52", s.fn);
    await settle(80);
    expect(last.container.textContent).not.toContain("You can read it but not reply");
    expect(last.container.textContent).toContain("Adaeze's conversation, Primary 4");
    expect(last.container.querySelector("textarea")).toBeNull();
    expect(last.container.querySelector(".msg-composer")).toBeNull();
    expect(last.container.querySelector(".msg-readonly")).toBeNull();
    expect(s.reads).toEqual([]);
  });

  it("still shows the reason when a family conversation cannot be written in", async () => {
    const closed = {
      ...FAMILY_ROW,
      unread_count: 0,
      can_send: false,
      read_only: true,
      read_only_reason: "Mrs Funke Bello has left the school.",
    };
    const s = server({ rows: [closed, WATCHED_ROW] });
    last = render("/messages/41", s.fn);
    await settle(80);
    expect(last.container.textContent).toContain("Mrs Funke Bello has left the school.");
    expect(last.container.querySelector(".msg-readonly")).toBeTruthy();
    expect(last.container.querySelector("textarea")).toBeNull();
  });

  it("sends once for a double tap", async () => {
    const s = server();
    last = render("/messages/41", s.fn);
    await settle(80);
    typeInto(last.container.querySelector("textarea")!, "See you at pickup");
    const send = button(last.container, /^Send$/)!;
    await act(async () => {
      send.click();
      send.click();
      await new Promise((r) => setTimeout(r, 80));
    });
    expect(s.sends).toHaveLength(1);
    expect(s.sends[0].body).toBe("See you at pickup");
    expect(last.container.textContent).toContain("See you at pickup");
    expect((last.container.querySelector("textarea") as HTMLTextAreaElement).value).toBe("");
  });

  it("reuses the same token when the same text is sent again after a failure", async () => {
    const s = server({ firstSend: 500 });
    last = render("/messages/41", s.fn);
    await settle(80);
    const box = last.container.querySelector("textarea")!;
    typeInto(box, "Running late");
    await act(async () => {
      button(last!.container, /^Send$/)!.click();
      await new Promise((r) => setTimeout(r, 80));
    });
    // The failed text stays in the box for another try.
    expect((box as HTMLTextAreaElement).value).toBe("Running late");
    await act(async () => {
      button(last!.container, /^Send$/)!.click();
      await new Promise((r) => setTimeout(r, 80));
    });
    expect(s.sends).toHaveLength(2);
    expect(s.sends[1].client_token).toBe(s.sends[0].client_token);
    // A different text is a different send.
    typeInto(last.container.querySelector("textarea")!, "Another thing");
    await act(async () => {
      button(last!.container, /^Send$/)!.click();
      await new Promise((r) => setTimeout(r, 80));
    });
    expect(s.sends[2].client_token).not.toBe(s.sends[0].client_token);
  });

  it("says the send limit in the school's words and lets the same text go again on the next tap", async () => {
    const s = server({ firstSend: 429 });
    last = render("/messages/41", s.fn);
    await settle(80);
    const box = last.container.querySelector("textarea")!;
    typeInto(box, "Running late");
    await act(async () => {
      button(last!.container, /^Send$/)!.click();
      await new Promise((r) => setTimeout(r, 80));
    });
    expect(document.body.textContent).toContain(TOO_FAST);
    expect((box as HTMLTextAreaElement).value).toBe("Running late");
    expect(button(last.container, /^Send$/)!.disabled).toBe(false);

    await act(async () => {
      button(last!.container, /^Send$/)!.click();
      await new Promise((r) => setTimeout(r, 80));
    });
    expect(s.sends).toHaveLength(2);
    expect(s.sends[1].client_token).toBe(s.sends[0].client_token);
    expect((box as HTMLTextAreaElement).value).toBe("");
  });

  it("refuses a message over 4000 characters before it leaves the phone", async () => {
    const s = server();
    last = render("/messages/41", s.fn);
    await settle(80);
    typeInto(last.container.querySelector("textarea")!, "a".repeat(4001));
    expect(button(last.container, /^Send$/)!.disabled).toBe(true);
    expect(last.container.textContent).toContain("4,001 of 4,000 characters");
    typeInto(last.container.querySelector("textarea")!, "a".repeat(4000));
    expect(button(last.container, /^Send$/)!.disabled).toBe(false);
  });

  it("pages back through older messages with the cursor", async () => {
    const many = Array.from({ length: 60 }, (_, i) => message(100 + i, `Message ${100 + i}`, i % 2 === 0));
    const s = server({ messages: { 41: many } });
    last = render("/messages/41", s.fn);
    await settle(80);
    expect(last.container.querySelectorAll(".msg-bubble-text")).toHaveLength(50);
    await act(async () => {
      button(last!.container, /Show earlier messages/)!.click();
      await new Promise((r) => setTimeout(r, 80));
    });
    const texts = Array.from(last.container.querySelectorAll(".msg-bubble-text")).map((n) => n.textContent);
    expect(texts).toHaveLength(60);
    expect(texts[0]).toBe("Message 100");
    expect(texts[59]).toBe("Message 159");
    expect(button(last.container, /Show earlier messages/)).toBeUndefined();
  });

  it("says the conversation is gone for another family's id", async () => {
    const s = server();
    last = render("/messages/999", s.fn);
    await settle(80);
    expect(last.container.textContent).toContain("isn't available any more");
  });
});

describe("New message", () => {
  it("chooses the child, then the staff, then starts and opens the conversation", async () => {
    const s = server();
    last = render("/messages/new", s.fn);
    await settle(80);
    const text = last.container.textContent ?? "";
    expect(text).toContain("Which child is it about?");
    expect(text).toContain("Class teacher, JSS1 A");
    expect(text).toContain("School office");
    // No staff chosen yet, so no box.
    expect(last.container.querySelector("textarea")).toBeNull();
    const staff = Array.from(last.container.querySelectorAll('input[name="msg-staff"]'))[0] as HTMLInputElement;
    await act(async () => staff.click());
    typeInto(last.container.querySelector("textarea")!, "Can we talk about homework?");
    await act(async () => {
      button(last!.container, /^Send$/)!.click();
      await new Promise((r) => setTimeout(r, 100));
    });
    expect(s.starts).toHaveLength(1);
    expect(s.starts[0]).toMatchObject({ child: 1, staff: 20, body: "Can we talk about homework?" });
    expect(last.container.querySelector('[data-testid="where"]')?.textContent).toBe("/messages/77");
  });

  it("gives the school's sentence when messaging is off", async () => {
    const s = server({ canStart: false });
    last = render("/messages/new", s.fn);
    await settle(80);
    expect(last.container.textContent).toContain("Messaging with parents is switched off at this school.");
    expect(last.container.querySelector("textarea")).toBeNull();
  });

  it("does not ask which child when there is only one", async () => {
    const s = server();
    last = render("/messages/new", s.fn, ONE_CHILD);
    await settle(80);
    expect(last.container.textContent).not.toContain("Which child is it about?");
    expect(last.container.textContent).toContain("about Tobi");
  });
});

/**
 * happy-dom lays nothing out, so the message list is given a size from what is
 * in it: every bubble is 100px tall inside a 400px window. The scroll area is
 * the one element the layout tests measure.
 */
function sizeMessageList() {
  const proto = HTMLElement.prototype as unknown as Record<string, unknown>;
  const saved = {
    scrollHeight: Object.getOwnPropertyDescriptor(proto, "scrollHeight"),
    clientHeight: Object.getOwnPropertyDescriptor(proto, "clientHeight"),
    scrollTo: Object.getOwnPropertyDescriptor(proto, "scrollTo"),
  };
  const isList = (el: HTMLElement) => el.classList.contains("msg-thread-body");
  Object.defineProperty(proto, "scrollHeight", {
    configurable: true,
    get(this: HTMLElement) {
      return isList(this) ? this.querySelectorAll(".msg-bubble").length * 100 : 0;
    },
  });
  Object.defineProperty(proto, "clientHeight", {
    configurable: true,
    get(this: HTMLElement) {
      return isList(this) ? 400 : 0;
    },
  });
  Object.defineProperty(proto, "scrollTo", {
    configurable: true,
    value(this: HTMLElement, options: { top: number }) {
      this.scrollTop = options.top;
    },
  });
  return () => {
    for (const [key, descriptor] of Object.entries(saved)) {
      if (descriptor) Object.defineProperty(proto, key, descriptor);
      else delete proto[key];
    }
  };
}

const list = (container: HTMLElement) => container.querySelector(".msg-thread-body") as HTMLElement;

/** The reader scrolls the list to `top`, as a thumb would. */
function scrollListTo(container: HTMLElement, top: number) {
  act(() => {
    list(container).scrollTop = top;
    list(container).dispatchEvent(new Event("scroll"));
  });
}

describe("Open conversation layout", () => {
  let restore: () => void;
  beforeEach(() => {
    restore = sizeMessageList();
  });
  afterEach(() => restore());

  const twelve = () => Array.from({ length: 12 }, (_, i) => message(200 + i, `Line ${200 + i}`, i % 2 === 0));

  it("pins the header and the box outside the scrolling list, and the list is the only scroller", async () => {
    const s = server({ messages: { 41: twelve() } });
    last = render("/messages/41", s.fn);
    await settle(80);
    const thread = last.container.querySelector(".msg-thread")!;
    const body = list(last.container);
    expect(thread.querySelector(".msg-head")).toBeTruthy();
    expect(body.contains(thread.querySelector(".msg-head"))).toBe(false);
    expect(body.contains(thread.querySelector(".msg-composer"))).toBe(false);
    expect(last.container.querySelector(".msg-page")!.classList.contains("is-fixed")).toBe(true);
    expect(last.container.querySelector('a[aria-label="Back to the inbox"]')?.getAttribute("href")).toBe("/inbox?show=messages");
  });

  it("does not fix the layout on the new message form", async () => {
    const s = server();
    last = render("/messages/new", s.fn);
    await settle(80);
    expect(last.container.querySelector(".msg-page")!.classList.contains("is-fixed")).toBe(false);
  });

  it("opens on the newest message", async () => {
    const s = server({ messages: { 41: twelve() } });
    last = render("/messages/41", s.fn);
    await settle(80);
    expect(list(last.container).scrollTop).toBe(1200);
    expect(last.container.querySelector(".msg-new-pill")).toBeNull();
  });

  it("scrolls a message that arrives into view when the reader is at the end", async () => {
    const messages = { 41: twelve() };
    const s = server({ messages });
    last = render("/messages/41", s.fn);
    await settle(80);
    messages[41] = [...messages[41], message(300, "Newest", false)];
    await act(async () => {
      last!.store.dispatch(baseApi.util.invalidateTags(["Messages"]));
      await new Promise((r) => setTimeout(r, 80));
    });
    expect(last.container.textContent).toContain("Newest");
    expect(list(last.container).scrollTop).toBe(1300);
    expect(last.container.querySelector(".msg-new-pill")).toBeNull();
  });

  it("raises a New messages pill instead of moving a reader who scrolled up, and the pill jumps down", async () => {
    const messages = { 41: twelve() };
    const s = server({ messages });
    last = render("/messages/41", s.fn);
    await settle(80);
    scrollListTo(last.container, 100);
    messages[41] = [...messages[41], message(300, "Newest", false)];
    await act(async () => {
      last!.store.dispatch(baseApi.util.invalidateTags(["Messages"]));
      await new Promise((r) => setTimeout(r, 80));
    });
    expect(list(last.container).scrollTop).toBe(100);
    const pill = button(last.container, /New messages/)!;
    expect(pill).toBeTruthy();
    await act(async () => pill.click());
    expect(list(last.container).scrollTop).toBe(1300);
    expect(last.container.querySelector(".msg-new-pill")).toBeNull();
  });

  it("takes the pill away when the reader scrolls to the end themselves", async () => {
    const messages = { 41: twelve() };
    const s = server({ messages });
    last = render("/messages/41", s.fn);
    await settle(80);
    scrollListTo(last.container, 100);
    messages[41] = [...messages[41], message(300, "Newest", false)];
    await act(async () => {
      last!.store.dispatch(baseApi.util.invalidateTags(["Messages"]));
      await new Promise((r) => setTimeout(r, 80));
    });
    expect(last.container.querySelector(".msg-new-pill")).toBeTruthy();
    scrollListTo(last.container, 1300 - 400);
    expect(last.container.querySelector(".msg-new-pill")).toBeNull();
  });

  it("always scrolls the parent's own message into view, even from higher up", async () => {
    const s = server({ messages: { 41: twelve() } });
    last = render("/messages/41", s.fn);
    await settle(80);
    scrollListTo(last.container, 0);
    typeInto(last.container.querySelector("textarea")!, "On my way");
    await act(async () => {
      button(last!.container, /^Send$/)!.click();
      await new Promise((r) => setTimeout(r, 80));
    });
    expect(list(last.container).scrollTop).toBe(1300);
    expect(last.container.querySelector(".msg-new-pill")).toBeNull();
  });

  it("keeps the reader's place when earlier messages are shown", async () => {
    const many = Array.from({ length: 60 }, (_, i) => message(100 + i, `Message ${100 + i}`, i % 2 === 0));
    const s = server({ messages: { 41: many } });
    last = render("/messages/41", s.fn);
    await settle(80);
    expect(list(last.container).scrollTop).toBe(5000);
    scrollListTo(last.container, 0);
    await act(async () => {
      button(last!.container, /Show earlier messages/)!.click();
      await new Promise((r) => setTimeout(r, 80));
    });
    // Ten bubbles of 100px were added above the one the reader was on.
    expect(list(last.container).scrollTop).toBe(1000);
  });

  it("shows the header and no box on a watched conversation, still with the list scrolling alone", async () => {
    const s = server();
    last = render("/messages/52", s.fn);
    await settle(80);
    expect(last.container.querySelector(".msg-head")).toBeTruthy();
    expect(last.container.querySelector(".msg-composer")).toBeNull();
    expect(list(last.container)).toBeTruthy();
  });
});

const ticks = (container: HTMLElement) =>
  Array.from(container.querySelectorAll(".msg-tick")).map((n) => n.getAttribute("aria-label"));

/** Moves the app between front and back, as a phone does on switching apps. */
function setVisibility(state: "visible" | "hidden") {
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => state });
  act(() => {
    document.dispatchEvent(new Event("visibilitychange"));
  });
}

describe("Read ticks", () => {
  const mixed = () => [
    message(901, "Hello", false),
    message(902, "Hi, thanks", true),
    message(904, "Anything else?", true),
  ];

  it("draws one tick for a message the school has and two once it has been read", async () => {
    const s = server({ messages: { 41: mixed() }, receipts: true, readIds: new Set([902]) });
    last = render("/messages/41", s.fn);
    await settle(80);
    // Only the parent's own two messages carry ticks.
    expect(ticks(last.container)).toEqual(["Read", "Sent"]);
  });

  it("draws nothing when the conversation says receipts are off, or says nothing", async () => {
    const off = server({ messages: { 41: mixed() }, receipts: false });
    last = render("/messages/41", off.fn);
    await settle(80);
    expect(ticks(last.container)).toEqual([]);
  });

  it("draws no ticks on a conversation the parent only watches", async () => {
    const s = server({ receipts: true, messages: { 52: [message(950, "Hi", false), message(951, "Mine", true)] } });
    last = render("/messages/52", s.fn);
    await settle(80);
    expect(ticks(last.container)).toEqual([]);
  });

  it("shows a clock while a message goes, then one tick", async () => {
    const s = server({ messages: { 41: mixed() }, receipts: true, sendDelay: 150 });
    last = render("/messages/41", s.fn);
    await settle(80);
    typeInto(last.container.querySelector("textarea")!, "On my way");
    await act(async () => {
      button(last!.container, /^Send$/)!.click();
      await new Promise((r) => setTimeout(r, 30));
    });
    expect(ticks(last.container)).toContain("Sending");
    expect(last.container.textContent).toContain("On my way");
    await settle(200);
    expect(ticks(last.container)).not.toContain("Sending");
    expect(last.container.querySelectorAll(".msg-bubble-text")).toHaveLength(4);
    expect(ticks(last.container)).toEqual(["Sent", "Sent", "Sent"]);
  });

  it("says Not sent when a message fails, and tapping it sends the same text and token again", async () => {
    const s = server({ messages: { 41: mixed() }, receipts: true, firstSend: 500 });
    last = render("/messages/41", s.fn);
    await settle(80);
    typeInto(last.container.querySelector("textarea")!, "Running late");
    await act(async () => {
      button(last!.container, /^Send$/)!.click();
      await new Promise((r) => setTimeout(r, 80));
    });
    const retry = button(last.container, /Not sent/)!;
    expect(retry.textContent).toBe("Not sent. Tap to retry.");
    expect((last.container.querySelector("textarea") as HTMLTextAreaElement).value).toBe("Running late");
    await act(async () => {
      retry.click();
      await new Promise((r) => setTimeout(r, 80));
    });
    expect(s.sends).toHaveLength(2);
    expect(s.sends[1].client_token).toBe(s.sends[0].client_token);
    expect(button(last.container, /Not sent/)).toBeUndefined();
    expect((last.container.querySelector("textarea") as HTMLTextAreaElement).value).toBe("");
    expect(last.container.textContent?.split("Running late").length).toBe(2);
  });

  it("lets a failed message go when the parent changes the text", async () => {
    const s = server({ firstSend: 500 });
    last = render("/messages/41", s.fn);
    await settle(80);
    typeInto(last.container.querySelector("textarea")!, "Running late");
    await act(async () => {
      button(last!.container, /^Send$/)!.click();
      await new Promise((r) => setTimeout(r, 80));
    });
    expect(button(last.container, /Not sent/)).toBeTruthy();
    typeInto(last.container.querySelector("textarea")!, "Running very late");
    expect(button(last.container, /Not sent/)).toBeUndefined();
  });
});

describe("Following an open conversation", () => {
  const start = () => [message(901, "Hello", false), message(902, "Hi, thanks", true)];
  let visibility: "visible" | "hidden";

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
    visibility = "visible";
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => visibility });
  });
  afterEach(() => {
    vi.useRealTimers();
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "visible" });
  });

  const tick = async (ms = 10_000) => {
    await act(async () => {
      vi.advanceTimersByTime(ms);
      await new Promise((r) => setTimeout(r, 60));
    });
  };

  it("asks for newer messages every ten seconds, merges them once, and turns a tick by id", async () => {
    const messages = { 41: start() };
    const readIds = new Set<number>();
    const s = server({ messages, receipts: true, readIds });
    last = render("/messages/41", s.fn);
    await settle(80);
    expect(ticks(last.container)).toEqual(["Sent"]);
    expect(s.polls).toEqual([]);

    messages[41] = [...messages[41], message(903, "Newer", false)];
    readIds.add(902);
    await tick();
    expect(s.polls).toEqual([902]);
    expect(last.container.textContent).toContain("Newer");
    expect(ticks(last.container)).toEqual(["Read"]);

    // The next ask starts from what is now held, and nothing is shown twice.
    await tick();
    expect(s.polls).toEqual([902, 903]);
    expect(last.container.querySelectorAll(".msg-bubble-text")).toHaveLength(3);
  });

  it("stops while the app is hidden and asks once on coming back", async () => {
    const s = server({ messages: { 41: start() }, receipts: true });
    last = render("/messages/41", s.fn);
    await settle(80);
    await tick();
    expect(s.polls).toHaveLength(1);

    visibility = "hidden";
    setVisibility("hidden");
    await tick(60_000);
    expect(s.polls).toHaveLength(1);

    visibility = "visible";
    setVisibility("visible");
    await act(async () => {
      await new Promise((r) => setTimeout(r, 60));
    });
    expect(s.polls).toHaveLength(2);
  });

  it("stops when the conversation closes", async () => {
    const s = server({ messages: { 41: start() }, receipts: true });
    last = render("/messages/41", s.fn);
    await settle(80);
    await tick();
    expect(s.polls).toHaveLength(1);
    act(() => last!.root.unmount());
    await tick(60_000);
    expect(s.polls).toHaveLength(1);
    // The afterEach unmount finds nothing left to remove.
    last.container.remove();
    last = null;
  });

  it("still follows the new messages of a watched conversation", async () => {
    const messages = { 52: [message(950, "Hi", false, "Mr Kunle Adebayo")] };
    const s = server({ messages });
    last = render("/messages/52", s.fn);
    await settle(80);
    messages[52] = [...messages[52], message(951, "Second", false, "Mr Kunle Adebayo")];
    await tick();
    expect(s.polls).toEqual([950]);
    expect(last.container.textContent).toContain("Second");
    expect(ticks(last.container)).toEqual([]);
  });
});

describe("Reading only what is seen", () => {
  let restore: () => void;
  beforeEach(() => {
    restore = sizeMessageList();
  });
  afterEach(() => restore());

  const family = (unread: number) => ({ ...FAMILY_ROW, unread_count: unread });
  const thread = () => Array.from({ length: 12 }, (_, i) => message(200 + i, `Line ${200 + i}`, false));

  it("marks read up to the newest message when the parent opens at the end", async () => {
    const s = server({ rows: [family(2)], messages: { 41: thread() } });
    last = render("/messages/41", s.fn);
    await settle(80);
    expect(s.reads).toEqual([41]);
    expect(s.readUpTo).toEqual([211]);
  });

  it("marks nothing read for a reader who has scrolled away, and while the pill shows", async () => {
    const messages = { 41: thread() };
    const row = family(0);
    const s = server({ rows: [row], messages });
    last = render("/messages/41", s.fn);
    await settle(80);
    expect(s.reads).toEqual([]);

    scrollListTo(last.container, 100);
    messages[41] = [...messages[41], message(300, "Newest", false)];
    row.unread_count = 1;
    await act(async () => {
      last!.store.dispatch(baseApi.util.invalidateTags(["Messages"]));
      await new Promise((r) => setTimeout(r, 80));
    });
    expect(button(last.container, /New messages/)).toBeTruthy();
    expect(s.reads).toEqual([]);
  });

  it("marks the new message read once the parent taps the pill", async () => {
    const messages = { 41: thread() };
    const row = family(0);
    const s = server({ rows: [row], messages });
    last = render("/messages/41", s.fn);
    await settle(80);
    scrollListTo(last.container, 100);
    messages[41] = [...messages[41], message(300, "Newest", false)];
    row.unread_count = 1;
    await act(async () => {
      last!.store.dispatch(baseApi.util.invalidateTags(["Messages"]));
      await new Promise((r) => setTimeout(r, 80));
    });
    await act(async () => {
      button(last!.container, /New messages/)!.click();
      await new Promise((r) => setTimeout(r, 80));
    });
    expect(s.reads).toEqual([41]);
    expect(s.readUpTo).toEqual([300]);
  });

  it("marks the new message read when the parent scrolls down to it themselves", async () => {
    const messages = { 41: thread() };
    const row = family(0);
    const s = server({ rows: [row], messages });
    last = render("/messages/41", s.fn);
    await settle(80);
    scrollListTo(last.container, 100);
    messages[41] = [...messages[41], message(300, "Newest", false)];
    row.unread_count = 1;
    await act(async () => {
      last!.store.dispatch(baseApi.util.invalidateTags(["Messages"]));
      await new Promise((r) => setTimeout(r, 80));
    });
    expect(s.reads).toEqual([]);
    await act(async () => {
      scrollListTo(last!.container, 1300 - 400);
      await new Promise((r) => setTimeout(r, 80));
    });
    expect(s.readUpTo).toEqual([300]);
  });

  it("does not mark anything read while the app is in the background", async () => {
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
    try {
      const s = server({ rows: [family(2)], messages: { 41: thread() } });
      last = render("/messages/41", s.fn);
      await settle(80);
      expect(s.reads).toEqual([]);
    } finally {
      Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "visible" });
    }
  });
});
