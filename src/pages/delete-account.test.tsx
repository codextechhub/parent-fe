/**
 * Deleting the parent's own account. Patricia's account closes at once: the
 * screen says what stays with the school, sends the confirmation, and on
 * `closed` takes her off this device. A teacher who is also a parent is told
 * the option is not offered, and sees no entry on Profile.
 */
import { act } from "react";
import { createRoot } from "react-dom/client";
import { Provider } from "react-redux";
import { MemoryRouter, Route, Routes } from "react-router";
import { configureStore } from "@reduxjs/toolkit";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const phone = vi.hoisted(() => ({ native: true, credentials: new Map<string, string>() }));
vi.mock("@/native/platform", () => ({ isNativeApp: () => phone.native, routerBasename: () => "/" }));
vi.mock("@/native/credentials", () => ({
  getCredential: vi.fn(async (account: string) => phone.credentials.get(account) ?? null),
  putCredential: vi.fn(async (account: string, refresh: string) => void phone.credentials.set(account, refresh)),
  deleteCredential: vi.fn(async (account: string) => void phone.credentials.delete(account)),
}));

import { getAccessToken, setAccessToken } from "@/auth/access-token";
import { _resetAccountForTests, getAccount, setAccount } from "@/auth/device-account";
import { _resetRefreshForTests } from "@/auth/refresh";
import { DeleteAccountRow } from "@/components/delete-account-card";
import { pushChoice, setPushChoice } from "@/push/push-choice";
import { authReducer, meLoaded, type MeData } from "@/redux/features/auth-slice";
import { connectivityReducer } from "@/redux/features/connectivity-slice";
import { baseApi } from "@/redux/services/base-api";
import "@/redux/services/portal-api";

import { DeleteAccountPage } from "./delete-account";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const ME = {
  parent: { first_name: "Patricia", full_name: "Patricia Okafor", initials: "PO" },
  school: { name: "Lagoon View", logo_url: "" },
  show_branch: false, session: null, term: null, children: [],
} as unknown as MeData;

type World = { state: Response; confirm: Response; posts: number };
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const ELIGIBLE = () => json({ data: { eligible: true, mode: "close", pending: null } });

function render(world: World, path: "/profile/delete-account" | "/profile") {
  globalThis.fetch = vi.fn(async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
    const url = input instanceof Request ? input.url : String(input);
    const method = (input instanceof Request ? input.method : init?.method) ?? "GET";
    if (url.includes("/user/me/account-closure/")) {
      if (method === "POST") {
        world.posts += 1;
        return world.confirm.clone();
      }
      return world.state.clone();
    }
    return json({});
  }) as unknown as typeof fetch;
  const store = configureStore({
    reducer: { [baseApi.reducerPath]: baseApi.reducer, auth: authReducer, connectivity: connectivityReducer },
    middleware: (gd) => gd().concat(baseApi.middleware),
  });
  store.dispatch(meLoaded(ME));
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() =>
    root.render(
      <Provider store={store}>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/profile/delete-account" element={<DeleteAccountPage />} />
            <Route path="/profile" element={<DeleteAccountRow />} />
            <Route path="/sign-in" element={<p>Sign-in screen</p>} />
          </Routes>
        </MemoryRouter>
      </Provider>,
    ),
  );
  return { container, root, store };
}

const settle = () => act(() => new Promise((resolve) => setTimeout(resolve, 40)));

let last: ReturnType<typeof render> | null = null;
beforeEach(async () => {
  phone.native = true;
  phone.credentials.clear();
  _resetRefreshForTests();
  _resetAccountForTests();
  await setAccount("n-1");
  phone.credentials.set("n-1", "r-1");
  setAccessToken("access");
  setPushChoice("on");
  document.cookie = "csrftoken=abc; path=/";
  const happy = (window as unknown as { happyDOM?: { setURL: (u: string) => void } }).happyDOM;
  happy?.setURL("https://localhost/profile/delete-account");
});
afterEach(() => {
  if (last) {
    act(() => last!.root.unmount());
    last.container.remove();
    last = null;
  }
  setPushChoice(null);
});

describe("deleting the account", () => {
  it("says what happens, then closes the account and takes the parent off this device", async () => {
    const world: World = { state: ELIGIBLE(), confirm: json({ data: { status: "closed" } }), posts: 0 };
    last = render(world, "/profile/delete-account");
    await settle();
    const text = last.container.textContent ?? "";
    expect(text).toContain("Your sign-in will be closed now.");
    expect(text).toContain("Your children's school records, results and fees stay with the school.");

    const button = [...last.container.querySelectorAll("button")].find((b) => b.textContent?.includes("Delete my account now"));
    await act(async () => button?.click());
    await settle();
    expect(world.posts).toBe(1);
    expect(last.container.textContent).toContain("Sign-in screen");
    expect(getAccessToken()).toBe("");
    expect(await getAccount()).toBeNull();
    expect(phone.credentials.has("n-1")).toBe(false);
    expect(pushChoice()).toBeNull();
    expect(last.store.getState().auth.me).toBeNull();
  });

  it("sends exactly the confirmation", async () => {
    const world: World = { state: ELIGIBLE(), confirm: json({ data: { status: "closed" } }), posts: 0 };
    last = render(world, "/profile/delete-account");
    await settle();
    const bodies: string[] = [];
    const base = globalThis.fetch;
    globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
      if (input instanceof Request && input.method === "POST") bodies.push(await input.clone().text());
      return base(input, init);
    }) as typeof fetch;
    const button = [...last.container.querySelectorAll("button")].find((b) => b.textContent?.includes("Delete my account now"));
    await act(async () => button?.click());
    await settle();
    expect(JSON.parse(bodies[0])).toEqual({ confirm: true });
  });

  it("keeps the parent signed in when the school refuses", async () => {
    const world: World = {
      state: ELIGIBLE(),
      confirm: json({ message: "Your account can't be closed right now." }, 409),
      posts: 0,
    };
    last = render(world, "/profile/delete-account");
    await settle();
    const button = [...last.container.querySelectorAll("button")].find((b) => b.textContent?.includes("Delete my account now"));
    await act(async () => button?.click());
    await settle();
    expect(last.container.querySelector('[role="alert"]')?.textContent).toContain("can't be closed");
    expect(getAccessToken()).toBe("access");
    expect(phone.credentials.get("n-1")).toBe("r-1");
  });

  it("says deletion is not available for an account the school does not offer it to, and offers no button", async () => {
    const world: World = {
      state: json({ error: { code: "ACCOUNT_CLOSURE_NOT_OFFERED" }, message: "No" }, 403),
      confirm: json({}),
      posts: 0,
    };
    last = render(world, "/profile/delete-account");
    await settle();
    expect(last.container.textContent).toContain("isn't available here for this account");
    expect([...last.container.querySelectorAll("button")].some((b) => b.textContent?.includes("Delete my account now"))).toBe(false);
  });

  it("shows the date of a request already with the school, instead of the button", async () => {
    const world: World = {
      state: json({ data: { eligible: false, mode: "request", pending: { requested_at: "2026-10-20T10:00:00Z" } } }),
      confirm: json({}),
      posts: 0,
    };
    last = render(world, "/profile/delete-account");
    await settle();
    expect(last.container.textContent).toContain("Your request is with the school since");
    expect([...last.container.querySelectorAll("button")].some((b) => b.textContent?.includes("Delete my account"))).toBe(false);
  });
});

describe("the entry on Profile", () => {
  it("shows for an eligible parent", async () => {
    last = render({ state: ELIGIBLE(), confirm: json({}), posts: 0 }, "/profile");
    await settle();
    expect(last.container.querySelector('a[href="/profile/delete-account"]')).not.toBeNull();
  });

  it("is absent on a 403 and for a parent who is not eligible", async () => {
    last = render({ state: json({ error: { code: "ACCOUNT_CLOSURE_NOT_OFFERED" } }, 403), confirm: json({}), posts: 0 }, "/profile");
    await settle();
    expect(last.container.textContent).toBe("");
    act(() => last!.root.unmount());
    last.container.remove();
    last = render({ state: json({ data: { eligible: false, mode: null, pending: null } }), confirm: json({}), posts: 0 }, "/profile");
    await settle();
    expect(last.container.textContent).toBe("");
  });
});
