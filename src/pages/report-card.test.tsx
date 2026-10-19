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

import { ReportCardPage } from "./report-card";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const ME: MeData = {
  parent: { first_name: "P", full_name: "P", initials: "P" },
  school: { name: "S", logo_url: "" },
  show_branch: false,
  session: null,
  term: null,
  children: [
    {
      id: 11,
      first_name: "Tobi",
      full_name: "Tobi O",
      initials: "TO",
      photo_url: "",
      admission_number: "",
      class_name: "JSS1 A",
      relationship: "Mother",
    },
  ],
};

const CARD = {
  success: true,
  message: "",
  data: {
    letterhead: {
      school_name: "Lagoon View Academy",
      logo_url: null,
      branch_name: "Lekki",
      branch_address: null,
      phone: null,
    },
    term_line: "Report card · Third Term, 2025/2026",
    facts: [
      { label: "Student", value: "Tobi Okafor" },
      { label: "Class", value: "JSS1 A" },
    ],
    components: [{ short_name: "CA1", max_score: 20 }],
    subjects: [
      {
        name: "Math",
        cells: ["15"],
        total: 75,
        grade: "B",
        remark: "Good",
      },
    ],
    totals: [{ label: "Term average", value: "75.0%" }],
    attendance: [{ label: "Present", value: "8" }],
    grading_key: "A ≥ 70, B ≥ 60, …",
    version: 1,
    held: false,
  },
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
          <Routes>
            <Route path="/results/card/:termId" element={<ReportCardPage />} />
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

describe("ReportCardPage", () => {
  it("renders the released card and offers Download PDF", async () => {
    const fetchStub = vi.fn(async () =>
      new Response(JSON.stringify(CARD), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    const r = render("/results/card/43", fetchStub as unknown as typeof fetch);
    last = r;
    await act(() => new Promise((r) => setTimeout(r, 30)));
    expect(r.container.textContent).toContain("Report card · Third Term, 2025/2026");
    expect(r.container.textContent).toContain("Math");
    expect(r.container.textContent).toContain("Download PDF");
  });

  it("shows an unavailable sentence on 404 (held or unpublished term)", async () => {
    const fetchStub = vi.fn(async () =>
      new Response(JSON.stringify({ success: false, message: "No such card." }), {
        status: 404,
        headers: { "content-type": "application/json" },
      }),
    );
    const r = render("/results/card/999", fetchStub as unknown as typeof fetch);
    last = r;
    await act(() => new Promise((r) => setTimeout(r, 30)));
    expect(r.container.textContent).toContain("This report card isn't available");
    expect(r.container.textContent).not.toContain("Download PDF");
  });
});
