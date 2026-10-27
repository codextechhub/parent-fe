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

import { ResultsPage } from "./results";

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
    {
      id: 22,
      first_name: "Somto",
      full_name: "Somto O",
      initials: "SO",
      photo_url: "",
      admission_number: "",
      class_name: "Primary 4",
      relationship: "Mother",
    },
  ],
};

const RELEASED = {
  success: true,
  message: "",
  data: {
    state: "released",
    term: { id: 43, name: "Third Term", session: "2025/2026" },
    terms: [{ id: 43, name: "Third Term", session: "2025/2026", state: "released" }],
    class_name: "Primary 4",
    components: [{ short_name: "CA1", max_score: 20, is_exam: false }],
    subjects: [
      {
        name: "Math",
        teacher: null,
        cells: [{ short_name: "CA1", max_score: 20, mark: 15 }],
        total: 75,
        obtainable: 100,
        percentage: "75.00",
        grade: "B",
        remark: "Good",
      },
    ],
    summary: {
      overall_average: "75.00",
      subjects: 1,
      position_label: "3 of 20",
      class_average: "68.00",
    },
    teacher_comment: "Keep it up.",
    class_teacher: "Mrs. Smith",
  },
};

const WITHHELD = {
  success: true,
  message: "",
  data: {
    state: "withheld",
    term: { id: 44, name: "First Term", session: "2026/2027" },
    terms: [{ id: 44, name: "First Term", session: "2026/2027", state: "withheld" }],
    message: "Results are being held by the school until outstanding fees are paid.",
  },
};

const NOT_PUBLISHED = {
  success: true,
  message: "",
  data: { state: "not_published", term: null, terms: [] },
};

const SESSION = {
  success: true,
  message: "",
  data: {
    state: "released",
    session: { id: 14, name: "2025/2026" },
    terms: [
      { id: 43, name: "Third Term", session: "2025/2026", state: "released", average: "72.00" },
    ],
    terms_released: 1,
    terms_total: 3,
    cumulative: null,
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
          <ResultsPage />
        </MemoryRouter>
      </Provider>,
    ),
  );
  return { container, root };
}

function pickTermPayload(url: string, released = RELEASED, sessionPayload = SESSION) {
  if (url.includes("/results/session/")) return sessionPayload;
  if (url.includes("/results/")) return released;
  return RELEASED;
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

describe("ResultsPage", () => {
  it("renders a released term with subjects and class teacher's remark", async () => {
    const fetchStub = vi.fn(async (input: Parameters<typeof fetch>[0]) => {
      const url = input instanceof Request ? input.url : String(input);
      return new Response(JSON.stringify(pickTermPayload(url)), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });
    const r = render("/results", fetchStub as unknown as typeof fetch);
    last = r;
    await act(() => new Promise((r) => setTimeout(r, 30)));
    expect(r.container.textContent).toContain("Math");
    expect(r.container.textContent).toContain("Tobi's third term · 2025/2026");
    expect(r.container.textContent).toContain("Keep it up.");
    expect(r.container.textContent).toContain("Mrs. Smith");
  });

  it("shows the school's sentence when a term is held", async () => {
    const fetchStub = vi.fn(async () =>
      new Response(JSON.stringify(WITHHELD), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    const r = render("/results", fetchStub as unknown as typeof fetch);
    last = r;
    await act(() => new Promise((r) => setTimeout(r, 30)));
    expect(r.container.textContent).toContain(
      "Results are being held by the school until outstanding fees are paid.",
    );
    // No subjects should render for a held term.
    expect(r.container.textContent).not.toContain("Math");
  });

  it("says no results are published yet when the state is not_published", async () => {
    const fetchStub = vi.fn(async () =>
      new Response(JSON.stringify(NOT_PUBLISHED), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    const r = render("/results", fetchStub as unknown as typeof fetch);
    last = r;
    await act(() => new Promise((r) => setTimeout(r, 30)));
    expect(r.container.textContent).toContain("No results have been published for");
  });

  it("switching the ?child= in the URL refetches with the new child's id", async () => {
    const calls: string[] = [];
    const fetchStub = vi.fn(async (input: Parameters<typeof fetch>[0]) => {
      const url = input instanceof Request ? input.url : String(input);
      calls.push(url);
      return new Response(JSON.stringify(pickTermPayload(url)), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });
    const first = render("/results?child=22", fetchStub as unknown as typeof fetch);
    last = first;
    await act(() => new Promise((r) => setTimeout(r, 30)));
    const twentyTwo = calls.filter((u) => u.includes("/children/22/results/")).length;
    expect(twentyTwo).toBeGreaterThan(0);
    // Nothing fetched for child 11 - the "showing" child is 22.
    const eleven = calls.filter((u) => u.includes("/children/11/results/")).length;
    expect(eleven).toBe(0);
  });
});

describe("the children under the title (1d)", () => {
  const stub = () => vi.fn(async (input: Parameters<typeof fetch>[0]) => {
    const url = input instanceof Request ? input.url : String(input);
    return new Response(JSON.stringify(pickTermPayload(url)), { status: 200, headers: { "content-type": "application/json" } });
  });
  const chip = (container: HTMLElement, name: string) =>
    Array.from(container.querySelectorAll<HTMLButtonElement>(".child-picker-chip")).find((b) => b.textContent?.includes(name))!;

  it("shows each child, the one showing pressed, and the report card for that child", async () => {
    const r = render("/results?child=11", stub() as unknown as typeof fetch);
    last = r;
    await act(() => new Promise((r) => setTimeout(r, 30)));
    expect(chip(r.container, "Tobi").getAttribute("aria-pressed")).toBe("true");
    expect(chip(r.container, "Somto").getAttribute("aria-pressed")).toBe("false");
    expect(r.container.querySelector(".results-card-link")?.getAttribute("href")).toBe("/results/card/43?child=11");
  });

  it("reads the other child's results when their chip is tapped", async () => {
    const fetchStub = stub();
    const r = render("/results?child=11", fetchStub as unknown as typeof fetch);
    last = r;
    await act(() => new Promise((r) => setTimeout(r, 30)));
    await act(async () => {
      chip(r.container, "Somto").click();
      await new Promise((r) => setTimeout(r, 30));
    });
    expect(chip(r.container, "Somto").getAttribute("aria-pressed")).toBe("true");
    const asked = fetchStub.mock.calls.some(([input]) => /\/children\/22\/results\//.test(String(input instanceof Request ? input.url : input)));
    expect(asked).toBe(true);
    expect(r.container.textContent).toContain("Somto's third term");
  });
});

