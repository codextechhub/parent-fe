import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { Provider } from "react-redux";
import { MemoryRouter } from "react-router";
import { configureStore } from "@reduxjs/toolkit";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { setAccessToken } from "@/auth/access-token";
import { _resetCsrfCache } from "@/auth/csrf";
import { _resetRefreshForTests } from "@/auth/refresh";
import { authReducer, meLoaded, type MeData } from "@/redux/features/auth-slice";
import { connectivityReducer } from "@/redux/features/connectivity-slice";
import { baseApi } from "@/redux/services/base-api";
import "@/redux/services/portal-api";

import { FeesPage } from "./fees";
import { readPayAllQueue, savePayAllQueue } from "./pay-all-queue";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const ME: MeData = {
  parent: { first_name: "Patricia", full_name: "Patricia", initials: "P" },
  school: { name: "Lagoon View", logo_url: "" },
  show_branch: false,
  session: null,
  term: null,
  children: [
    { id: 11, first_name: "Tobi", full_name: "Tobi O", initials: "TO", photo_url: "", admission_number: "", class_name: "JSS1 A", relationship: "Mother" },
    { id: 22, first_name: "Somto", full_name: "Somto O", initials: "SO", photo_url: "", admission_number: "", class_name: "Primary 4", relationship: "Mother" },
  ],
};

function fees(overrides: Record<string, unknown> = {}) {
  return {
    success: true,
    message: "",
    data: {
      children: [
        {
          available: true,
          child: { id: 11, first_name: "Tobi", full_name: "Tobi O" },
          balance: 500000,
          owing: 500000,
          credit: 0,
          total_billed: 1000000,
          total_paid: 500000,
          invoices: [
            {
              invoice_ref: 101,
              number: "IV-1",
              title: "First Term",
              invoice_date: "2026-10-01",
              due_date: "2026-11-15",
              lines: [{ description: "Tuition", amount: 1000000 }],
              total: 1000000,
              paid: 500000,
              balance: 500000,
              status: "PARTIAL",
              status_label: "Part-paid",
            },
          ],
          debit_notes: [],
        },
        {
          available: true,
          child: { id: 22, first_name: "Somto", full_name: "Somto O" },
          balance: 0,
          owing: 0,
          credit: 0,
          total_billed: 500000,
          total_paid: 500000,
          invoices: [],
          debit_notes: [],
        },
      ],
      combined: { available: true, billed: 1500000, paid: 1000000, outstanding: 500000, credit: 0 },
      min_part_payment: 100000,
      pay_all: {
        total: 500000,
        charges_total: 0,
        steps: [
          { child_id: 11, first_name: "Tobi", invoice_ref: 101, number: "IV-1", title: "First Term", amount: 500000 },
        ],
        complete: true,
      },
      ...overrides,
    },
  };
}

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

function stub(payload: ReturnType<typeof fees>) {
  return vi.fn(async (input: Parameters<typeof fetch>[0]) => {
    const url = input instanceof Request ? input.url : String(input);
    if (url.includes("/portal/parent/fees/payments/")) {
      return new Response(JSON.stringify({ success: true, message: "", data: [] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    if (url.includes("/portal/parent/fees/")) {
      return new Response(JSON.stringify(payload), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    if (url.includes("/transfer-account/")) {
      return new Response(
        JSON.stringify({ success: true, message: "", data: { state: "NONE", as_of: "2026-10-19T00:00:00Z" } }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }
    return new Response("{}", { status: 200 });
  });
}

function render(fetchImpl: typeof fetch) {
  globalThis.fetch = fetchImpl;
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() =>
    root.render(
      <Provider store={makeStore()}>
        <MemoryRouter initialEntries={["/fees"]}>
          <FeesPage />
        </MemoryRouter>
      </Provider>,
    ),
  );
  return { container, root };
}

let last: { container: HTMLDivElement; root: Root } | null = null;
beforeEach(() => {
  document.cookie = "csrftoken=abc; path=/";
  _resetCsrfCache();
  _resetRefreshForTests();
  setAccessToken("stale");
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

describe("FeesPage", () => {
  it("starts Pay all balances with a fresh queue", async () => {
    savePayAllQueue({ steps: [{ child_id: 99, first_name: "Old", invoice_ref: 999, number: "IV-OLD", title: "Old bill", amount: 999999 }], index: 0 });
    const r = render(stub(fees()) as unknown as typeof fetch);
    last = r;
    await act(() => new Promise((resolve) => setTimeout(resolve, 30)));
    const payAll = r.container.querySelector<HTMLAnchorElement>('a[href="/fees/pay-all"]');
    expect(payAll).not.toBeNull();
    await act(async () => payAll?.click());
    expect(readPayAllQueue()).toBeNull();
  });

  it("shows the combined outstanding and the per-child cards", async () => {
    const r = render(stub(fees()) as unknown as typeof fetch);
    last = r;
    await act(() => new Promise((r) => setTimeout(r, 30)));
    expect(r.container.textContent).toContain("Total left to pay");
    expect(r.container.textContent).toContain("₦5,000.00");
    expect(r.container.textContent).toContain("Tobi");
    expect(r.container.textContent).toContain("Somto");
    // Somto has no invoices - "No bills yet" rather than "All paid".
    expect(r.container.textContent).toContain("No bills yet");
    expect(r.container.textContent).toContain("Pay all balances");
    // Bill details stay out of the initial view.
    expect(r.container.textContent).not.toContain("Tuition");
    const bills = r.container.querySelector<HTMLButtonElement>('[aria-controls="fees-child-bills-11"]');
    expect(bills?.getAttribute("aria-expanded")).toBe("false");
    await act(async () => bills?.click());
    expect(bills?.getAttribute("aria-expanded")).toBe("true");
    expect(r.container.textContent).toContain("First Term");
    expect(r.container.querySelector('a[href="/fees/invoices/101"]')).not.toBeNull();
  });

  it("shows the sentence instead of a figure when combined is unavailable", async () => {
    const r = render(
      stub(
        fees({ combined: { available: false, message: "Family fees cannot be shown right now." } }),
      ) as unknown as typeof fetch,
    );
    last = r;
    await act(() => new Promise((r) => setTimeout(r, 30)));
    expect(r.container.textContent).toContain("Family fees cannot be shown right now.");
  });

  it("shows the per-child unavailable sentence when one child's books cannot be read", async () => {
    const r = render(
      stub(
        fees({
          children: [
            fees().data.children[0],
            {
              available: false,
              child: { id: 22, first_name: "Somto", full_name: "Somto O" },
              message: "Somto's fees cannot be shown right now.",
            },
          ],
        }),
      ) as unknown as typeof fetch,
    );
    last = r;
    await act(() => new Promise((r) => setTimeout(r, 30)));
    expect(r.container.textContent).toContain("Somto's fees cannot be shown right now.");
  });

  it("marks an in-credit child's card accordingly", async () => {
    const r = render(
      stub(
        fees({
          children: [
            {
              ...fees().data.children[0],
              balance: -50000,
              owing: 0,
              credit: 50000,
              total_billed: 1000000,
              total_paid: 1050000,
              invoices: [
                {
                  ...fees().data.children[0].invoices[0],
                  paid: 1050000,
                  balance: -50000,
                  status: "PAID",
                  status_label: "Paid",
                },
              ],
            },
            fees().data.children[1],
          ],
        }),
      ) as unknown as typeof fetch,
    );
    last = r;
    await act(() => new Promise((r) => setTimeout(r, 30)));
    expect(r.container.textContent).toContain("₦500.00 in credit");
    expect(r.container.textContent).not.toContain("credit held by the school");
  });

  it("shows what one child owes and another child's credit without netting them", async () => {
    const [tobi, somto] = fees().data.children;
    const r = render(stub(fees({
      children: [
        { ...tobi, balance: 50000, owing: 50000, invoices: [{ ...tobi.invoices[0], balance: 50000 }] },
        { ...somto, balance: -50000, credit: 50000 },
      ],
      combined: { available: true, billed: 1000000, paid: 1000000, outstanding: 50000, credit: 50000 },
      pay_all: { total: 50000, charges_total: 0, steps: [{ child_id: 11, first_name: "Tobi", invoice_ref: 101, number: "IV-1", title: "First Term", amount: 50000 }], complete: true },
    })) as unknown as typeof fetch);
    last = r;
    await act(() => new Promise((resolve) => setTimeout(resolve, 30)));
    expect(r.container.querySelector(".fees-summary-amount")?.textContent).toBe("₦500.00");
    expect(r.container.querySelector(".fees-summary-credit")?.textContent)
      .toBe("₦500.00 credit held by the school. Ask the school to apply it before you pay.");
    expect(r.container.textContent).not.toContain("No bills left to pay");
    expect(r.container.querySelector('a[href="/fees/pay/101"]')).not.toBeNull();
    const rows = [...r.container.querySelectorAll(".fees-simple-children > li")];
    expect(rows[0].textContent).toContain("Tobi");
    expect(rows[0].textContent).toContain("₦500.00");
    expect(rows[1].textContent).toContain("Somto");
    expect(rows[1].textContent).toContain("In credit");
    expect(rows[1].textContent).toContain("₦500.00 in credit");
  });

  it("shows the owed amount and the credit line when a child's credit exceeds their open bill", async () => {
    const [tobi, somto] = fees().data.children;
    const r = render(stub(fees({
      children: [
        { ...tobi, balance: -50000, owing: 150000, credit: 200000, invoices: [{ ...tobi.invoices[0], balance: 150000 }] },
        somto,
      ],
      combined: { available: true, billed: 1000000, paid: 850000, outstanding: 150000, credit: 200000 },
      pay_all: { total: 150000, charges_total: 0, steps: [{ child_id: 11, first_name: "Tobi", invoice_ref: 101, number: "IV-1", title: "First Term", amount: 150000 }], complete: true },
    })) as unknown as typeof fetch);
    last = r;
    await act(() => new Promise((resolve) => setTimeout(resolve, 30)));
    const row = r.container.querySelector(".fees-simple-children > li")?.textContent ?? "";
    expect(row).toContain("₦1,500.00");
    expect(row).toContain("₦2,000.00 credit held by the school. Ask the school to apply it before you pay.");
    expect(row).not.toContain("In credit");
    expect(row).not.toContain("All paid");
    expect(r.container.querySelector(".fees-summary-amount")?.textContent).toBe("₦1,500.00");
    expect(r.container.querySelector('a[href="/fees/pay/101"]')).not.toBeNull();
  });

  it("shows an exactly offsetting credit beside the owed amount, never as all paid", async () => {
    const [tobi, somto] = fees().data.children;
    const r = render(stub(fees({
      children: [{ ...tobi, balance: 0, owing: 500000, credit: 500000 }, somto],
    })) as unknown as typeof fetch);
    last = r;
    await act(() => new Promise((resolve) => setTimeout(resolve, 30)));
    const row = r.container.querySelector(".fees-simple-children > li")?.textContent ?? "";
    expect(row).toContain("₦5,000.00");
    expect(row).toContain("₦5,000.00 credit held by the school");
    expect(row).not.toContain("All paid");
  });

  it("lists a debit note as a charge with no card Pay button and points to the transfer account", async () => {
    const [tobi, somto] = fees().data.children;
    const note = { note_ref: 31, number: "DN-1", date: "2026-10-05", reason: "Excursion", total: 300000, paid: 100000, balance: 200000, status: "PARTIAL", status_label: "Part-paid" };
    const r = render(stub(fees({
      children: [
        {
          ...tobi,
          owing: 700000,
          balance: 700000,
          invoices: [],
          debit_notes: [note],
        },
        somto,
      ],
      combined: { available: true, billed: 1300000, paid: 600000, outstanding: 700000, credit: 0 },
      pay_all: { total: 0, charges_total: 200000, steps: [], complete: true },
    })) as unknown as typeof fetch);
    last = r;
    await act(() => new Promise((resolve) => setTimeout(resolve, 30)));
    expect(r.container.textContent).toContain("1 charge");
    expect(r.container.querySelector(".fees-summary-amount")?.textContent).toBe("₦7,000.00");
    expect(r.container.textContent).toContain("Added charges (₦2,000.00) are not paid by card");
    expect(r.container.textContent).not.toContain("Excursion");
    const toggle = r.container.querySelector<HTMLButtonElement>('[aria-controls="fees-child-bills-11"]');
    expect(toggle?.textContent).toContain("Charges");
    await act(async () => toggle?.click());
    const panel = r.container.querySelector("#fees-child-bills-11")?.textContent ?? "";
    expect(panel).toContain("Excursion");
    expect(panel).toContain("₦2,000.00");
    expect(panel).toContain("Pay this charge by bank transfer into Tobi's account number");
    expect(r.container.querySelector('a[href^="/fees/pay/"]')).toBeNull();
    expect(r.container.querySelector('a[href="/fees/pay-all"]')).toBeNull();
    const transfer = [...r.container.querySelectorAll<HTMLButtonElement>("button")].find((b) => b.textContent === "Pay by transfer");
    expect(transfer).toBeDefined();
    await act(async () => transfer?.click());
    expect(r.container.querySelector("#fees-bank-transfer")?.hasAttribute("hidden")).toBe(false);
  });

  it("says no bills are left when nothing is owing and credit is held", async () => {
    const [tobi, somto] = fees().data.children;
    const r = render(stub(fees({
      children: [{ ...tobi, balance: -50000, owing: 0, credit: 50000, invoices: [{ ...tobi.invoices[0], balance: 0, paid: 1000000, status: "PAID", status_label: "Paid" }] }, somto],
      combined: { available: true, billed: 1000000, paid: 1050000, outstanding: 0, credit: 50000 },
      pay_all: { total: 0, charges_total: 0, steps: [], complete: true },
    })) as unknown as typeof fetch);
    last = r;
    await act(() => new Promise((resolve) => setTimeout(resolve, 30)));
    expect(r.container.querySelector(".fees-summary-amount")?.textContent).toBe("₦0.00");
    expect(r.container.querySelector(".fees-summary-credit")?.textContent).toBe("₦500.00 in credit.");
    expect(r.container.textContent).not.toContain("credit held by the school");
  });

  it("lets a parent choose among multiple bills for one child", async () => {
    const first = fees().data.children[0];
    const r = render(
      stub(fees({
        children: [
          {
            ...first,
            balance: 650000,
            owing: 650000,
            invoices: [
              ...first.invoices,
              { ...first.invoices[0], invoice_ref: 102, number: "IV-2", title: "Transport", balance: 150000 },
            ],
          },
          fees().data.children[1],
        ],
        combined: { available: true, billed: 1650000, paid: 1000000, outstanding: 650000, credit: 0 },
      })) as unknown as typeof fetch,
    );
    last = r;
    await act(() => new Promise((resolve) => setTimeout(resolve, 30)));
    expect(r.container.textContent).toContain("Choose bill");
    expect(r.container.querySelector('a[href="/fees/pay/101"]')).toBeNull();
    const choose = r.container.querySelector<HTMLButtonElement>('[aria-controls="fees-child-bills-11"]');
    await act(async () => choose?.click());
    expect(r.container.querySelector('a[href="/fees/pay/101"]')).not.toBeNull();
    expect(r.container.querySelector('a[href="/fees/pay/102"]')).not.toBeNull();
  });

  it("puts no-bill children below paid children", async () => {
    const tobi = fees().data.children[0];
    const somto = fees().data.children[1];
    const withDue = (id: number, name: string, dueDate: string) => ({
      ...tobi,
      child: { id, first_name: name, full_name: `${name} O` },
      invoices: [{ ...tobi.invoices[0], invoice_ref: id, due_date: dueDate }],
    });
    const paid = { ...somto, child: { id: 55, first_name: "Chika", full_name: "Chika O" }, invoices: [{ ...tobi.invoices[0], invoice_ref: 55, paid: 1000000, balance: 0, status: "PAID", status_label: "Paid" }] };
    const credit = { ...tobi, child: { id: 66, first_name: "Zara", full_name: "Zara O" }, balance: -50000, owing: 0, credit: 50000, invoices: [{ ...tobi.invoices[0], invoice_ref: 66, paid: 1050000, balance: 0 }] };
    const unavailable = { available: false, child: { id: 77, first_name: "Nneka", full_name: "Nneka O" }, message: "Fees unavailable" };
    const r = render(stub(fees({ children: [paid, unavailable, somto, credit, tobi, withDue(33, "Kemi", "2026-12-01"), withDue(44, "Ada", "2026-10-25")] })) as unknown as typeof fetch);
    last = r;
    await act(() => new Promise((resolve) => setTimeout(resolve, 30)));
    const names = [...r.container.querySelectorAll(".fees-simple-children > li .fees-child-identity strong")]
      .map((node) => node.textContent);
    expect(names).toEqual(["Ada", "Tobi", "Kemi", "Zara", "Nneka", "Chika", "Somto"]);
  });
});
