import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { Provider } from "react-redux";
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from "react-router";
import { configureStore } from "@reduxjs/toolkit";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { authReducer, meLoaded, type MeData } from "@/redux/features/auth-slice";
import { connectivityReducer } from "@/redux/features/connectivity-slice";
import { baseApi } from "@/redux/services/base-api";
// Side-effect: register the endpoints the slice reducer leans on.
import "@/redux/services/portal-api";

import { ChildSwitcher, useActiveChild } from "./child-switcher";

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

function makeStore(me: MeData = ME) {
  const store = configureStore({
    reducer: {
      [baseApi.reducerPath]: baseApi.reducer,
      auth: authReducer,
      connectivity: connectivityReducer,
    },
    middleware: (gd) => gd().concat(baseApi.middleware),
  });
  store.dispatch(meLoaded(me));
  return store;
}

function Probe({ onPath }: { onPath: (p: string, s: string) => void }) {
  const loc = useLocation();
  onPath(loc.pathname, loc.search);
  const active = useActiveChild();
  const navigate = useNavigate();
  return (
    <>
      <output data-testid="focus">{active?.first_name}</output>
      <button type="button" data-testid="open-results" onClick={() => navigate("/results")} />
    </>
  );
}

type Captured = { pathname: string; search: string };

function render(initial: string, captured: Captured, me: MeData = ME) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  const store = makeStore(me);
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

  it("keeps the child chosen on a family screen in focus for the next screen", () => {
    const captured = { pathname: "", search: "" };
    last = render("/fees", captured);
    const focus = () => last!.container.querySelector('[data-testid="focus"]')?.textContent;
    expect(focus()).toBe("Tobi");
    act(() => (last!.container.querySelector(".child-switcher-trigger") as HTMLButtonElement).click());
    const buttons = Array.from(document.querySelectorAll(".child-switcher-list button")) as HTMLButtonElement[];
    act(() => buttons[1].click());
    // Fees is the family's: the address stays clean, but Somto is now in focus.
    expect(captured.search).toBe("");
    expect(focus()).toBe("Somto");
    act(() => (last!.container.querySelector('[data-testid="open-results"]') as HTMLButtonElement).click());
    expect(captured.pathname).toBe("/results");
    expect(focus()).toBe("Somto");
  });

  it("opens for a parent with one child, so she can still sign out", async () => {
    globalThis.fetch = vi.fn(async () => new Response("{}", { status: 200 })) as unknown as typeof fetch;
    const captured = { pathname: "", search: "" };
    last = render("/results", captured, { ...ME, children: [ME.children[0]] });
    const trigger = last.container.querySelector(".child-switcher-trigger") as HTMLButtonElement;
    expect(trigger.disabled).toBe(false);
    act(() => trigger.click());
    const signOut = Array.from(document.querySelectorAll(".child-switcher-actions button")).find(
      (b) => b.textContent === "Sign out",
    ) as HTMLButtonElement;
    expect(signOut).toBeDefined();
    await act(async () => signOut.click());
    expect(captured.pathname).toBe("/sign-in");
  });

  it("takes the parent to her profile from the sheet", () => {
    const captured = { pathname: "", search: "" };
    last = render("/results", captured);
    act(() => (last!.container.querySelector(".child-switcher-trigger") as HTMLButtonElement).click());
    const profile = Array.from(document.querySelectorAll(".child-switcher-actions button")).find(
      (b) => b.textContent?.startsWith("My profile"),
    ) as HTMLButtonElement;
    expect(profile.textContent).toContain("Patricia Okafor");
    act(() => profile.click());
    expect(captured.pathname).toBe("/profile");
  });

  it("shows the parent's initials when no child is linked, and still opens", () => {
    const captured = { pathname: "", search: "" };
    last = render("/", captured, { ...ME, children: [] });
    const trigger = last.container.querySelector(".child-switcher-trigger") as HTMLButtonElement;
    expect(trigger.textContent).toBe("PO");
    act(() => trigger.click());
    expect(document.querySelector(".child-switcher-sheet h2")?.textContent).toBe("Your account");
  });
});
