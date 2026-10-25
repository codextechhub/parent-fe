import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fees = vi.hoisted(() => ({
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
}));

import { clearPayAllQueue, readPayAllQueue } from "./pay-all-queue";
import { PayAllPage } from "./pay-all";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  clearPayAllQueue();
  query.isFetching = false;
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
    act(() => root.render(<MemoryRouter initialEntries={["/fees/pay-all"]}><PayAllPage /></MemoryRouter>));
    expect(container.querySelector('[aria-label="Loading pay-all"]')).not.toBeNull();
    expect(readPayAllQueue()).toBeNull();

    query.isFetching = false;
    act(() => root.render(<MemoryRouter initialEntries={["/fees/pay-all"]}><PayAllPage /></MemoryRouter>));
    expect(container.querySelector(".pay-all-summary > strong")?.textContent).toBe("₦8,000.00");
    expect(readPayAllQueue()?.steps).toHaveLength(2);
  });

  it("separates the family total from this bill's amount and lets the parent stop", () => {
    act(() => root.render(<MemoryRouter initialEntries={["/fees/pay-all"]}><Routes>
      <Route path="/fees/pay-all" element={<PayAllPage />} />
      <Route path="/fees" element={<p>Fees screen</p>} />
    </Routes></MemoryRouter>));

    expect(container.querySelector(".pay-all-summary > strong")?.textContent).toBe("₦8,000.00");
    expect(container.querySelector(".pay-all-step-amount strong")?.textContent).toBe("₦5,000.00");
    expect(container.querySelector(".pay-all-upcoming")?.textContent).toContain("Musa");
    expect(readPayAllQueue()?.steps).toHaveLength(2);

    act(() => (container.querySelector(".pay-all-cancel") as HTMLButtonElement).click());
    expect(container.textContent).toContain("Fees screen");
    expect(readPayAllQueue()).toBeNull();
  });
});
