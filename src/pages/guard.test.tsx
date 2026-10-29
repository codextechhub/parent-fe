import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { Provider } from "react-redux";
import { MemoryRouter, Route, Routes } from "react-router";
import { configureStore } from "@reduxjs/toolkit";
import { setupListeners } from "@reduxjs/toolkit/query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { setAccessToken } from "@/auth/access-token";
import { _resetCsrfCache } from "@/auth/csrf";
import { _resetAccountForTests, setAccount } from "@/auth/device-account";
import { _resetRefreshForTests } from "@/auth/refresh";
import { authReducer } from "@/redux/features/auth-slice";
import { connectivityReducer } from "@/redux/features/connectivity-slice";
import { baseApi } from "@/redux/services/base-api";
import "@/redux/services/portal-api";

import { RequireParent } from "./guard";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const ME = {
  data: {
    parent: { first_name: "Patricia", full_name: "Mrs. Patricia Okafor", initials: "PO" },
    school: { name: "Lagoon View", logo_url: "" },
    show_branch: false,
    session: null,
    term: null,
    children: [],
  },
};

const ok = () => new Response(JSON.stringify(ME), { status: 200, headers: { "content-type": "application/json" } });
const offline = () => Promise.reject(new TypeError("Failed to fetch"));

function render(fetchImpl: (url: string) => Response | Promise<Response>) {
  globalThis.fetch = vi.fn(async (input: Parameters<typeof fetch>[0]) =>
    fetchImpl(input instanceof Request ? input.url : String(input)),
  ) as unknown as typeof fetch;
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  const store = configureStore({
    reducer: { [baseApi.reducerPath]: baseApi.reducer, auth: authReducer, connectivity: connectivityReducer },
    middleware: (gd) => gd().concat(baseApi.middleware),
  });
  const unlisten = setupListeners(store.dispatch);
  act(() =>
    root.render(
      <Provider store={store}>
        <MemoryRouter initialEntries={["/"]}>
          <Routes>
            <Route path="/" element={<RequireParent><p>Home for Patricia</p></RequireParent>} />
            <Route path="/sign-in" element={<p>Sign in page</p>} />
          </Routes>
        </MemoryRouter>
      </Provider>,
    ),
  );
  return { container, root, unlisten };
}

const settle = () => act(() => new Promise((r) => setTimeout(r, 30)));

let last: { container: HTMLDivElement; root: Root; unlisten: () => void } | null = null;
beforeEach(async () => {
  _resetAccountForTests();
  await setAccount("a-patricia");
  document.cookie = "csrftoken=abc; path=/";
  _resetCsrfCache();
  _resetRefreshForTests();
  setAccessToken("");
  const happy = (window as unknown as { happyDOM?: { setURL: (u: string) => void } }).happyDOM;
  happy?.setURL("http://lagoon-view.localhost:5176/parent/");
});
afterEach(() => {
  if (last) {
    act(() => last!.root.unmount());
    last.unlisten();
    last.container.remove();
    last = null;
  }
});

describe("RequireParent", () => {
  it("offers Try again when the school can't be reached, and opens once it can", async () => {
    let online = false;
    last = render(() => (online ? ok() : offline()));
    await settle();
    expect(last.container.textContent).toContain("Your account can't be loaded right now.");
    expect(last.container.textContent).not.toContain("Sign in page");

    online = true;
    const retry = [...last.container.querySelectorAll("button")].find((b) => b.textContent === "Try again");
    act(() => retry!.click());
    await settle();
    expect(last.container.textContent).toContain("Home for Patricia");
  });

  it("keeps the parent signed in when the sign-in can't be renewed for want of a connection", async () => {
    last = render((url) => {
      if (url.endsWith("/user/auth/device/refresh/")) return offline();
      return new Response("{}", { status: 401 });
    });
    await settle();
    expect(last.container.textContent).toContain("Your account can't be loaded right now.");
    expect(last.container.textContent).not.toContain("Sign in page");
  });

  it("asks again by itself when the connection comes back", async () => {
    let online = false;
    last = render(() => (online ? ok() : offline()));
    await settle();
    expect(last.container.textContent).toContain("Your account can't be loaded right now.");

    online = true;
    act(() => { window.dispatchEvent(new Event("online")); });
    await settle();
    expect(last.container.textContent).toContain("Home for Patricia");
  });

  it("still sends a parent whose sign-in is over back to sign-in", async () => {
    last = render((url) => {
      if (url.endsWith("/user/auth/device/refresh/")) {
        return new Response(JSON.stringify({ error: { code: "TOKEN_EXPIRED" } }), { status: 401 });
      }
      return new Response("{}", { status: 401 });
    });
    await settle();
    expect(last.container.textContent).toContain("Sign in page");
  });
});
