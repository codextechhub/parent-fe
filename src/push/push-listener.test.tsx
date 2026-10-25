/**
 * What the open app does with the service worker's messages.
 *
 * A booked-payment push arriving while Patricia has Fees open reads the
 * balances and the watched transfers again at once; a tap on the push opens the
 * receipt the school named.
 */
import { act } from "react";
import { createRoot } from "react-dom/client";
import { Provider } from "react-redux";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import { configureStore } from "@reduxjs/toolkit";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { authReducer } from "@/redux/features/auth-slice";
import { baseApi } from "@/redux/services/base-api";

import { PushListener } from "./push-listener";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const refreshWatch = vi.hoisted(() => vi.fn());
vi.mock("@/lib/use-deposit-watch", () => ({ refreshDepositWatch: refreshWatch }));

function Where() {
  return <p data-testid="where">{useLocation().pathname}</p>;
}

let worker: EventTarget;
beforeEach(() => {
  refreshWatch.mockClear();
  worker = new EventTarget();
  Object.defineProperty(navigator, "serviceWorker", { configurable: true, value: worker });
});
afterEach(() => {
  vi.restoreAllMocks();
  Object.defineProperty(navigator, "serviceWorker", { configurable: true, value: undefined });
});

function mount() {
  const store = configureStore({
    reducer: { [baseApi.reducerPath]: baseApi.reducer, auth: authReducer },
    middleware: (gd) => gd().concat(baseApi.middleware),
  });
  const invalidate = vi.spyOn(baseApi.util, "invalidateTags");
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() =>
    root.render(
      <Provider store={store}>
        <MemoryRouter initialEntries={["/fees"]}>
          <PushListener />
          <Routes><Route path="*" element={<Where />} /></Routes>
        </MemoryRouter>
      </Provider>,
    ),
  );
  return { container, root, invalidate };
}

const send = (data: unknown) => act(() => { worker.dispatchEvent(new MessageEvent("message", { data })); });

describe("PushListener", () => {
  it("reads fees and watched transfers again when a Payment received push arrives", () => {
    const { invalidate, root } = mount();
    send({ type: "xvs-parent-push-received", tag: "billing.payment_received" });
    expect(invalidate).toHaveBeenCalledWith(["Fees", "Me", "Payments", "PaymentNotices"]);
    expect(refreshWatch).toHaveBeenCalledTimes(1);
    act(() => root.unmount());
  });

  it("leaves other pushes alone", () => {
    const { invalidate, root } = mount();
    send({ type: "xvs-parent-push-received", tag: "notices.published_parent" });
    expect(invalidate).not.toHaveBeenCalled();
    expect(refreshWatch).not.toHaveBeenCalled();
    act(() => root.unmount());
  });

  it("opens the receipt a tapped push names", () => {
    const { container, root } = mount();
    send({ type: "xvs-parent-push-open", path: "/parent/fees/receipts/88" });
    expect(container.querySelector("[data-testid=where]")?.textContent).toBe("/fees/receipts/88");
    act(() => root.unmount());
  });
});
