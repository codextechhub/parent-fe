import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
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

import { NoticesPage } from "./notices";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const ME: MeData = {
  parent: { first_name: "Patricia", full_name: "Patricia", initials: "P" },
  school: { name: "Lagoon View", logo_url: "" },
  show_branch: false,
  session: null,
  term: null,
  children: [
    {
      id: 1,
      first_name: "Tobi",
      full_name: "Tobi",
      initials: "T",
      photo_url: "",
      admission_number: "",
      class_name: "JSS1 A",
      relationship: "Mother",
    },
  ],
};

const LIST_PAGE_1 = {
  success: true,
  message: "ok",
  pagination: { currentPage: 1, pageSize: 25, totalItems: 2, totalPages: 1, next: null, previous: null },
  data: [
    {
      id: 7,
      title: "PTA meeting",
      body: "This Saturday at 10am.",
      audience_label: "School-wide",
      published_at: "2026-10-19T08:03:53Z",
      edited_at: null,
      unread: true,
      children: ["Tobi"],
    },
    {
      id: 8,
      title: "Mid-term break",
      body: "School closes Friday.",
      audience_label: "School-wide",
      published_at: "2026-10-16T07:45:12Z",
      edited_at: null,
      unread: false,
      children: ["Tobi"],
    },
  ],
  unread_count: 1,
};

function render(path: string, fetchImpl: typeof fetch) {
  globalThis.fetch = fetchImpl;
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
  store.dispatch(meLoaded(ME));
  act(() =>
    root.render(
      <Provider store={store}>
        <MemoryRouter initialEntries={[path]}>
          <Routes><Route path="/notices/:id" element={<NoticesPage />} /></Routes>
          <Toaster />
        </MemoryRouter>
      </Provider>,
    ),
  );
  return { container, root, store };
}

let last: { container: HTMLDivElement; root: Root } | null = null;
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

function noticesStub(initialList: typeof LIST_PAGE_1) {
  // A mutable copy, so a mark-read's invalidation refetch sees the "server" state after the write.
  const list: typeof LIST_PAGE_1 = JSON.parse(JSON.stringify(initialList));
  return vi.fn(async (input: Parameters<typeof fetch>[0]) => {
    const url = input instanceof Request ? input.url : String(input);
    const markOne = url.match(/\/portal\/parent\/notices\/(\d+)\/read\/(\?|$)/);
    if (markOne) {
      const row = list.data.find((n) => n.id === Number(markOne[1]));
      if (row) row.unread = false;
      return new Response(
        JSON.stringify({ success: true, message: "ok", data: { unread_count: 0 } }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }
    const detail = url.match(/\/portal\/parent\/notices\/(\d+)\/(\?|$)/);
    if (detail) {
      const id = Number(detail[1]);
      const row = list.data.find((n) => n.id === id);
      if (!row) return new Response("{}", { status: 404 });
      return new Response(
        JSON.stringify({ success: true, message: "ok", data: row }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }
    if (url.includes("/portal/parent/notices/")) {
      return new Response(JSON.stringify(list), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    return new Response("{}", { status: 200 });
  });
}

describe("a notice on its own screen", () => {
  it("shows the notice whole, whom it is for, and the way back to the Inbox", async () => {
    const r = render("/notices/7", noticesStub(LIST_PAGE_1) as unknown as typeof fetch);
    last = r;
    await act(() => new Promise((r) => setTimeout(r, 30)));
    expect(r.container.textContent).toContain("PTA meeting");
    expect(r.container.textContent).toContain("This Saturday at 10am.");
    expect(r.container.textContent).toContain("For Tobi");
    expect(r.container.querySelector('a[aria-label="Back to the inbox"]')?.getAttribute("href")).toBe("/inbox");
  });

  it("is not marked read by opening it: the parent marks it", async () => {
    const stub = noticesStub(LIST_PAGE_1);
    const r = render("/notices/7", stub as unknown as typeof fetch);
    last = r;
    await act(() => new Promise((r) => setTimeout(r, 30)));
    const marked = () => (stub.mock.calls as Array<Parameters<typeof fetch>>).some(([input, init]) => {
      const url = input instanceof Request ? input.url : String(input);
      const method = input instanceof Request ? input.method : init?.method;
      return /\/notices\/7\/read\/$/.test(new URL(url, "http://t").pathname) && method === "POST";
    });
    expect(marked()).toBe(false);
    const button = Array.from(r.container.querySelectorAll("button")).find((b) => b.textContent?.includes("Mark as read"));
    expect(button).toBeTruthy();
    await act(async () => {
      button!.click();
      await new Promise((r) => setTimeout(r, 60));
    });
    expect(marked()).toBe(true);
  });

  it("says when a notice is already read", async () => {
    const r = render("/notices/8", noticesStub(LIST_PAGE_1) as unknown as typeof fetch);
    last = r;
    await act(() => new Promise((r) => setTimeout(r, 30)));
    expect(r.container.textContent).toContain("You've marked this notice as read");
    expect(r.container.textContent).not.toContain("Mark as read");
  });

  it("says a notice is gone, with the way back to the notices", async () => {
    const r = render("/notices/99", noticesStub(LIST_PAGE_1) as unknown as typeof fetch);
    last = r;
    await act(() => new Promise((r) => setTimeout(r, 30)));
    expect(r.container.textContent).toContain("This notice isn't available any more.");
    expect(r.container.querySelector('a[href="/inbox?show=notices"]')).not.toBeNull();
  });
});
