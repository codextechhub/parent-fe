/**
 * Paying by card in the store app: Patricia pays Tobi's First Term balance on
 * the gateway in the phone's in-app browser, not by sending the app's own page
 * away, and nothing in the checkout address marks the payment paid.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { Provider } from "react-redux";
import { MemoryRouter, Route, Routes } from "react-router";
import { configureStore } from "@reduxjs/toolkit";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ open: vi.fn() }));
vi.mock("@/native/platform", () => ({ isNativeApp: () => true, routerBasename: () => "/", nativePlatform: () => "ios" }));
vi.mock("@/native/checkout", () => ({ openCheckout: (...args: unknown[]) => mocks.open(...args) }));

import { setAccessToken } from "@/auth/access-token";
import { _resetRefreshForTests } from "@/auth/refresh";
import { authReducer, meLoaded, type MeData } from "@/redux/features/auth-slice";
import { connectivityReducer } from "@/redux/features/connectivity-slice";
import { baseApi } from "@/redux/services/base-api";
import "@/redux/services/portal-api";

import { PayPage } from "./pay";
import { clearPayAllQueue } from "./pay-all-queue";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const ME = {
  parent: { first_name: "P", full_name: "P", initials: "P" },
  school: { name: "S", logo_url: "" },
  show_branch: false,
  session: null,
  term: null,
  children: [],
} as unknown as MeData;

const INVOICE = {
  invoice_ref: 101, number: "IV-1", title: "First Term", invoice_date: "2026-10-01", due_date: "2026-11-15",
  lines: [{ description: "Tuition", amount: 1_000_000 }], total: 1_000_000, paid: 500_000, balance: 500_000,
  status: "PARTIAL", status_label: "Part-paid",
};
const FEES = {
  data: {
    children: [{
      available: true, child: { id: 11, first_name: "Tobi", full_name: "Tobi O" }, balance: 500_000, owing: 500_000,
      credit: 0, total_billed: 1_000_000, total_paid: 500_000, invoices: [INVOICE], debit_notes: [],
    }],
    combined: { available: true, billed: 1_000_000, paid: 500_000, outstanding: 500_000, credit: 0 },
    card_payments: true,
    min_part_payment: 100_000,
    pay_all: { total: 500_000, charges_total: 0, steps: [], complete: true },
  },
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

function stub(checkout: Response) {
  return vi.fn(async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
    const url = input instanceof Request ? input.url : String(input);
    const method = (input instanceof Request ? input.method : init?.method) ?? "GET";
    if (url.includes("/invoices/101/pay/") && method === "POST") return checkout.clone();
    if (url.includes("/invoices/101/")) return json({ data: { ...INVOICE, child: { id: 11, first_name: "Tobi" } } });
    if (url.includes("/portal/parent/fees/")) return json(FEES);
    return json({});
  });
}

let last: { container: HTMLDivElement; root: Root } | null = null;
function render(fetchImpl: unknown) {
  globalThis.fetch = fetchImpl as typeof fetch;
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
        <MemoryRouter initialEntries={["/fees/pay/101"]}>
          <Routes><Route path="/fees/pay/:invoiceRef" element={<PayPage />} /></Routes>
        </MemoryRouter>
      </Provider>,
    ),
  );
  return { container, root };
}

const settle = () => act(() => new Promise((resolve) => setTimeout(resolve, 40)));
const press = async (container: HTMLElement, text: string) => {
  const button = [...container.querySelectorAll("button")].find((b) => b.textContent?.includes(text));
  await act(async () => button?.click());
  await settle();
};

beforeEach(() => {
  mocks.open.mockReset().mockResolvedValue(undefined);
  clearPayAllQueue();
  setAccessToken("token");
  _resetRefreshForTests();
  document.cookie = "csrftoken=abc; path=/";
  const happy = (window as unknown as { happyDOM?: { setURL: (u: string) => void } }).happyDOM;
  happy?.setURL("https://localhost/fees/pay/101");
});
afterEach(() => {
  if (last) {
    act(() => last!.root.unmount());
    last.container.remove();
    last = null;
  }
});

const CHECKOUT = json({
  data: { checkout_url: "https://checkout.paystack.com/abc", reference: "CXP-1", amount: 500_000, balance_after: 0, child: { id: 11, first_name: "Tobi" } },
});

describe("paying by card in the store app", () => {
  it("opens the gateway in the in-app browser with the payment's reference, and does not navigate the page", async () => {
    const assign = vi.fn();
    Object.defineProperty(window, "location", { value: { ...window.location, assign }, writable: true });
    last = render(stub(CHECKOUT));
    await settle();
    await press(last.container, "Continue to secure payment");
    expect(mocks.open).toHaveBeenCalledWith("https://checkout.paystack.com/abc", "CXP-1");
    expect(assign).not.toHaveBeenCalled();
  });

  it("says so when the browser cannot be opened", async () => {
    mocks.open.mockRejectedValue(new Error("no browser"));
    last = render(stub(CHECKOUT));
    await settle();
    await press(last.container, "Continue to secure payment");
    expect(last.container.textContent).toContain("The payment page couldn't be opened. Try again.");
  });
});
