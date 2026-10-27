/**
 * The Inbox, for Patricia (Tobi in JSS1 A and Adaeze in Primary 4): the
 * school's notices and her conversations in one list, with the switch, the
 * unread counts and "Mark all notices read".
 */
import { act } from "react";
import { createRoot } from "react-dom/client";
import { Provider } from "react-redux";
import { MemoryRouter, Route, Routes } from "react-router";
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

import { InboxPage } from "./inbox";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const child = (id: number, first: string, cls: string) => ({
  id, first_name: first, full_name: `${first} Okafor`, initials: first[0], photo_url: "",
  admission_number: "", class_name: cls, relationship: "Mother",
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

const NOTICES = [
  { id: 7, title: "PTA meeting", body: "This Saturday at 10am.", audience_label: "School-wide", published_at: "2026-10-22T08:00:00Z", edited_at: null, unread: true, children: ["Tobi", "Adaeze"] },
  { id: 8, title: "Mid-term break", body: "School closes Friday.", audience_label: "School-wide", published_at: "2026-10-16T07:45:00Z", edited_at: "2026-10-17T07:45:00Z", unread: false, children: [] },
];

const FAMILY_ROW = {
  id: 41, kind: "FAMILY", kind_label: "Parent", display_name: "Mrs Funke Bello",
  counterpart: { user_id: 20, name: "Mrs Funke Bello", label: "Class teacher, JSS1 A" },
  child: { id: 1, name: "Tobi Okafor", class_name: "JSS1 A" },
  last_message: { id: 903, preview: "Tobi was great today", sender_name: "Mrs Funke Bello", sent_at: "2026-10-23T08:00:00Z", mine: false },
  last_activity_at: "2026-10-23T08:00:00Z", unread_count: 2, read_only: false, can_send: true, read_only_reason: "",
};
const WATCHED_ROW = {
  id: 52, kind: "PUPIL", kind_label: "Pupil", display_name: "Mr Kunle Adebayo",
  counterpart: { user_id: 21, name: "Mr Kunle Adebayo", label: "Mathematics" },
  child: { id: 2, name: "Adaeze Okafor", class_name: "Primary 4" },
  last_message: { id: 950, preview: "Please bring your workbook", sender_name: "Mr Kunle Adebayo", sent_at: "2026-10-20T08:00:00Z", mine: false },
  last_activity_at: "2026-10-20T08:00:00Z", unread_count: 0, read_only: true, can_send: false,
  read_only_reason: "Adaeze's conversation. You can read it but not reply.",
};

const page = { currentPage: 1, pageSize: 25, totalItems: 2, totalPages: 1, next: null, previous: null };
const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });

function server({ notices = NOTICES, rows = [FAMILY_ROW, WATCHED_ROW] as unknown[] } = {}) {
  const list = JSON.parse(JSON.stringify(notices)) as typeof NOTICES;
  const fn = vi.fn(async (input: Parameters<typeof fetch>[0]) => {
    const path = new URL(input instanceof Request ? input.url : String(input), "http://test.local").pathname;
    if (path.endsWith("/notices/read-all/")) {
      for (const row of list) row.unread = false;
      return json({ success: true, message: "ok", data: { marked: 1, unread_count: 0 } });
    }
    if (path.endsWith("/portal/parent/notices/")) {
      return json({ success: true, message: "ok", pagination: page, data: list, unread_count: list.filter((n) => n.unread).length });
    }
    if (path.endsWith("/messages/unread-count/")) return json({ success: true, message: "ok", data: { total: 2 } });
    if (path.endsWith("/messages/conversations/")) {
      return json({ success: true, message: "ok", pagination: page, data: rows, unread_count: 2 });
    }
    return json({});
  });
  return fn;
}

function render(path: string, fetchImpl: ReturnType<typeof server>, me: MeData = ME) {
  globalThis.fetch = fetchImpl as unknown as typeof fetch;
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  const store = configureStore({
    reducer: { [baseApi.reducerPath]: baseApi.reducer, auth: authReducer, connectivity: connectivityReducer },
    middleware: (gd) => gd().concat(baseApi.middleware),
  });
  store.dispatch(meLoaded(me));
  act(() =>
    root.render(
      <Provider store={store}>
        <MemoryRouter initialEntries={[path]}>
          <Routes><Route path="/inbox" element={<InboxPage />} /></Routes>
          <Toaster />
        </MemoryRouter>
      </Provider>,
    ),
  );
  return { container, root };
}

let last: ReturnType<typeof render> | null = null;
const settle = (ms = 40) => act(() => new Promise((r) => setTimeout(r, ms)));
const rows = () => Array.from(last!.container.querySelectorAll(".inbox-row"));
const button = (label: RegExp) =>
  Array.from(last!.container.querySelectorAll("button")).find((b) => label.test(b.textContent ?? "")) as HTMLButtonElement | undefined;

beforeEach(() => {
  document.cookie = "csrftoken=abc; path=/";
  _resetCsrfCache();
  _resetRefreshForTests();
  setAccessToken("stale");
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

describe("the Inbox", () => {
  it("puts notices and conversations in one list, newest first, with the unread counts", async () => {
    last = render("/inbox", server());
    await settle();
    expect(rows().map((r) => r.getAttribute("href"))).toEqual(["/messages/41", "/notices/7", "/messages/52", "/notices/8"]);
    expect(last.container.textContent).toContain("3 unread");
    expect(last.container.textContent).toContain("Notices · 1");
    expect(last.container.textContent).toContain("Messages · 2");
  });

  it("names the children a notice is for, or its audience, and marks an edited one", async () => {
    last = render("/inbox", server());
    await settle();
    const [, pta, , midTerm] = rows();
    expect(pta.textContent).toContain("For Tobi and Adaeze");
    expect(pta.querySelector(".inbox-row-dot")).not.toBeNull();
    expect(midTerm.textContent).toContain("School-wide");
    expect(midTerm.textContent).toContain("Edited");
  });

  it("shows staff, their label and the child, and says a child's own conversation can be read, not answered", async () => {
    last = render("/inbox", server());
    await settle();
    const [family, , watched] = rows();
    expect(family.textContent).toContain("Mrs Funke Bello");
    expect(family.textContent).toContain("Class teacher, JSS1 A · About Tobi");
    expect(family.getAttribute("aria-label")).toBe("Conversation with Mrs Funke Bello, 2 unread");
    expect(watched.textContent).toContain("Adaeze's conversation · You can read, not reply");
    expect(watched.textContent).toContain("Please bring your workbook");
    expect(watched.querySelector(".inbox-row-dot")).toBeNull();
  });

  it("leaves the About line out for a parent with one child", async () => {
    last = render("/inbox", server({ rows: [FAMILY_ROW] }), ONE_CHILD);
    await settle();
    expect(last.container.textContent).toContain("Class teacher, JSS1 A");
    expect(last.container.textContent).not.toContain("About Tobi");
  });

  it("shows only the notices on Notices, and marks them all read", async () => {
    const fetchImpl = server();
    last = render("/inbox?show=notices", fetchImpl);
    await settle();
    expect(rows().map((r) => r.getAttribute("href"))).toEqual(["/notices/7", "/notices/8"]);
    await act(async () => {
      button(/Mark all as read/)!.click();
      await new Promise((r) => setTimeout(r, 60));
    });
    const asked = fetchImpl.mock.calls.some(([input]) => String(input instanceof Request ? input.url : input).includes("/notices/read-all/"));
    expect(asked).toBe(true);
    expect(button(/Mark all/)).toBeUndefined();
  });

  it("offers New message", async () => {
    last = render("/inbox", server());
    await settle();
    expect(last.container.querySelector(".inbox-new")?.getAttribute("href")).toBe("/messages/new");
  });

  it("says so when there is nothing yet", async () => {
    last = render("/inbox", server({ notices: [], rows: [] }));
    await settle();
    expect(last.container.textContent).toContain("Nothing here yet");
  });
});
