import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { Provider } from "react-redux";
import { MemoryRouter, Route, Routes } from "react-router";
import { configureStore } from "@reduxjs/toolkit";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { setAccessToken } from "@/auth/access-token";
import { authReducer, meLoaded, type MeData } from "@/redux/features/auth-slice";
import { connectivityReducer, wentOffline } from "@/redux/features/connectivity-slice";
import { baseApi } from "@/redux/services/base-api";
import "@/redux/services/portal-api";
import "@/redux/services/messages-api";

import { AppShell } from "./app-shell";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const ME: MeData = {
  parent: { first_name: "Patricia", full_name: "Patricia Okafor", initials: "PO" },
  school: { name: "Lagoon View", logo_url: "" },
  show_branch: false,
  session: null,
  term: null,
  children: [
    {
      id: 1,
      first_name: "Tobi",
      full_name: "Tobi Okafor",
      initials: "T",
      photo_url: "",
      admission_number: "",
      class_name: "JSS1 A",
      relationship: "Mother",
    },
  ],
};

/** Every read answers an empty, well-formed page; the shell only needs its frame to render. */
const empty = () =>
  new Response(
    JSON.stringify({
      success: true,
      data: { results: [], unread_count: 0, total: 0 },
      pagination: { currentPage: 1, pageSize: 20, totalItems: 0, totalPages: 1, next: null, previous: null },
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );

/** Pretends the window is `narrow` (a phone) or wide (two panes) for the media query the shell reads. */
function screenIs(narrow: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: query.includes("max-width") ? narrow : !narrow,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
}

let view: { root: Root; container: HTMLDivElement; store: ReturnType<typeof configureStore> } | null = null;

function render(path: string) {
  globalThis.fetch = vi.fn(async () => empty()) as unknown as typeof fetch;
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  const store = configureStore({
    reducer: { [baseApi.reducerPath]: baseApi.reducer, auth: authReducer, connectivity: connectivityReducer },
    middleware: (gd) => gd().concat(baseApi.middleware),
  });
  store.dispatch(meLoaded(ME));
  act(() =>
    root.render(
      <Provider store={store}>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route element={<AppShell />}>
              <Route path="messages" element={<p>List</p>} />
              <Route path="messages/new" element={<p>New</p>} />
              <Route path="messages/:id" element={<p>Thread</p>} />
              <Route path="fees" element={<p>Fees</p>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </Provider>,
    ),
  );
  view = { root, container, store };
  return container;
}

const tabBar = (container: HTMLElement) => container.querySelector('nav[aria-label="Screens"]');
const appHeader = (container: HTMLElement) => container.querySelector(".app-shell > header");
const frame = (container: HTMLElement) => container.querySelector(".app-shell")!;

beforeEach(() => {
  setAccessToken("stale");
});
afterEach(() => {
  if (view) {
    act(() => view!.root.unmount());
    view.container.remove();
    view = null;
  }
});

describe("App shell around an open conversation", () => {
  it("takes the tab bar and the app header away on a phone while a conversation is open", () => {
    screenIs(true);
    const container = render("/messages/41");
    expect(tabBar(container)).toBeNull();
    expect(appHeader(container)).toBeNull();
    expect(frame(container).classList.contains("app-shell--fixed")).toBe(true);
  });

  it("brings the tab bar and the app header back on the list and on every other screen", () => {
    screenIs(true);
    for (const path of ["/messages", "/messages/new", "/fees"]) {
      const container = render(path);
      expect(tabBar(container), path).not.toBeNull();
      expect(appHeader(container), path).not.toBeNull();
      expect(frame(container).classList.contains("app-shell--fixed"), path).toBe(false);
      act(() => view!.root.unmount());
      container.remove();
      view = null;
    }
  });

  it("keeps the app header and the tab bar beside the two panes on a wide screen", () => {
    screenIs(false);
    const container = render("/messages/41");
    expect(tabBar(container)).not.toBeNull();
    expect(appHeader(container)).not.toBeNull();
    expect(frame(container).classList.contains("app-shell--fixed")).toBe(true);
  });

  it("makes the offline bar clear the top inset when it is the first thing on a phone's conversation", () => {
    screenIs(true);
    const container = render("/messages/41");
    act(() => {
      view!.store.dispatch(wentOffline());
    });
    expect(container.querySelector('[role="status"]')?.className).toContain("safe-area-inset-top");
    expect(frame(container).classList.contains("app-shell--offline")).toBe(true);
  });

  it("leaves the offline bar under the app header elsewhere", () => {
    screenIs(true);
    const container = render("/messages");
    act(() => {
      view!.store.dispatch(wentOffline());
    });
    expect(container.querySelector('[role="status"]')?.className).not.toContain("safe-area-inset-top");
  });

  it("follows the visual viewport so the box rides above the keyboard, and lets go on leaving", () => {
    screenIs(true);
    const listeners: Record<string, () => void> = {};
    const viewport = {
      height: 500,
      offsetTop: 0,
      scale: 1,
      addEventListener: (name: string, fn: () => void) => (listeners[name] = fn),
      removeEventListener: (name: string) => delete listeners[name],
    };
    Object.defineProperty(window, "visualViewport", { value: viewport, configurable: true });
    Object.defineProperty(window, "innerHeight", { value: 812, configurable: true });
    try {
      const container = render("/messages/41");
      const shell = frame(container) as HTMLElement;
      expect(shell.style.getPropertyValue("--vv-height")).toBe("500px");
      expect(shell.hasAttribute("data-keyboard")).toBe(true);
      viewport.height = 812;
      act(() => listeners.resize());
      expect(shell.style.getPropertyValue("--vv-height")).toBe("812px");
      expect(shell.hasAttribute("data-keyboard")).toBe(false);
      act(() => view!.root.unmount());
      expect(shell.style.getPropertyValue("--vv-height")).toBe("");
      container.remove();
      view = null;
    } finally {
      Object.defineProperty(window, "visualViewport", { value: undefined, configurable: true });
    }
  });
});
