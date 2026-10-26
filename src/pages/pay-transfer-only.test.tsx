/**
 * Paying one bill, reading an invoice and opening Home where families pay by
 * bank transfer alone, and the stale screen that still offers a card.
 *
 * Patricia opens Tobi's bill. With card off she sees Tobi's account and no
 * card choice; if her screen was opened before the school turned card off, the
 * server answers her card attempt with 409 CARD_PAYMENTS_OFF and the screen
 * becomes the transfer view with a plain line.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { Provider } from "react-redux";
import { MemoryRouter, Route, Routes } from "react-router";
import { configureStore } from "@reduxjs/toolkit";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { setAccessToken } from "@/auth/access-token";
import { _resetCsrfCache } from "@/auth/csrf";
import { _resetRefreshForTests } from "@/auth/refresh";
import { _resetDepositWatcherForTests } from "@/lib/use-deposit-watch";
import { authReducer, meLoaded, type MeData } from "@/redux/features/auth-slice";
import { connectivityReducer } from "@/redux/features/connectivity-slice";
import { baseApi } from "@/redux/services/base-api";
import "@/redux/services/portal-api";

import { HomePage } from "./home";
import { InvoicePage } from "./invoice";
import { PayAllPage } from "./pay-all";
import { PayPage } from "./pay";
import { clearPayAllQueue } from "./pay-all-queue";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const ME = {
  parent: { first_name: "Patricia", full_name: "Mrs. Patricia Okafor", initials: "PO" },
  school: { name: "Lagoon View", logo_url: "" },
  show_branch: false,
  session: null,
  term: null,
  children: [{ id: 11, first_name: "Tobi", full_name: "Tobi Okafor", initials: "TO", photo_url: "", admission_number: "A1", class_name: "JSS1 A", relationship: "Mother" }],
} as unknown as MeData;

const INVOICE = {
  invoice_ref: 101, number: "IV-1", title: "First Term", invoice_date: "2026-10-01", due_date: "2026-11-15",
  lines: [{ description: "Tuition", amount: 1_000_000 }], total: 1_000_000, paid: 500_000, balance: 500_000,
  status: "PARTIAL", status_label: "Part-paid",
};

function fees(cardPayments: boolean) {
  return {
    children: [{
      available: true, child: { id: 11, first_name: "Tobi", full_name: "Tobi Okafor" },
      balance: 500_000, owing: 500_000, credit: 0, total_billed: 1_000_000, total_paid: 500_000,
      invoices: [INVOICE], debit_notes: [],
    }],
    combined: { available: true, billed: 1_000_000, paid: 500_000, outstanding: 500_000, credit: 0 },
    card_payments: cardPayments,
    min_part_payment: 100_000,
    pay_all: { total: 500_000, charges_total: 0, steps: [{ child_id: 11, first_name: "Tobi", invoice_ref: 101, number: "IV-1", title: "First Term", amount: 500_000 }], complete: true },
  };
}

const HOME = {
  date: "2026-10-25",
  children: [{
    id: 11, first_name: "Tobi", class_name: "JSS1 A",
    attendance: { available: true, rate: 92 },
    fees: { available: true, balance: 500_000, owing: 500_000, credit: 0, status: "OWING", open_invoice_count: 1, open_charge_count: 0 },
    results: { available: true, released: false },
  }],
  fees: { available: true, outstanding: 500_000, credit: 0, pay_all_total: 500_000 },
  notices: { available: true, latest: null, unread_count: 0 },
  notifications: { available: true, unread_count: 0 },
};

function reply(data: unknown, status = 200, error?: unknown) {
  const body = status < 400 ? { success: true, message: "", data } : { success: false, message: String(data), error };
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

type World = { cardPayments: boolean; payStatus: number; calls: string[] };

function stub(world: World) {
  return vi.fn(async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
    const url = input instanceof Request ? input.url : String(input);
    const method = (input instanceof Request ? input.method : init?.method) ?? "GET";
    world.calls.push(`${method} ${url.replace(/^https?:\/\/[^/]+\/v1/, "").replace(/[?&]tenant=[^&]*/, "")}`);
    if (url.includes("/pay/") && method === "POST") {
      return reply("Card payments are off.", world.payStatus, { code: "CARD_PAYMENTS_OFF" });
    }
    if (url.includes("/transfer-account/deposits/")) return reply({ as_of: "2026-10-25T09:00:00Z", deposits: [] });
    if (url.includes("/transfer-account/")) {
      return reply({ state: "ISSUED", bank_name: "Wema Bank", account_number: "0123456011", account_name: "Lagoon View / Okafor", as_of: "2026-10-25T09:00:00Z" });
    }
    if (url.includes("/invoices/101/")) return reply({ ...INVOICE, child: { id: 11, first_name: "Tobi" } });
    if (url.includes("/portal/parent/home/")) return reply(HOME);
    if (/\/portal\/parent\/fees\/(\?.*)?$/.test(url)) return reply(fees(world.cardPayments));
    return new Response("{}", { status: 200 });
  });
}

function render(world: World, path: string) {
  globalThis.fetch = stub(world) as unknown as typeof fetch;
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
            <Route path="/" element={<HomePage />} />
            <Route path="/fees" element={<p>Fees screen</p>} />
            <Route path="/fees/pay/:invoiceRef" element={<PayPage />} />
            <Route path="/fees/pay-all" element={<PayAllPage />} />
            <Route path="/fees/invoices/:invoiceRef" element={<InvoicePage />} />
          </Routes>
        </MemoryRouter>
      </Provider>,
    ),
  );
  return { container, root };
}

const settle = () => act(() => new Promise((resolve) => setTimeout(resolve, 40)));
const button = (container: HTMLElement, text: string) =>
  [...container.querySelectorAll("button")].find((b) => b.textContent?.includes(text));

let last: { container: HTMLDivElement; root: Root } | null = null;
beforeEach(() => {
  document.cookie = "csrftoken=abc; path=/";
  _resetCsrfCache();
  _resetRefreshForTests();
  setAccessToken("stale");
  clearPayAllQueue();
  _resetDepositWatcherForTests();
  const happy = (window as unknown as { happyDOM?: { setURL: (u: string) => void } }).happyDOM;
  happy?.setURL("http://lagoon-view.localhost:5176/parent/");
});
afterEach(() => {
  if (last) {
    act(() => last!.root.unmount());
    last.container.remove();
    last = null;
  }
  _resetDepositWatcherForTests();
});

describe("Pay a bill where families pay by transfer alone", () => {
  it("shows the child's account with no card choice", async () => {
    last = render({ cardPayments: false, payStatus: 409, calls: [] }, "/fees/pay/101");
    await settle();
    const text = last.container.textContent ?? "";
    expect(text).toContain("Pay into Tobi's account");
    expect(text).toContain("0123456011");
    expect(text).toContain("Owing ₦5,000.00");
    expect(text).toContain("It shows here as soon as it arrives.");
    expect(last.container.querySelector(".pay-section-heading h2")?.textContent).toBe("Pay by bank transfer");
    expect(last.container.querySelector(".pay-help")).toBeNull();
    expect(last.container.querySelector(".fees-transfer-waiting")?.textContent).toBe(
      "Waiting for your transfer. Keep this page open to see it arrive.",
    );
    expect(text).not.toContain("How would you like to pay?");
    expect(text).not.toContain("Continue to secure payment");
    expect(text).not.toContain("Card");
  });

  it("sends a stale Pay all link back to Fees", async () => {
    last = render({ cardPayments: false, payStatus: 409, calls: [] }, "/fees/pay-all");
    await settle();
    expect(last.container.textContent).toBe("Fees screen");
  });

  it("turns a 409 CARD_PAYMENTS_OFF from a stale screen into the transfer view with a plain line", async () => {
    const world = { cardPayments: true, payStatus: 409, calls: [] as string[] };
    last = render(world, "/fees/pay/101");
    await settle();
    expect(last.container.textContent).toContain("Continue to secure payment");

    world.cardPayments = false;
    await act(async () => button(last!.container, "Continue to secure payment")?.click());
    await settle();
    const text = last.container.textContent ?? "";
    expect(world.calls.filter((call) => call === "GET /portal/parent/fees/").length).toBeGreaterThan(1);
    expect(text).toContain("Card payments aren't available at this school. Pay by bank transfer into Tobi's account number instead.");
    expect(text).toContain("0123456011");
    expect(text).not.toContain("Continue to secure payment");
    expect(text).not.toContain("How would you like to pay?");
  });

  it("still shows the transfer view when the refresh after a 409 has not arrived", async () => {
    const world = { cardPayments: true, payStatus: 409, calls: [] as string[] };
    last = render(world, "/fees/pay/101");
    await settle();
    await act(async () => button(last!.container, "Continue to secure payment")?.click());
    await settle();
    expect(last.container.textContent).toContain("0123456011");
  });
});

describe("Pay a bill where the school takes cards", () => {
  it("still offers card and bank transfer", async () => {
    last = render({ cardPayments: true, payStatus: 409, calls: [] }, "/fees/pay/101");
    await settle();
    expect(last.container.textContent).toContain("How would you like to pay?");
    expect(last.container.textContent).toContain("Continue to secure payment");
  });
});

describe("Invoice where families pay by transfer alone", () => {
  it("puts the child's account where Pay this invoice would be", async () => {
    last = render({ cardPayments: false, payStatus: 409, calls: [] }, "/fees/invoices/101");
    await settle();
    expect(last.container.textContent).toContain("0123456011");
    expect(last.container.textContent).not.toContain("Pay this invoice");
    expect(last.container.querySelector('a[href="/fees/pay/101"]')).toBeNull();
  });

  it("keeps Pay this invoice where the school takes cards", async () => {
    last = render({ cardPayments: true, payStatus: 409, calls: [] }, "/fees/invoices/101");
    await settle();
    expect(last.container.textContent).toContain("Pay this invoice");
    expect(last.container.textContent).not.toContain("0123456011");
  });
});

describe("Home where families pay by transfer alone", () => {
  it("points to the account cards on Fees", async () => {
    last = render({ cardPayments: false, payStatus: 409, calls: [] }, "/");
    await settle();
    expect(last.container.textContent).toContain("Pay by transfer to each child's account on the Fees screen.");
  });

  it("says nothing of transfer where the school takes cards", async () => {
    last = render({ cardPayments: true, payStatus: 409, calls: [] }, "/");
    await settle();
    expect(last.container.textContent).toContain("still due on bills and charges");
    expect(last.container.textContent).not.toContain("Pay by transfer to each child's account");
  });
});
