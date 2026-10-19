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

import { PaidPage } from "./paid";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const ME: MeData = {
  parent: { first_name: "P", full_name: "P", initials: "P" },
  school: { name: "S", logo_url: "" },
  show_branch: false,
  session: null,
  term: null,
  children: [],
};

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

function render(path: string, fetchImpl: typeof fetch) {
  globalThis.fetch = fetchImpl;
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() =>
    root.render(
      <Provider store={makeStore()}>
        <MemoryRouter initialEntries={[path]}>
          <PaidPage />
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
  window.sessionStorage.clear();
});
afterEach(() => {
  if (last) {
    act(() => last!.root.unmount());
    last.container.remove();
    last = null;
  }
});

function statusResponse(status: "CONFIRMED" | "PENDING" | "FAILED" | "ABANDONED") {
  return {
    success: true,
    message: "",
    data: {
      status,
      amount: 500000,
      amount_naira: "₦5,000.00",
      payee_name: "Lagoon View Academy",
      paid_at: status === "CONFIRMED" ? "2026-10-19T00:00:00Z" : null,
    },
  };
}

describe("PaidPage", () => {
  it("says received on CONFIRMED", async () => {
    const stub = vi.fn(async (input: Parameters<typeof fetch>[0]) => {
      const url = input instanceof Request ? input.url : String(input);
      if (url.includes("/payments/public/collections/")) {
        return new Response(JSON.stringify(statusResponse("CONFIRMED")), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      if (url.includes("/portal/parent/fees/payments/")) {
        return new Response(
          JSON.stringify({
            success: true,
            message: "",
            data: [{
              payment_ref: 500,
              reference: "CXP-REF-1",
              amount: 500000,
              status: "CONFIRMED",
              status_label: "Confirmed",
              method: "CARD",
              method_label: "Card",
              paid_on: "2026-10-19",
              payer_name: "",
              receipt_number: "RC-1",
              invoice_number: "IV-1",
              has_receipt: true,
              child: { id: 11, first_name: "Tobi" },
            }],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      if (url.includes("/portal/parent/fees/")) {
        return new Response(
          JSON.stringify({
            success: true,
            message: "",
            data: {
              children: [],
              combined: { available: true, billed: 500000, paid: 500000, outstanding: 0 },
              min_part_payment: 100000,
              pay_all: { total: 0, steps: [], complete: true },
            },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      return new Response("{}", { status: 200 });
    });
    const r = render("/fees/paid?reference=CXP-REF-1", stub as unknown as typeof fetch);
    last = r;
    await act(() => new Promise((r) => setTimeout(r, 60)));
    expect(r.container.textContent).toContain("Payment received");
    expect(r.container.textContent).toContain("Lagoon View Academy");
    expect(r.container.textContent).toContain("View receipt");
  });

  it("says still confirming on PENDING", async () => {
    const stub = vi.fn(async () =>
      new Response(JSON.stringify(statusResponse("PENDING")), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    const r = render("/fees/paid?reference=CXP-REF-2", stub as unknown as typeof fetch);
    last = r;
    await act(() => new Promise((r) => setTimeout(r, 60)));
    expect(r.container.textContent).toContain("Almost there");
    expect(r.container.textContent).toContain("Waiting for confirmation");
    expect(r.container.textContent).not.toContain("View receipt");
  });

  it("says didn't go through on FAILED", async () => {
    const stub = vi.fn(async () =>
      new Response(JSON.stringify(statusResponse("FAILED")), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    const r = render("/fees/paid?reference=CXP-REF-3", stub as unknown as typeof fetch);
    last = r;
    await act(() => new Promise((r) => setTimeout(r, 60)));
    expect(r.container.textContent).toContain("Payment did not go through");
    expect(r.container.textContent).toContain("You have not been charged");
  });

  it("says cancelled on ABANDONED", async () => {
    const stub = vi.fn(async () =>
      new Response(JSON.stringify(statusResponse("ABANDONED")), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    const r = render("/fees/paid?reference=CXP-REF-4", stub as unknown as typeof fetch);
    last = r;
    await act(() => new Promise((r) => setTimeout(r, 60)));
    expect(r.container.textContent).toContain("Payment was cancelled");
  });

  it("offers Continue pay all on CONFIRMED when a queue is waiting", async () => {
    window.sessionStorage.setItem(
      "parent-fe:pay-all",
      JSON.stringify({
        steps: [
          { child_id: 11, first_name: "Tobi", invoice_ref: 101, number: "IV-1", title: "First Term", amount: 500000 },
          { child_id: 22, first_name: "Somto", invoice_ref: 102, number: "IV-2", title: "First Term", amount: 300000 },
        ],
        index: 0,
      }),
    );
    const stub = vi.fn(async (input: Parameters<typeof fetch>[0]) => {
      const url = input instanceof Request ? input.url : String(input);
      if (url.includes("/payments/public/collections/")) {
        return new Response(JSON.stringify(statusResponse("CONFIRMED")), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ success: true, message: "", data: [] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });
    const r = render("/fees/paid?reference=CXP-REF-5", stub as unknown as typeof fetch);
    last = r;
    await act(() => new Promise((r) => setTimeout(r, 60)));
    expect(r.container.textContent).toContain("Continue pay all");
    expect(r.container.textContent).toContain("Step 1 of 2");
  });
});
