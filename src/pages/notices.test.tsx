import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { Provider } from "react-redux";
import { MemoryRouter } from "react-router";
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
          <NoticesPage />
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

function noticesStub(initialList: typeof LIST_PAGE_1, overrides: {
  markAll?: boolean;
} = {}) {
  // The stub keeps a mutable list so a mark-all-read's invalidation refetch
  // sees the "server" state as the backend would after the write.
  const list: typeof LIST_PAGE_1 = JSON.parse(JSON.stringify(initialList));
  return vi.fn(async (input: Parameters<typeof fetch>[0]) => {
    const url = input instanceof Request ? input.url : String(input);
    if (url.endsWith("/portal/parent/notices/read-all/") && overrides.markAll) {
      for (const row of list.data) row.unread = false;
      list.unread_count = 0;
      return new Response(
        JSON.stringify({ success: true, message: "ok", data: { marked: 1, unread_count: 0 } }),
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

describe("NoticesPage", () => {
  it("renders the list with the unread count and the children a notice is for", async () => {
    const r = render("/notices", noticesStub(LIST_PAGE_1) as unknown as typeof fetch);
    last = r;
    await act(() => new Promise((r) => setTimeout(r, 30)));
    expect(r.container.textContent).toContain("1 unread");
    expect(r.container.textContent).toContain("PTA meeting");
    expect(r.container.textContent).toContain("Mid-term break");
    // First row's "For Tobi" badge.
    expect(r.container.textContent).toContain("For Tobi");
    expect(r.container.textContent).toContain("Mark all as read");
  });

  it("says All read when nothing is unread", async () => {
    const payload = { ...LIST_PAGE_1, data: LIST_PAGE_1.data.map((n) => ({ ...n, unread: false })), unread_count: 0 };
    const r = render("/notices", noticesStub(payload) as unknown as typeof fetch);
    last = r;
    await act(() => new Promise((r) => setTimeout(r, 30)));
    expect(r.container.textContent).toContain("All read");
    expect(r.container.textContent).not.toContain("Mark all as read");
  });

  it("fires the mark-all mutation when the parent clicks Mark all as read", async () => {
    const stub = noticesStub(LIST_PAGE_1, { markAll: true });
    const r = render("/notices", stub as unknown as typeof fetch);
    last = r;
    await act(() => new Promise((r) => setTimeout(r, 30)));
    const button = Array.from(r.container.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("Mark all"),
    ) as HTMLButtonElement | undefined;
    expect(button).toBeTruthy();
    await act(async () => {
      button!.click();
      await new Promise((r) => setTimeout(r, 60));
    });
    const calledReadAll = (stub.mock.calls as Array<Parameters<typeof fetch>>).some(([input]) => {
      const url = input instanceof Request ? input.url : String(input);
      return url.includes("/portal/parent/notices/read-all/");
    });
    expect(calledReadAll).toBe(true);
  });
});
