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
        },
        {
          available: true,
          child: { id: 22, first_name: "Somto", full_name: "Somto O" },
          balance: 0,
          total_billed: 500000,
          total_paid: 500000,
          invoices: [],
        },
      ],
      combined: { available: true, billed: 1500000, paid: 1000000, outstanding: 500000 },
      min_part_payment: 100000,
      pay_all: {
        total: 500000,
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
    expect(r.container.textContent).toContain("in credit");
  });

  it("lets a parent choose among multiple bills for one child", async () => {
    const first = fees().data.children[0];
    const r = render(
      stub(fees({
        children: [
          {
            ...first,
            balance: 650000,
            invoices: [
              ...first.invoices,
              { ...first.invoices[0], invoice_ref: 102, number: "IV-2", title: "Transport", balance: 150000 },
            ],
          },
          fees().data.children[1],
        ],
        combined: { available: true, billed: 1650000, paid: 1000000, outstanding: 650000 },
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

  it("puts balances due by due date, then credit and other non-paid states, then paid children", async () => {
    const tobi = fees().data.children[0];
    const somto = fees().data.children[1];
    const withDue = (id: number, name: string, dueDate: string) => ({
      ...tobi,
      child: { id, first_name: name, full_name: `${name} O` },
      invoices: [{ ...tobi.invoices[0], invoice_ref: id, due_date: dueDate }],
    });
    const paid = { ...somto, child: { id: 55, first_name: "Chika", full_name: "Chika O" }, invoices: [{ ...tobi.invoices[0], invoice_ref: 55, paid: 1000000, balance: 0, status: "PAID", status_label: "Paid" }] };
    const credit = { ...tobi, child: { id: 66, first_name: "Zara", full_name: "Zara O" }, balance: -50000, invoices: [{ ...tobi.invoices[0], invoice_ref: 66, paid: 1050000, balance: -50000 }] };
    const unavailable = { available: false, child: { id: 77, first_name: "Nneka", full_name: "Nneka O" }, message: "Fees unavailable" };
    const r = render(stub(fees({ children: [paid, unavailable, somto, credit, tobi, withDue(33, "Kemi", "2026-12-01"), withDue(44, "Ada", "2026-10-25")] })) as unknown as typeof fetch);
    last = r;
    await act(() => new Promise((resolve) => setTimeout(resolve, 30)));
    const names = [...r.container.querySelectorAll(".fees-simple-children > li .fees-child-identity strong")]
      .map((node) => node.textContent);
    expect(names).toEqual(["Ada", "Tobi", "Kemi", "Zara", "Somto", "Nneka", "Chika"]);
  });
});
