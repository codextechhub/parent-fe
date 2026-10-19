import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { Provider } from "react-redux";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import { configureStore } from "@reduxjs/toolkit";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { authReducer, meLoaded, type MeData } from "@/redux/features/auth-slice";
import { connectivityReducer } from "@/redux/features/connectivity-slice";
import { baseApi } from "@/redux/services/base-api";
// Side-effect: register the endpoints the slice reducer leans on.
import "@/redux/services/portal-api";

import { ChildSwitcher } from "./child-switcher";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const ME: MeData = {
  parent: { first_name: "Patricia", full_name: "Patricia Okafor", initials: "PO" },
  school: { name: "Lagoon View", logo_url: "" },
  show_branch: true,
  session: { id: 1, name: "2025/2026" },
  term: { id: 1, name: "First Term" },
  children: [
    {
      id: 11,
      first_name: "Tobi",
      full_name: "Tobi Okafor",
      initials: "TO",
      photo_url: "",
      admission_number: "A1",
      class_name: "JSS1 A",
      relationship: "SON",
      branch: { id: 1, name: "Lekki" },
    },
    {
      id: 12,
      first_name: "Somto",
      full_name: "Somto Okafor",
      initials: "SO",
      photo_url: "",
      admission_number: "A2",
      class_name: "Primary 4",
      relationship: "SON",
      branch: { id: 2, name: "Ikoyi" },
    },
  ],
};

function makeStore() {
  const store = configureStore({
    reducer: {
      [baseApi.reducerPath]: baseApi.reducer,
      auth: authReducer,
      connectivity: connectivityReducer,
    },
    middleware: (gd) => gd().concat(baseApi.middleware),
  });
  store.dispatch(meLoaded(ME));
  return store;
}

function Probe({ onPath }: { onPath: (p: string, s: string) => void }) {
  const loc = useLocation();
  onPath(loc.pathname, loc.search);
  return null;
}

type Captured = { pathname: string; search: string };

function render(initial: string, captured: Captured) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  const store = makeStore();
  const onPath = (p: string, s: string) => {
    captured.pathname = p;
    captured.search = s;
  };
  act(() =>
    root.render(
      <Provider store={store}>
        <MemoryRouter initialEntries={[initial]}>
          <Routes>
            <Route
              path="*"
              element={
                <>
                  <ChildSwitcher />
                  <Probe onPath={onPath} />
                </>
              }
            />
          </Routes>
        </MemoryRouter>
      </Provider>,
    ),
  );
  return { container, root };
}

let last: { container: HTMLDivElement; root: Root } | null = null;
beforeEach(() => {
  last = null;
});
afterEach(() => {
  if (last) {
    act(() => last!.root.unmount());
    last.container.remove();
    last = null;
  }
});

describe("ChildSwitcher", () => {
  it("adds ?child= on a per-child route and keeps it on a reload", () => {
    const captured = { pathname: "", search: "" };
    last = render("/results", captured);
    act(() => (last!.container.querySelector(".child-switcher-trigger") as HTMLButtonElement).click());
    // Pick the second child (Somto).
    const buttons = Array.from(
      document.querySelectorAll(".child-switcher-list button"),
    ) as HTMLButtonElement[];
    act(() => buttons[1].click());
    expect(captured.pathname).toBe("/results");
    expect(captured.search).toBe("?child=12");
  });

  it("drops ?child= on a route that scopes to the family", () => {
    const captured = { pathname: "", search: "" };
    last = render("/fees?child=11", captured);
    act(() => (last!.container.querySelector(".child-switcher-trigger") as HTMLButtonElement).click());
    const buttons = Array.from(
      document.querySelectorAll(".child-switcher-list button"),
    ) as HTMLButtonElement[];
    act(() => buttons[1].click());
    expect(captured.pathname).toBe("/fees");
    expect(captured.search).toBe("");
  });

  it("stays disabled when there is only one child", () => {
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
    store.dispatch(meLoaded({ ...ME, children: [ME.children[0]] }));
    last = { container, root };
    act(() =>
      root.render(
        <Provider store={store}>
          <MemoryRouter initialEntries={["/results"]}>
            <ChildSwitcher />
          </MemoryRouter>
        </Provider>,
      ),
    );
    const trigger = container.querySelector(".child-switcher-trigger") as HTMLButtonElement;
    expect(trigger.disabled).toBe(true);
  });
});
