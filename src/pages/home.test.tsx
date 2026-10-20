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

import { HomePage } from "./home";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const ME: MeData = {
  parent: { first_name: "Patricia", full_name: "Mrs. Patricia Okafor", initials: "PO" },
  school: { name: "Lagoon View", logo_url: "" },
  show_branch: true,
  session: { id: 1, name: "2026/2027" },
  term: { id: 1, name: "First Term" },
  children: [
    {
      id: 11,
      first_name: "Tobi",
      full_name: "Tobi Okafor",
      initials: "TO",
      photo_url: "",
      admission_number: "A1",
      class_name: "JSS1 A",
      relationship: "Mother",
      branch: { id: 1, name: "Lekki" },
    },
    {
      id: 12,
      first_name: "Somto",
      full_name: "Somto Okafor",
      initials: "SO",
      photo_url: "",
      admission_number: "A2",
      class_name: "Primary 4",
      relationship: "Mother",
      branch: { id: 2, name: "Ikoyi" },
    },
  ],
};

function homePayload(overrides: Record<string, unknown> = {}) {
  return {
    data: {
      date: "2026-10-19",
      children: [
        {
          id: 11,
          first_name: "Tobi",
          class_name: "JSS1 A",
          attendance: { available: true, rate: 92 },
          fees: { available: true, balance: 500000, status: "OWING", open_invoice_count: 1 },
          results: {
            available: true,
            released: true,
            term: { id: 1, name: "First Term", session: "2026/2027" },
            overall_average: "72.00",
          },
          today: { available: true, published: false, date: null, next_lesson: null },
        },
        {
          id: 12,
          first_name: "Somto",
          class_name: "Primary 4",
          attendance: { available: false, message: "Somto's attendance cannot be shown right now." },
          fees: { available: true, balance: 0, status: "CLEAR", open_invoice_count: 0 },
          results: { available: true, released: false },
          today: { available: true, published: false, date: null, next_lesson: null },
        },
      ],
      fees: { available: true, outstanding: 500000, pay_all_total: 500000 },
      notices: {
        available: true,
        latest: {
          id: 14,
          title: "PTA meeting",
          body: "This Saturday at 10am.",
          audience_label: "School-wide",
          published_at: "2026-10-19T08:03:53Z",
          edited_at: null,
          unread: true,
          children: ["Tobi", "Somto"],
        },
        unread_count: 2,
      },
      notifications: { available: true, unread_count: 1 },
      ...overrides,
    },
  };
}

function render(fetchImpl: typeof fetch, me: MeData = ME) {
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
  store.dispatch(meLoaded(me));
  act(() =>
    root.render(
      <Provider store={store}>
        <MemoryRouter initialEntries={["/"]}>
          <HomePage />
        </MemoryRouter>
      </Provider>,
    ),
  );
  return { container, root, store };
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

describe("HomePage", () => {
  it("shows the outstanding banner when the family owes money", async () => {
    const payload = homePayload();
    const fetchStub = vi.fn(async () =>
      new Response(JSON.stringify(payload), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    const r = render(fetchStub as unknown as typeof fetch);
    last = r;
    await act(() => new Promise((r) => setTimeout(r, 20)));
    expect(r.container.textContent).toContain("still due on bills");
    expect(r.container.textContent).toContain("Welcome, Patricia");
    expect(r.container.textContent).toContain("2 children across 2 branches");
    expect(r.container.textContent).toContain("Tobi");
    expect(r.container.textContent).toContain("Somto");
    // The unavailable attendance block shows its sentence instead of a zero.
    expect(r.container.textContent).toContain("Somto's attendance cannot be shown right now.");
    // "All paid" copy must NOT show when there is still outstanding money.
    expect(r.container.textContent).not.toContain("All fees are paid");
  });

  it("names the one branch a family's children share, rather than counting branches", async () => {
    const payload = homePayload();
    const fetchStub = vi.fn(async () =>
      new Response(JSON.stringify(payload), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    const oneChild = { ...ME, children: [ME.children[0]] };
    const r = render(fetchStub as unknown as typeof fetch, oneChild);
    last = r;
    await act(() => new Promise((r) => setTimeout(r, 20)));
    expect(r.container.textContent).toContain("1 child at Lekki");
    expect(r.container.textContent).not.toContain("1 branches");
  });

  it("says all fees are paid when outstanding is zero", async () => {
    const payload = homePayload({
      fees: { available: true, outstanding: 0, pay_all_total: 0 },
      children: homePayload().data.children.map((child) => ({
        ...child,
        fees: { available: true, balance: 0, status: "CLEAR", open_invoice_count: 0 },
      })),
    });
    const fetchStub = vi.fn(async () =>
      new Response(JSON.stringify(payload), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    const r = render(fetchStub as unknown as typeof fetch);
    last = r;
    await act(() => new Promise((r) => setTimeout(r, 20)));
    expect(r.container.textContent).toContain("All fees are paid");
  });

  it("shows a child's bill when another child's credit makes the family net zero", async () => {
    const children = homePayload().data.children;
    const payload = homePayload({
      fees: { available: true, outstanding: 0, pay_all_total: 0 },
      children: [
        { ...children[0], fees: { available: true, balance: 50000, status: "OWING", open_invoice_count: 1 } },
        { ...children[1], fees: { available: true, balance: -50000, status: "IN_CREDIT", open_invoice_count: 0 } },
      ],
    });
    const fetchStub = vi.fn(async () => new Response(JSON.stringify(payload), {
      status: 200,
      headers: { "content-type": "application/json" },
    }));
    const r = render(fetchStub as unknown as typeof fetch);
    last = r;
    await act(() => new Promise((resolve) => setTimeout(resolve, 20)));
    expect(r.container.querySelector(".home-banner")?.textContent).toContain("₦500.00 still due on bills");
    expect(r.container.querySelector(".home-banner")?.textContent).toContain("₦500.00 in credit");
    expect(r.container.querySelector(".home-banner")?.textContent).not.toContain("All fees are paid");
  });

  it("shows the fees-unavailable sentence from the family block instead of a figure", async () => {
    const payload = homePayload({
      fees: { available: false, message: "The family's fees cannot be shown right now." },
      // Also mark each child's fees unavailable to prove no block invents a zero.
      children: homePayload().data.children.map((child, i) => ({
        ...child,
        fees: {
          available: false,
          message: `${child.first_name}'s fees cannot be shown right now.`,
        },
        attendance:
          i === 1 ? child.attendance : { available: true as const, rate: 92 as number },
      })),
    });
    const fetchStub = vi.fn(async () =>
      new Response(JSON.stringify(payload), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    const r = render(fetchStub as unknown as typeof fetch);
    last = r;
    await act(() => new Promise((r) => setTimeout(r, 20)));
    expect(r.container.textContent).toContain("The family's fees cannot be shown right now.");
    expect(r.container.textContent).toContain("Tobi's fees cannot be shown right now.");
    // No figure anywhere, since every fee block is unavailable.
    expect(r.container.textContent).not.toContain("₦");
  });
});
