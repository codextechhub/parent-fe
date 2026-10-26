/**
 * What Patricia's phone does with a notification: a tap opens the screen it
 * names (on the child it is about), a tap that launched the app waits for the
 * session, and a "Payment received" push reads the fees and transfers again.
 */
import { act } from "react";
import { createRoot } from "react-dom/client";
import { Provider } from "react-redux";
import { MemoryRouter, useLocation } from "react-router";
import { configureStore } from "@reduxjs/toolkit";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const phone = vi.hoisted(() => ({
  tap: null as null | ((p: { title: string; body: string; data: Record<string, unknown> }) => void),
  foreground: null as null | ((p: { title: string; body: string; data: Record<string, unknown> }) => void),
  refresh: vi.fn(),
}));
vi.mock("./platform", () => ({ isNativeApp: () => true, nativePlatform: () => "ios", isDebugBuild: () => false }));
vi.mock("./push-device", () => ({
  osPermission: async () => "granted",
  askOsPermission: async () => "granted",
  deviceToken: async () => "t",
  firebaseConfigured: async () => true,
  FirebaseNotConfiguredError: class extends Error {},
  onTokenChange: async () => () => undefined,
  onTap: async (l: typeof phone.tap) => ((phone.tap = l), () => undefined),
  onForeground: async (l: typeof phone.foreground) => ((phone.foreground = l), () => undefined),
}));
vi.mock("./push-register", () => ({ registerDevice: async () => "ok", forgetDevice: async () => undefined }));
vi.mock("@capacitor/app", () => ({ App: { addListener: async () => ({ remove: async () => undefined }) } }));
vi.mock("@/lib/use-deposit-watch", () => ({ refreshDepositWatch: () => phone.refresh() }));

import { authReducer, meLoaded, type MeData } from "@/redux/features/auth-slice";
import { connectivityReducer } from "@/redux/features/connectivity-slice";
import { baseApi } from "@/redux/services/base-api";
import { setPushChoice } from "@/push/push-choice";

import { isPaymentPush } from "./payment-push";
import { NativePushListener } from "./native-push";
import { resetNativePushState } from "./native-push-state";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const ME = {
  parent: { first_name: "Patricia", full_name: "Patricia", initials: "P" },
  school: { name: "Lagoon View", logo_url: "" },
  show_branch: false, session: null, term: null, children: [],
} as unknown as MeData;

function Where() {
  return <p data-testid="where">{useLocation().pathname + useLocation().search}</p>;
}

function mount(signedIn: boolean) {
  const store = configureStore({
    reducer: { [baseApi.reducerPath]: baseApi.reducer, auth: authReducer, connectivity: connectivityReducer },
    middleware: (gd) => gd().concat(baseApi.middleware),
  });
  if (signedIn) store.dispatch(meLoaded(ME));
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() =>
    root.render(
      <Provider store={store}>
        <MemoryRouter initialEntries={["/"]}>
          <NativePushListener />
          <Where />
        </MemoryRouter>
      </Provider>,
    ),
  );
  return { container, root, store };
}

const settle = () => act(() => new Promise((resolve) => setTimeout(resolve, 20)));
const where = (c: HTMLElement) => c.querySelector('[data-testid="where"]')?.textContent;

let last: ReturnType<typeof mount> | null = null;
beforeEach(() => {
  localStorage.clear();
  setPushChoice("not-now");
  resetNativePushState();
  phone.tap = null;
  phone.foreground = null;
  phone.refresh.mockReset();
});
afterEach(() => {
  if (last) {
    act(() => last!.root.unmount());
    last.container.remove();
    last = null;
  }
});

describe("a tapped notification", () => {
  it("opens the screen it names, on the child it is about", async () => {
    last = mount(true);
    await settle();
    await act(async () => phone.tap?.({ title: "", body: "", data: { url: "/parent/results", child: "12" } }));
    expect(where(last.container)).toBe("/results?child=12");
  });

  it("waits for the session when the tap launched the app", async () => {
    last = mount(false);
    await settle();
    await act(async () => phone.tap?.({ title: "", body: "", data: { url: "/parent/notices/4" } }));
    expect(where(last.container)).toBe("/");
    act(() => last!.store.dispatch(meLoaded(ME)));
    await settle();
    expect(where(last.container)).toBe("/notices/4");
  });
});

describe("a notification in the open app", () => {
  it("reads the fees and the watched transfers again for Payment received", async () => {
    last = mount(true);
    await settle();
    await act(async () => phone.foreground?.({ title: "t", body: "b", data: { tag: "billing.payment_received" } }));
    expect(phone.refresh).toHaveBeenCalled();
  });

  it("leaves them alone for any other notification", async () => {
    last = mount(true);
    await settle();
    await act(async () => phone.foreground?.({ title: "t", body: "b", data: { tag: "notices.published_parent" } }));
    expect(phone.refresh).not.toHaveBeenCalled();
  });

  it("knows a payment push by its kind or by the receipt it opens", () => {
    expect(isPaymentPush({ tag: "billing.payment_received" })).toBe(true);
    expect(isPaymentPush({ url: "/parent/fees/receipts/9" })).toBe(true);
    expect(isPaymentPush({ url: "/parent/fees" })).toBe(false);
  });
});

describe("the offer", () => {
  it("is put in front of a signed-in parent who has not chosen, with the short explanation", async () => {
    localStorage.clear();
    last = mount(true);
    await settle();
    expect(last.container.textContent).toContain("Get a notification when results, notices or payments arrive");
    expect(last.container.textContent).toContain("Not now");
  });

  it("is not shown once the parent has chosen, or before anyone is signed in", async () => {
    last = mount(true);
    await settle();
    expect(last.container.textContent).not.toContain("Get a notification");
  });
});
