import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { Provider } from "react-redux";
import { MemoryRouter, Route, Routes } from "react-router";
import { configureStore } from "@reduxjs/toolkit";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { setAccessToken } from "@/auth/access-token";
import { _resetCsrfCache } from "@/auth/csrf";
import { _resetRefreshForTests } from "@/auth/refresh";
import { authReducer, meLoaded, type MeData } from "@/redux/features/auth-slice";
import { connectivityReducer } from "@/redux/features/connectivity-slice";
import { baseApi } from "@/redux/services/base-api";
import "@/redux/services/portal-api";

import { PayPage } from "./pay";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const ME: MeData = {
  parent: { first_name: "P", full_name: "P", initials: "P" },
  school: { name: "S", logo_url: "" },
  show_branch: false,
  session: null,
  term: null,
  children: [
    { id: 11, first_name: "Tobi", full_name: "Tobi O", initials: "TO", photo_url: "", admission_number: "", class_name: "JSS1 A", relationship: "Mother" },
  ],
};

const FEES = {
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
    ],
    combined: { available: true, billed: 1000000, paid: 500000, outstanding: 500000 },
    min_part_payment: 100000,
    pay_all: { total: 500000, steps: [], complete: true },
  },
};

const INVOICE_SHEET = {
  success: true,
  message: "",
  data: { ...FEES.data.children[0].invoices[0], child: { id: 11, first_name: "Tobi" } },
};

function stubWithPayResponse(payResult: (body: unknown) => { status: number; body: unknown }) {
  return vi.fn(async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
    const url = input instanceof Request ? input.url : String(input);
    const method = (input instanceof Request ? input.method : init?.method) ?? "GET";
    if (url.includes("/invoices/101/pay/") && method === "POST") {
      const body = init?.body ? JSON.parse(String(init.body)) : {};
      const { status, body: resBody } = payResult(body);
      return new Response(JSON.stringify(resBody), {
        status,
        headers: { "content-type": "application/json" },
      });
    }
    if (url.includes("/invoices/101/")) {
      return new Response(JSON.stringify(INVOICE_SHEET), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    if (url.includes("/portal/parent/fees/")) {
      return new Response(JSON.stringify(FEES), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    return new Response("{}", { status: 200 });
  });
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

function render(fetchImpl: typeof fetch) {
  globalThis.fetch = fetchImpl;
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() =>
    root.render(
      <Provider store={makeStore()}>
        <MemoryRouter initialEntries={["/fees/pay/101"]}>
          <Routes>
            <Route path="/fees/pay/:invoiceRef" element={<PayPage />} />
          </Routes>
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

describe("PayPage", () => {
  it("renders the bill with the child's name and the Pay in full option", async () => {
    const r = render(
      stubWithPayResponse(() => ({ status: 200, body: {} })) as unknown as typeof fetch,
    );
    last = r;
    await act(() => new Promise((r) => setTimeout(r, 30)));
    expect(r.container.textContent).toContain("Selected bill · Tobi");
    expect(r.container.textContent).toContain("First Term");
    expect(r.container.textContent).toContain("₦5,000.00");
    expect(r.container.textContent).toContain("Pay in full");
  });

  it("refuses a part payment below the minimum before any charge", async () => {
    const stub = stubWithPayResponse(() => ({ status: 200, body: {} }));
    const r = render(stub as unknown as typeof fetch);
    last = r;
    await act(() => new Promise((r) => setTimeout(r, 30)));
    const partButton = Array.from(r.container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Part payment"),
    ) as HTMLButtonElement | undefined;
    await act(async () => {
      partButton!.click();
    });
    const input = r.container.querySelector<HTMLInputElement>(".pay-amount-field input")!;
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")!.set!;
    await act(async () => {
      setter.call(input, "500");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    const go = Array.from(r.container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Continue to secure"),
    ) as HTMLButtonElement | undefined;
    await act(async () => {
      go!.click();
      await new Promise((r) => setTimeout(r, 30));
    });
    expect(r.container.textContent).toContain("The smallest part payment this school accepts is ₦1,000.00");
    // No POST should have been made.
    const posted = (stub.mock.calls as Array<Parameters<typeof fetch>>).some(([input, init]) => {
      const url = input instanceof Request ? input.url : String(input);
      const method = (input instanceof Request ? input.method : init?.method) ?? "GET";
      return url.includes("/invoices/101/pay/") && method === "POST";
    });
    expect(posted).toBe(false);
  });

  it("passes a valid full payment to the gateway (sends POST + would redirect)", async () => {
    const stub = stubWithPayResponse(() => ({
      status: 200,
      body: {
        success: true,
        message: "Continue",
        data: {
          checkout_url: "https://checkout.paystack.com/test-abc",
          reference: "CXP-TEST-1",
          amount: 500000,
          balance_after: 0,
          child: { id: 11, first_name: "Tobi" },
        },
      },
    }));
    // Stub the assign so we can see where the page would send the parent.
    const assigns: string[] = [];
    Object.defineProperty(window, "location", {
      value: { ...window.location, assign: (href: string) => assigns.push(href), href: window.location.href },
      writable: true,
    });
    const r = render(stub as unknown as typeof fetch);
    last = r;
    await act(() => new Promise((r) => setTimeout(r, 30)));
    const go = Array.from(r.container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Continue to secure"),
    ) as HTMLButtonElement | undefined;
    await act(async () => {
      go!.click();
      await new Promise((r) => setTimeout(r, 50));
    });
    expect(assigns[0]).toBe("https://checkout.paystack.com/test-abc");
  });

  it("shows the server's refusal sentence under the amount on 409 INVOICE_NOT_PAYABLE", async () => {
    const stub = stubWithPayResponse(() => ({
      status: 409,
      body: {
        success: false,
        message: "This invoice can no longer be paid online.",
        error: { code: "INVOICE_NOT_PAYABLE" },
      },
    }));
    const r = render(stub as unknown as typeof fetch);
    last = r;
    await act(() => new Promise((r) => setTimeout(r, 30)));
    const go = Array.from(r.container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Continue to secure"),
    ) as HTMLButtonElement | undefined;
    await act(async () => {
      go!.click();
      await new Promise((r) => setTimeout(r, 30));
    });
    expect(r.container.textContent).toContain("This invoice can no longer be paid online.");
  });
});
