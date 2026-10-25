import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { Provider } from "react-redux";
import { MemoryRouter } from "react-router";
import { configureStore } from "@reduxjs/toolkit";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { setAccessToken } from "@/auth/access-token";
import { _resetCsrfCache } from "@/auth/csrf";
import { _resetRefreshForTests } from "@/auth/refresh";
import { authReducer } from "@/redux/features/auth-slice";
import { connectivityReducer } from "@/redux/features/connectivity-slice";
import { baseApi } from "@/redux/services/base-api";
import "@/redux/services/portal-api";
import "@/redux/services/payment-notices-api";

import { PaymentNotices } from "./payment-notices";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const row = (over: Record<string, unknown> = {}) => ({
  id: "6f0d9c52-0000-4000-8000-000000000001",
  event_type_key: "billing.payment_received",
  event_type_label: "Payment received",
  channel: "IN_APP",
  subject: "₦500.00 received from Amaka Okafor",
  body: "Receipt RCP-0007, 25 Oct 2026, applied to INV-0012.",
  action_url: "/finance",
  is_read: false,
  created_at: "2026-10-25T09:30:00Z",
  ...over,
});

const PAYMENT = {
  payment_ref: 42,
  reference: "COL-1",
  amount: 50000,
  status: "CONFIRMED",
  status_label: "Confirmed",
  method: "TRANSFER",
  method_label: "Bank transfer",
  paid_on: "2026-10-25",
  payer_name: "",
  receipt_number: "RCP-0007",
  invoice_number: "INV-0012",
  has_receipt: true,
  child: { id: 11, first_name: "Amaka" },
};

type Calls = { url: string; method: string; body: string }[];

/** A school that answers the feed with `feed` and the family's payments with `payments`. */
function school(feed: unknown[], payments: unknown[] = [PAYMENT]) {
  const calls: Calls = [];
  const impl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = input instanceof Request ? input : null;
    const url = request ? request.url : String(input);
    const method = (request?.method ?? init?.method ?? "GET").toUpperCase();
    const body = request ? await request.clone().text() : String(init?.body ?? "");
    calls.push({ url, method, body });
    const json = (data: unknown) =>
      new Response(JSON.stringify(data), { status: 200, headers: { "content-type": "application/json" } });
    if (url.includes("/notify/mark-read/")) return json({ data: { updated_count: 1 } });
    if (url.includes("/notify/")) return json({ data: feed });
    if (url.includes("/fees/payments/")) return json({ data: payments });
    return json({ data: {} });
  });
  return { impl: impl as unknown as typeof fetch, calls };
}

function render(fetchImpl: typeof fetch) {
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
  act(() =>
    root.render(
      <Provider store={store}>
        <MemoryRouter initialEntries={["/"]}>
          <PaymentNotices />
        </MemoryRouter>
      </Provider>,
    ),
  );
  return { container, root };
}

const settle = () => act(() => new Promise((r) => setTimeout(r, 30)));

let last: { container: HTMLDivElement; root: Root } | null = null;
beforeEach(() => {
  document.cookie = "csrftoken=abc; path=/";
  _resetCsrfCache();
  _resetRefreshForTests();
  setAccessToken("token");
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

describe("PaymentNotices", () => {
  it("shows an unread payment notice that opens its receipt", async () => {
    const { impl, calls } = school([row()]);
    last = render(impl);
    await settle();
    const text = last.container.textContent ?? "";
    expect(text).toContain("Payments");
    expect(text).toContain("Payment received for Amaka, ₦500.00");
    expect(text).toContain("25 Oct 2026");
    expect(last.container.querySelector("a")?.getAttribute("href")).toBe("/fees/receipts/42");
    const feed = calls.find((c) => c.url.includes("/notify/") && !c.url.includes("mark-read"));
    expect(feed?.url).toContain("event_type_key=billing.payment_received");
    expect(feed?.url).toContain("is_read=false");
  });

  it("opens Fees when the receipt is not among the payments yet", async () => {
    const { impl } = school([row()], []);
    last = render(impl);
    await settle();
    expect(last.container.querySelector("a")?.getAttribute("href")).toBe("/fees");
  });

  it("marks the notice read when it is opened and takes it off the screen", async () => {
    const { impl, calls } = school([row()]);
    last = render(impl);
    await settle();
    act(() => {
      last!.container.querySelector("a")!.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    });
    await settle();
    const marked = calls.find((c) => c.url.includes("/notify/mark-read/"));
    expect(marked?.method).toBe("POST");
    expect(JSON.parse(marked!.body)).toEqual({ ids: [row().id] });
    expect(last.container.textContent).not.toContain("Payment received for Amaka");
  });

  it("draws nothing when there is no unread payment notice", async () => {
    const { impl, calls } = school([]);
    last = render(impl);
    await settle();
    expect(last.container.textContent).toBe("");
    // With nothing to match, the family's payments are not read.
    expect(calls.some((c) => c.url.includes("/fees/payments/"))).toBe(false);
  });

  it("leaves out notices that are not payments, and payments already read", async () => {
    const { impl } = school([
      row({ id: "6f0d9c52-0000-4000-8000-000000000002", event_type_key: "billing.guardian_invoice_issued", subject: "New bill for Amaka" }),
      row({ id: "6f0d9c52-0000-4000-8000-000000000003", is_read: true }),
    ]);
    last = render(impl);
    await settle();
    expect(last.container.textContent).toBe("");
  });

  it("draws nothing when the feed cannot be read", async () => {
    const failing = vi.fn(async () => new Response("{}", { status: 500 })) as unknown as typeof fetch;
    last = render(failing);
    await settle();
    expect(last.container.textContent).toBe("");
  });
});
