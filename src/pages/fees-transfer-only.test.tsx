/**
 * The Fees screen where the school's families pay by bank transfer alone.
 *
 * Patricia Okafor has Tobi (owes N5,000), Somto (owes N3,000) and Grace (owes
 * nothing). Each has an account number of their own on the screen; no card
 * button, no Pay all. A transfer into Tobi's account shows as on its way, then
 * received with its receipt, and his balance catches up without a reload.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { Provider } from "react-redux";
import { MemoryRouter } from "react-router";
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

import { FeesPage } from "./fees";
import { clearPayAllQueue } from "./pay-all-queue";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const ME = {
  parent: { first_name: "Patricia", full_name: "Patricia", initials: "P" },
  school: { name: "Lagoon View", logo_url: "" },
  show_branch: false,
  session: null,
  term: null,
  children: [],
} as unknown as MeData;

const AS_OF = "2026-10-25T09:00:00Z";

function child(id: number, first: string, owing: number) {
  return {
    available: true,
    child: { id, first_name: first, full_name: `${first} Okafor` },
    balance: owing,
    owing,
    credit: 0,
    total_billed: 1_000_000,
    total_paid: 1_000_000 - owing,
    invoices:
      owing > 0
        ? [{
            invoice_ref: 100 + id, number: `IV-${id}`, title: "First Term", invoice_date: "2026-10-01",
            due_date: "2026-11-15", lines: [{ description: "Tuition", amount: 1_000_000 }],
            total: 1_000_000, paid: 1_000_000 - owing, balance: owing, status: "PARTIAL", status_label: "Part-paid",
          }]
        : [],
    debit_notes: [],
  };
}

function feesBody(cardPayments: boolean | undefined, owing = { tobi: 500_000, somto: 300_000 }) {
  const total = owing.tobi + owing.somto;
  return {
    children: [child(11, "Tobi", owing.tobi), child(22, "Somto", owing.somto), child(33, "Grace", 0)],
    combined: { available: true, billed: 3_000_000, paid: 3_000_000 - total, outstanding: total, credit: 0 },
    ...(cardPayments === undefined ? {} : { card_payments: cardPayments }),
    min_part_payment: 100_000,
    pay_all: {
      total,
      charges_total: 0,
      steps: [
        { child_id: 11, first_name: "Tobi", invoice_ref: 111, number: "IV-11", title: "First Term", amount: owing.tobi },
        { child_id: 22, first_name: "Somto", invoice_ref: 122, number: "IV-22", title: "First Term", amount: owing.somto },
      ],
      complete: true,
    },
  };
}

type Issued = { state: "ISSUED"; bank_name: string; account_number: string; account_name: string; as_of: string };
const issued = (number: string): Issued => ({
  state: "ISSUED", bank_name: "Wema Bank", account_number: number, account_name: "Lagoon View / Okafor", as_of: AS_OF,
});

type World = {
  fees: ReturnType<typeof feesBody>;
  accounts: Record<number, unknown>;
  deposits: Record<number, unknown[]>;
  calls: string[];
};

function newWorld(cardPayments: boolean | undefined): World {
  return {
    fees: feesBody(cardPayments),
    accounts: { 11: issued("0123456011"), 22: issued("0123456022"), 33: { state: "NONE", as_of: AS_OF } },
    deposits: { 11: [], 22: [], 33: [] },
    calls: [],
  };
}

function reply(data: unknown, status = 200) {
  return new Response(JSON.stringify({ success: status < 400, message: "", data }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function stub(world: World) {
  return vi.fn(async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
    const url = input instanceof Request ? input.url : String(input);
    const method = (input instanceof Request ? input.method : init?.method) ?? "GET";
    world.calls.push(`${method} ${url.replace(/^https?:\/\/[^/]+\/v1/, "").replace(/[?&]tenant=[^&]*/, "")}`);
    const match = url.match(/children\/(\d+)\/fees\/transfer-account\/(deposits\/)?/);
    if (match) {
      const id = Number(match[1]);
      if (match[2]) return reply({ as_of: AS_OF, deposits: world.deposits[id] ?? [] });
      if (method === "POST") {
        world.accounts[id] = issued(`09999990${id}`);
        return reply(world.accounts[id]);
      }
      return reply(world.accounts[id]);
    }
    if (url.includes("/portal/parent/fees/payments/")) return reply([]);
    if (/\/portal\/parent\/fees\/(\?.*)?$/.test(url)) return reply(world.fees);
    return new Response("{}", { status: 200 });
  });
}

function render(world: World) {
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
        <MemoryRouter initialEntries={["/fees"]}>
          <FeesPage />
        </MemoryRouter>
      </Provider>,
    ),
  );
  return { container, root };
}

const settle = () => act(() => new Promise((resolve) => setTimeout(resolve, 40)));
const disclosure = (container: HTMLElement, word: "Show" | "Hide") =>
  [...container.querySelectorAll("button")].find((b) => b.textContent?.includes(`${word} account number`));
/** Opens the "Show account numbers" disclosure below Payment history. */
async function openAccounts(container: HTMLElement) {
  await act(async () => disclosure(container, "Show")?.click());
  await settle();
}
const tick = (ms: number) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });
const depositCalls = (world: World) => world.calls.filter((call) => call.includes("/deposits/"));

function setVisibility(state: "visible" | "hidden") {
  Object.defineProperty(document, "visibilityState", { configurable: true, value: state });
  document.dispatchEvent(new Event("visibilitychange"));
}

let last: { container: HTMLDivElement; root: Root } | null = null;
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "Date"] });
  vi.setSystemTime(new Date(AS_OF));
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
  setVisibility("visible");
  vi.useRealTimers();
});

describe("Fees where families pay by transfer alone", () => {
  it("puts no account box above the bills, and opens the account cards from a disclosure below Payment history", async () => {
    const world = newWorld(false);
    last = render(world);
    await settle();
    // Collapsed: no account number anywhere, and nothing asked of the school for one.
    expect(last.container.textContent).not.toContain("0123456011");
    expect(last.container.querySelector("#fees-transfer-heading")).toBeNull();
    expect(world.calls.some((call) => call.includes("transfer-account"))).toBe(false);
    const html = last.container.innerHTML;
    expect(html.indexOf('id="fees-children-heading"')).toBeLessThan(html.indexOf('aria-controls="fees-payment-history"'));
    expect(html.indexOf('aria-controls="fees-payment-history"')).toBeLessThan(html.indexOf('aria-controls="fees-bank-transfer"'));
    const toggle = disclosure(last.container, "Show");
    expect(toggle?.getAttribute("aria-expanded")).toBe("false");

    await openAccounts(last.container);
    const text = last.container.textContent ?? "";
    expect(text).toContain("0123456011");
    expect(text).toContain("0123456022");
    expect(text).toContain("For Tobi Okafor");
    expect(text).toContain("Owing ₦5,000.00");
    expect(text).toContain("Owing ₦3,000.00");
    expect(text).toContain("Wema Bank");
    expect(text).toContain("Bank account name: Lagoon View / Okafor");
    expect(text).toContain("Pay any amount by transfer from your bank app. It shows here as soon as it arrives.");
    expect(text).not.toContain("Pay all balances");
    expect(last.container.querySelector('a[href="/fees/pay-all"]')).toBeNull();
    expect(text).not.toContain("by card");
  });

  it("lets a parent go from a bill that is owed to the Pay step, with no card or method choice on Fees", async () => {
    last = render(newWorld(false));
    await settle();
    expect(last.container.querySelector('a[href="/fees/pay/111"]')?.textContent).toContain("Pay Tobi");
    expect(last.container.querySelector('a[href="/fees/pay/122"]')?.textContent).toContain("Pay Somto");
    // Grace owes nothing, so there is nothing to pay for her.
    expect(last.container.querySelector('a[href^="/fees/pay/13"]')).toBeNull();
    expect(last.container.textContent).not.toContain("Pay all balances");
    const bills = [...last.container.querySelectorAll("button")].find((b) => b.textContent?.includes("Bills"));
    await act(async () => bills?.click());
    expect(last.container.querySelectorAll('.fees-simple-bills a[href^="/fees/pay/"]').length).toBeGreaterThan(0);
    expect(last.container.textContent).not.toContain("How would you like to pay?");
  });

  it("closes the account cards again with Hide", async () => {
    last = render(newWorld(false));
    await settle();
    await openAccounts(last.container);
    const hide = disclosure(last.container, "Hide");
    expect(hide?.getAttribute("aria-expanded")).toBe("true");
    expect(last.container.textContent).toContain("0123456011");
    expect(last.container.querySelector("#fees-bank-transfer")?.hasAttribute("hidden")).toBe(false);

    await act(async () => hide?.click());
    await settle();
    expect(last.container.textContent).not.toContain("0123456011");
    expect(last.container.querySelector("#fees-bank-transfer")?.hasAttribute("hidden")).toBe(true);
    expect(disclosure(last.container, "Show")?.getAttribute("aria-expanded")).toBe("false");

    await openAccounts(last.container);
    expect(last.container.textContent).toContain("0123456011");
  });

  it("lists every child's account in the disclosure, and offers Grace a number to get", async () => {
    const world = newWorld(false);
    last = render(world);
    await settle();
    expect(last.container.textContent).not.toContain("Get Grace");
    expect(world.calls.some((call) => call.includes("children/33/"))).toBe(false);

    await openAccounts(last.container);
    const get = [...last.container.querySelectorAll("button")].find((b) => b.textContent?.includes("Get Grace's account number"));
    expect(get).toBeDefined();
    await act(async () => get?.click());
    await settle();
    expect(world.calls).toContain("POST /portal/parent/children/33/fees/transfer-account/");
    expect(last.container.textContent).toContain("0999999033");
  });

  it("says the school's sentence for a child whose account is being set up", async () => {
    const world = newWorld(false);
    world.accounts[22] = {
      state: "UNAVAILABLE",
      message: "Your payment account is being set up. Try again later, or contact the school office.",
    };
    last = render(world);
    await settle();
    await openAccounts(last.container);
    expect(last.container.textContent).toContain(
      "Your payment account is being set up. Try again later, or contact the school office.",
    );
    expect(last.container.textContent).toContain("0123456011");
  });

  it("confirms Copied when the account number is copied", async () => {
    const written: string[] = [];
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: async (value: string) => void written.push(value) },
    });
    last = render(newWorld(false));
    await settle();
    await openAccounts(last.container);
    const copy = last.container.querySelector<HTMLButtonElement>(".student-transfer-number");
    expect(copy?.textContent).toContain("Copy");
    await act(async () => { copy?.click(); await Promise.resolve(); });
    expect(written).toEqual(["0123456011"]);
    expect(last.container.querySelector(".student-transfer-copy")?.textContent).toBe("Copied");
  });

  it("shows a transfer on its way, then received with its receipt, and updates the balance", async () => {
    const world = newWorld(false);
    last = render(world);
    await settle();
    await openAccounts(last.container);
    expect(last.container.querySelector(".fees-simple-children")?.textContent).toContain("₦5,000.00");
    world.deposits[11] = [{ reference: "D1", amount: 250_000, status: "PENDING", status_label: "Arriving", received_at: AS_OF, payment_ref: null, has_receipt: false }];
    await tick(5_000);
    await settle();
    expect(last.container.textContent).toContain("On its way: ₦2,500.00 for Tobi");

    const feesReads = world.calls.filter((call) => call === "GET /portal/parent/fees/").length;
    world.deposits[11] = [{ reference: "D1", amount: 250_000, status: "CONFIRMED", status_label: "Received", received_at: AS_OF, payment_ref: 77, has_receipt: true }];
    world.fees = feesBody(false, { tobi: 250_000, somto: 300_000 });
    await tick(5_000);
    await settle();
    expect(last.container.textContent).toContain("Received: ₦2,500.00 for Tobi");
    expect(last.container.querySelector('a[href="/fees/receipts/77"]')?.textContent).toBe("View receipt");
    expect(world.calls.filter((call) => call === "GET /portal/parent/fees/").length).toBeGreaterThan(feesReads);
    expect(last.container.querySelector(".fees-simple-children")?.textContent).toContain("₦2,500.00");
    expect(last.container.textContent).toContain("₦5,500.00");
  });

  it("keeps Tobi's received transfer on screen after it clears his balance", async () => {
    const world = newWorld(false);
    last = render(world);
    await settle();
    await openAccounts(last.container);
    world.deposits[11] = [{ reference: "D1", amount: 500_000, status: "CONFIRMED", status_label: "Received", received_at: AS_OF, payment_ref: 78, has_receipt: true }];
    world.fees = feesBody(false, { tobi: 0, somto: 300_000 });
    await tick(5_000);
    await settle();
    expect(last.container.textContent).toContain("Received: ₦5,000.00 for Tobi");
    expect(last.container.querySelector('a[href="/fees/receipts/78"]')).not.toBeNull();
  });

  it("asks once for each shown child every five seconds, from the time the screen opened", async () => {
    const world = newWorld(false);
    last = render(world);
    await settle();
    await openAccounts(last.container);
    expect(depositCalls(world)).toHaveLength(0);

    await tick(5_000);
    await settle();
    const first = depositCalls(world);
    expect(first).toHaveLength(2);
    expect(first.some((call) => call.includes("children/11/") && call.includes("since=2026-10-25T09%3A00%3A00Z"))).toBe(true);
    expect(first.some((call) => call.includes("children/22/"))).toBe(true);

    await tick(5_000);
    await settle();
    expect(depositCalls(world)).toHaveLength(4);
  });

  it("stops asking while the tab is hidden and asks at once when it is back", async () => {
    const world = newWorld(false);
    last = render(world);
    await settle();
    await openAccounts(last.container);
    await tick(5_000);
    await settle();
    const before = depositCalls(world).length;

    act(() => setVisibility("hidden"));
    await tick(60_000);
    await settle();
    expect(depositCalls(world)).toHaveLength(before);

    act(() => setVisibility("visible"));
    await tick(0);
    await settle();
    expect(depositCalls(world)).toHaveLength(before + 2);
  });
});

describe("Fees where the school takes cards", () => {
  it.each([true, undefined])("behaves as before when card payments are %s", async (flag) => {
    const world = newWorld(flag);
    last = render(world);
    await settle();
    expect(last.container.textContent).toContain("Pay all balances");
    expect(last.container.querySelector('a[href="/fees/pay-all"]')).not.toBeNull();
    expect(last.container.querySelector('a[href="/fees/pay/111"]')).not.toBeNull();
    expect(last.container.querySelector("#fees-transfer-heading")).toBeNull();
    expect(disclosure(last.container, "Show")).toBeDefined();
    await tick(10_000);
    expect(world.calls.some((call) => call.includes("transfer-account"))).toBe(false);
  });
});
