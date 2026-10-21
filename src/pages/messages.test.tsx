import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
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
        const stored = message(990 + sends.length, body.body, true);
        threads[id] = [...(threads[id] ?? []), stored];
        return json(stored, 201);
      }
      const before = Number(url.searchParams.get("before") ?? 0);
      const limit = Number(url.searchParams.get("limit") ?? 50);
      const all = [...(threads[id] ?? [])].sort((a, b) => b.id - a.id).filter((m) => !before || m.id < before);
      const page = all.slice(0, limit);
      return json({
        results: page,
        has_more: all.length > limit,
        next_before: all.length > limit ? page[page.length - 1].id : null,
      });
    }
    const read = path.match(/\/conversations\/(\d+)\/read\/$/);
    if (read) {
      reads.push(Number(read[1]));
      return json({ conversation: Number(read[1]), unread_count: 0 });
    }
    const one = path.match(/\/conversations\/(\d+)\/$/);
    if (one) {
      const row = rows.find((r) => r.id === Number(one[1]));
      return row ? json(row) : json(null, 404);
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
  return { fn, sends, reads, starts };
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
  return { container, root };
}

let last: { container: HTMLDivElement; root: Root } | null = null;
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

describe("Messages list", () => {
  it("shows staff, their label, the child and the unread count, and sets watched conversations apart", async () => {
    const s = server();
    last = render("/messages", s.fn);
    await settle();
    const text = last.container.textContent ?? "";
    expect(text).toContain("2 unread");
    expect(text).toContain("Your conversations");
    expect(text).toContain("Mrs Funke Bello");
    expect(text).toContain("Class teacher, JSS1 A");
    expect(text).toContain("About Tobi");
    expect(text).toContain("Your child's conversations with staff");
    // The section note says the rule once; the watched row does not repeat it.
    expect(text.split("You can read these but not reply").length - 1).toBe(1);
    expect(text).not.toContain("You can read it but not reply");
    // The watched row reads like an ordinary one: staff label and child chip, no unread badge.
    const watched = last.container.querySelector('a[href="/messages/52"]');
    expect(watched?.getAttribute("aria-label")).toBe("Open Adaeze's conversation with Mr Kunle Adebayo");
    expect(watched?.textContent).toContain("Mr Kunle Adebayo");
    expect(watched?.textContent).toContain("Mathematics");
    expect(watched?.textContent).toContain("About Adaeze");
    expect(watched?.querySelector(".msg-unread")).toBeNull();
  });

  it("leaves the child chips and the About line out for a parent with one child", async () => {
    const s = server({ rows: [FAMILY_ROW] });
    last = render("/messages", s.fn, ONE_CHILD);
    await settle();
    expect(last.container.textContent).not.toContain("All children");
    expect(last.container.textContent).not.toContain("About Tobi");
  });

  it("asks the API for one child when a chip is chosen", async () => {
    const s = server();
    last = render("/messages", s.fn);
    await settle();
    await act(async () => {
      button(last!.container, /^Adaeze$/)!.click();
      await new Promise((r) => setTimeout(r, 40));
    });
    const asked = s.fn.mock.calls.some(([input]) => String(input instanceof Request ? input.url : input).includes("child=2"));
    expect(asked).toBe(true);
  });

  it("says so when there is nothing yet", async () => {
    const s = server({ rows: [] });
    last = render("/messages", s.fn);
    await settle();
    expect(last.container.textContent).toContain("No messages yet");
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
