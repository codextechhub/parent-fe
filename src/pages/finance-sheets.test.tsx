/**
 * The invoice and receipt sheets draw the school's printed design.
 *
 * Mrs Bello's son Tunde is billed at Bright Star School: 150,000 of tuition,
 * exempt from VAT, and 24,000 of uniforms carrying 1,800 of VAT. She has paid
 * 100,000 and the school wrote off 5,000, so 70,800 is left. The sheet shows
 * the school's letterhead, each line with its VAT, the totals that reconcile,
 * and the account to pay into, as the PDF does.
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
import { authReducer, meLoaded, type MeData } from "@/redux/features/auth-slice";
import { connectivityReducer } from "@/redux/features/connectivity-slice";
import { baseApi } from "@/redux/services/base-api";
import type { InvoiceDocument, InvoiceSheet, Receipt } from "@/redux/services/portal-api";

import { InvoicePage } from "./invoice";
import { ReceiptPage } from "./receipt";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const ME: MeData = {
  parent: { first_name: "Adaeze", full_name: "Adaeze Bello", initials: "AB" },
  school: { name: "Bright Star School", logo_url: "" },
  show_branch: false,
  session: null,
  term: null,
  children: [
    { id: 11, first_name: "Tunde", full_name: "Tunde Bello", initials: "TB", photo_url: "", admission_number: "", class_name: "JSS1 A", relationship: "Mother" },
  ],
};

const LETTERHEAD = {
  name: "Bright Star School",
  tag: "Knowledge and service",
  logo_url: "",
  address: "14 Admiralty Way, Lekki",
  email: "bursary@brightstar.test",
  phone: "",
  website: "brightstar.test",
};

function document_(overrides: Partial<InvoiceDocument> = {}): InvoiceDocument {
  return {
    document_number: "BSS-INV-2026-00001",
    invoice_date: "2026-09-05",
    due_date: "2026-09-19",
    reference: "JSS1 / Term 1",
    narration: "Tuition is VAT-exempt.",
    status: "PARTIAL",
    letterhead: LETTERHEAD,
    billed_to: { name: "Mrs Bello", code: "PAR-204", email: "bello@example.test", phone: "", address: "7 Glover Court" },
    lines: [
      { description: "Tuition", detail: "Term 1", quantity: "1", unit_price: 15000000, tax_amount: 0, tax_label: "Exempt", amount: 15000000 },
      { description: "School uniform", detail: "", quantity: "2", unit_price: 1200000, tax_amount: 180000, tax_label: "", amount: 2400000 },
    ],
    subtotal: 17400000,
    tax_total: 180000,
    total: 17580000,
    amount_paid: 10000000,
    adjustments: 500000,
    balance_due: 7080000,
    bank: { bank_name: "GTBank", account_name: "Bright Star School Ltd", account_number: "0123456789" },
    ...overrides,
  };
}

function invoice(document?: InvoiceDocument | null): InvoiceSheet {
  return {
    invoice_ref: 101,
    number: "BSS-INV-2026-00001",
    title: "First Term",
    invoice_date: "2026-09-05",
    due_date: "2026-09-19",
    lines: [{ description: "Tuition", amount: 15000000 }, { description: "School uniform", amount: 2580000 }],
    total: 17580000,
    paid: 10000000,
    balance: 7080000,
    status: "PARTIAL",
    status_label: "Part-paid",
    child: { id: 11, first_name: "Tunde" },
    ...(document === undefined ? {} : { document }),
  };
}

function receipt(overrides: Partial<Receipt> = {}): Receipt {
  return {
    payment_ref: 41,
    receipt_number: "BSS-RCP-2026-00041",
    paid_on: "2026-09-12",
    amount: 10000000,
    method: "CARD",
    method_label: "Card",
    reference: "PSK-7H2K9",
    payer_name: "",
    received_from: "Mrs Bello",
    lines: [{ invoice_number: "BSS-INV-2026-00001", title: "First Term", amount_applied: 10000000, balance_after: 7580000 }],
    balance_after: 7580000,
    issuer_name: "Bright Star School",
    letterhead: LETTERHEAD,
    amount_in_words: "One hundred thousand naira only",
    customer_code: "PAR-204",
    child: { id: 11, first_name: "Tunde" },
    ...overrides,
  };
}

function answer(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function render(path: string, body: unknown, status = 200) {
  const familyFees = { children: [], combined: { available: false, message: "" }, pay_all: { total: 0, steps: [] } };
  globalThis.fetch = vi.fn(async (input: Parameters<typeof fetch>[0]) => {
    const url = input instanceof Request ? input.url : String(input);
    // The invoice page also reads the family's fees, to know how this school's families pay.
    if (/\/portal\/parent\/fees\/(\?.*)?$/.test(url)) return answer({ success: true, message: "", data: familyFees });
    return answer(status === 200 ? { success: true, message: "", data: body } : body, status);
  }) as unknown as typeof fetch;
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
            <Route path="/fees/invoices/:invoiceRef" element={<InvoicePage />} />
            <Route path="/fees/receipts/:paymentRef" element={<ReceiptPage />} />
          </Routes>
        </MemoryRouter>
      </Provider>,
    ),
  );
  last = { container, root };
  return container;
}

async function settle() {
  await act(() => new Promise((resolve) => setTimeout(resolve, 30)));
}

function sheet(container: HTMLElement) {
  return container.querySelector<HTMLElement>("article.fdoc");
}

let last: { container: HTMLDivElement; root: Root } | null = null;
beforeEach(() => {
  document.cookie = "csrftoken=abc; path=/";
  _resetCsrfCache();
  _resetRefreshForTests();
  setAccessToken("token");
  const happy = (window as unknown as { happyDOM?: { setURL: (u: string) => void } }).happyDOM;
  happy?.setURL("http://bright-star.localhost:5176/parent/");
});
afterEach(() => {
  if (last) {
    act(() => last!.root.unmount());
    last.container.remove();
    last = null;
  }
});

describe("Invoice sheet", () => {
  it("draws the printed invoice: letterhead, lines with VAT, reconciling totals, bank", async () => {
    const c = render("/fees/invoices/101", invoice(document_()));
    await settle();
    const doc = sheet(c)!;
    const text = doc.textContent ?? "";

    expect(doc.querySelector(".fdoc-school")?.textContent).toBe("Bright Star School");
    expect(text).toContain("Tax Invoice");
    expect(text).toContain("BSS-INV-2026-00001");
    expect(text).toContain("14 Admiralty Way, Lekki");
    expect(text).toContain("Account · PAR-204");

    const rows = [...doc.querySelectorAll("tbody tr")];
    expect(rows).toHaveLength(2);
    expect(rows[0].querySelector(".fdoc-tax-tag")?.textContent).toBe("Exempt");
    expect(rows[1].textContent).toContain("₦1,800.00");

    // Header to cell: each line has one cell per heading.
    expect(doc.querySelectorAll("thead th")).toHaveLength(5);
    rows.forEach((row) => expect(row.querySelectorAll("td")).toHaveLength(5));

    expect(text).toContain("Subtotal (net)₦174,000.00");
    expect(text).toContain("VAT₦1,800.00");
    expect(text).toContain("Total₦175,800.00");
    expect(text).toContain("Amount paid− ₦100,000.00");
    expect(text).toContain("Credits and adjustments− ₦5,000.00");
    expect(doc.querySelector(".fdoc-balance")?.textContent).toBe("Balance due₦70,800.00");

    expect(text).toContain("0123456789");
    expect(doc.querySelector(".fdoc-badge")?.className).toContain("is-partial");
  });

  it("leaves out the bank, the paid row and the credits row when there are none", async () => {
    const c = render(
      "/fees/invoices/101",
      invoice(document_({ bank: null, amount_paid: 0, adjustments: 0, balance_due: 17580000, status: "UNPAID", tax_total: 0 })),
    );
    await settle();
    const text = sheet(c)!.textContent ?? "";

    expect(text).not.toContain("Payment by bank transfer");
    expect(text).not.toContain("Amount paid");
    expect(text).not.toContain("Credits and adjustments");
    expect(text).not.toContain("VAT₦");
    expect(text).toContain("Please pay on or before the due date");
  });

  it("draws the summary fields under the school's name from a server without the document", async () => {
    const c = render("/fees/invoices/101", invoice());
    await settle();
    const doc = sheet(c)!;

    expect(doc.querySelector(".fdoc-school")?.textContent).toBe("Bright Star School");
    expect(doc.querySelectorAll("thead th")).toHaveLength(2);
    expect(doc.querySelectorAll("tbody tr")).toHaveLength(2);
    expect(doc.querySelector(".fdoc-balance")?.textContent).toBe("Balance due₦70,800.00");
    expect(doc.textContent).not.toContain("Payment by bank transfer");
  });

  it("says the invoice is not available when it is not the family's", async () => {
    const c = render("/fees/invoices/101", { success: false, message: "No such invoice." }, 404);
    await settle();

    expect(sheet(c)).toBeNull();
    expect(c.textContent).toContain("Invoice not available");
  });
});

describe("Receipt sheet", () => {
  it("draws the printed receipt: letterhead, amount in words, settlement, balance after", async () => {
    const c = render("/fees/receipts/41", receipt());
    await settle();
    const doc = sheet(c)!;
    const text = doc.textContent ?? "";

    expect(doc.querySelector(".fdoc-school")?.textContent).toBe("Bright Star School");
    expect(doc.querySelector(".fdoc-kind-title")?.className).toContain("is-paid");
    expect(text).toContain("BSS-RCP-2026-00041");
    expect(doc.querySelector(".fdoc-hero-amount")?.textContent).toBe("₦100,000.00");
    expect(text).toContain("One hundred thousand naira only");
    expect(text).toContain("Account · PAR-204");
    expect(text).toContain("On behalf of Tunde");

    const rows = [...doc.querySelectorAll("tbody tr")];
    expect(rows).toHaveLength(1);
    expect(rows[0].querySelectorAll("td")).toHaveLength(doc.querySelectorAll("thead th").length);
    expect(rows[0].textContent).toContain("BSS-INV-2026-00001");
    expect(doc.querySelector(".fdoc-after-box")?.textContent).toBe("Account balance after this payment₦75,800.00 owing");
  });

  it("words a balance in credit without a minus sign", async () => {
    const c = render("/fees/receipts/41", receipt({ balance_after: -2000000 }));
    await settle();
    expect(c.querySelector(".fdoc-after-box")?.textContent).toBe("Account balance after this payment₦20,000.00 in credit");
  });

  it("says nothing is owing when the balance is zero", async () => {
    const c = render("/fees/receipts/41", receipt({ balance_after: 0 }));
    await settle();
    expect(c.querySelector(".fdoc-after-box")?.textContent).toBe("Account balance after this payment₦0.00");
  });

  it("shows a receipt not yet applied to an invoice as unallocated credit", async () => {
    const c = render("/fees/receipts/41", receipt({ lines: [] }));
    await settle();
    const row = sheet(c)!.querySelector("tbody tr")!;

    expect(row.textContent).toContain("Unallocated credit");
    expect(row.textContent).toContain("₦100,000.00");
  });

  it("names the school from a server that sends no letterhead", async () => {
    const c = render(
      "/fees/receipts/41",
      receipt({ letterhead: undefined, amount_in_words: undefined, customer_code: undefined, issuer_name: "Bright Star School" }),
    );
    await settle();
    const doc = sheet(c)!;

    expect(doc.querySelector(".fdoc-school")?.textContent).toBe("Bright Star School");
    expect(doc.querySelector(".fdoc-hero-words")).toBeNull();
    expect(doc.textContent).not.toContain("Account ·");
  });
});
