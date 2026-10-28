import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fees = vi.hoisted(() => ({
  children: [] as unknown[],
  pay_all: {
    total: 800000,
    steps: [
      { child_id: 11, first_name: "Tobi", invoice_ref: 101, number: "IV-1", title: "First Term", amount: 500000 },
      { child_id: 22, first_name: "Musa", invoice_ref: 202, number: "IV-2", title: "Second Term", amount: 300000 },
    ],
    complete: true,
  },
}));
const query = vi.hoisted(() => ({ isFetching: false }));

vi.mock("@/redux/services/portal-api", () => ({
  cardPaymentsOn: (data?: { card_payments?: boolean }) => data?.card_payments !== false,
  useFamilyFeesQuery: () => ({ data: fees, isLoading: false, isFetching: query.isFetching }),
  // The avatars ask for a photo only when the child has one; none here do.
  useAuthImageQuery: () => ({ data: undefined, isLoading: false, isError: false }),
}));

import { clearPayAllQueue, readPayAllQueue } from "./pay-all-queue";
import { PayAllPage } from "./pay-all";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// Only what the avatars read: the signed-in parent's children.
const store = configureStore({ reducer: { auth: () => ({ me: null }) } });
const withStore = (node: ReactNode) => <Provider store={store}>{node}</Provider>;

let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  clearPayAllQueue();
  query.isFetching = false;
  fees.children = [];
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  clearPayAllQueue();
});

describe("PayAllPage", () => {
  it("waits for current fees before starting a fresh queue", () => {
    query.isFetching = true;
    act(() => root.render(withStore(<MemoryRouter initialEntries={["/fees/pay-all"]}><PayAllPage /></MemoryRouter>)));
    expect(container.querySelector('[aria-label="Loading pay-all"]')).not.toBeNull();
    expect(readPayAllQueue()).toBeNull();

    query.isFetching = false;
    act(() => root.render(withStore(<MemoryRouter initialEntries={["/fees/pay-all"]}><PayAllPage /></MemoryRouter>)));
    expect(container.querySelector(".pay-all-summary > strong")?.textContent).toBe("₦8,000.00");
    expect(readPayAllQueue()?.steps).toHaveLength(2);
  });

  it("separates the family total from this bill's amount and lets the parent stop", () => {
    act(() => root.render(withStore(<MemoryRouter initialEntries={["/fees/pay-all"]}><Routes>
      <Route path="/fees/pay-all" element={<PayAllPage />} />
      <Route path="/fees" element={<p>Fees screen</p>} />
    </Routes></MemoryRouter>)));
    expect(container.querySelector(".pay-step-pill")?.textContent).toBe("Step 1 of 2");

    expect(container.querySelector(".pay-all-summary > strong")?.textContent).toBe("₦8,000.00");
    expect(container.querySelector(".pay-all-step-amount strong")?.textContent).toBe("₦5,000.00");
    expect(container.querySelector(".pay-all-upcoming")?.textContent).toContain("Musa");
    expect(readPayAllQueue()?.steps).toHaveLength(2);

    act(() => (container.querySelector(".pay-all-cancel") as HTMLButtonElement).click());
    expect(container.textContent).toContain("Fees screen");
    expect(readPayAllQueue()).toBeNull();
  });

  it("says why an added charge is not in the list", () => {
    fees.children = [
      { available: true, child: { id: 11, first_name: "Tobi", full_name: "Tobi O" }, debit_notes: [{ note_ref: 1, balance: 650000 }] },
      { available: true, child: { id: 22, first_name: "Musa", full_name: "Musa O" }, debit_notes: [{ note_ref: 2, balance: 0 }] },
    ];
    act(() => root.render(withStore(<MemoryRouter initialEntries={["/fees/pay-all"]}><PayAllPage /></MemoryRouter>)));
    expect(container.querySelector(".pay-all-charges")?.textContent)
      .toBe("Tobi's added charge of ₦6,500.00 is paid by bank transfer, so it isn't in this list.");
  });
});
