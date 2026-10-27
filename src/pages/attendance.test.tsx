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

import { AttendancePage } from "./attendance";

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

function payload(child: "Tobi" | "Somto") {
  return {
    success: true,
    message: "",
    data: {
      term: {
        id: 44,
        name: "First Term",
        session_name: "2026/2027",
        start_date: "2026-08-17",
        end_date: "2026-11-15",
        is_current: true,
      },
      terms: [
        {
          id: 44,
          name: "First Term",
          session_name: "2026/2027",
          start_date: "2026-08-17",
          end_date: "2026-11-15",
          is_current: true,
        },
      ],
      counts:
        child === "Tobi"
          ? { present: 10, late: 1, absent: 1, excused: 0, not_taken: 25, opened: 36, rate: 83.3 }
          : { present: 0, late: 0, absent: 0, excused: 0, not_taken: 0, opened: 0, rate: null },
      days:
        child === "Tobi"
          ? [
              {
                date: "2026-10-10",
                state: "MARKED",
                mark: "A",
                arrived_at: null,
                closed_reason: null,
              },
            ]
          : [],
      notes:
        child === "Tobi"
          ? [
              {
                date: "2026-10-10",
                mark: "A",
                mark_label: "Absent",
                reason_label: "Illness",
                note: "",
                arrived_at: null,
              },
            ]
          : [],
      today: null,
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

function render(path: string, fetchImpl: typeof fetch) {
  globalThis.fetch = fetchImpl;
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() =>
    root.render(
      <Provider store={makeStore()}>
        <MemoryRouter initialEntries={[path]}>
          <AttendancePage />
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

describe("AttendancePage", () => {
  it("shows the rate, counts and the absent day in Days to note", async () => {
    const fetchStub = vi.fn(async () =>
      new Response(JSON.stringify(payload("Tobi")), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    const r = render("/attendance?child=11", fetchStub as unknown as typeof fetch);
    last = r;
    await act(() => new Promise((r) => setTimeout(r, 30)));
    expect(r.container.textContent).toContain("83");
    expect(r.container.textContent).toContain("Absent");
    expect(r.container.textContent).toContain("Illness");
    // The teacher-tip sentence stays as copy, not a link.
    expect(r.container.textContent).toContain("Tell Tobi's class teacher");
    const links = r.container.querySelectorAll("a[href*='message']");
    expect(links.length).toBe(0);
  });

  it("falls back to 'Not yet' when the term has no rate", async () => {
    const fetchStub = vi.fn(async () =>
      new Response(JSON.stringify(payload("Somto")), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    const r = render("/attendance?child=22", fetchStub as unknown as typeof fetch);
    last = r;
    await act(() => new Promise((r) => setTimeout(r, 30)));
    expect(r.container.textContent).toContain("Not yet");
    expect(r.container.textContent).toContain("No register has been taken this term yet.");
    expect(r.container.textContent).toContain("Somto's attendance this term");
  });
});

describe("the children under the title (1e)", () => {
  it("names the child showing, and reads another child's attendance when their chip is tapped", async () => {
    const fetchStub = vi.fn(async (input: Parameters<typeof fetch>[0]) => {
      const url = input instanceof Request ? input.url : String(input);
      return new Response(JSON.stringify(payload(url.includes("/children/22/") ? "Somto" : "Tobi")), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });
    const r = render("/attendance?child=11", fetchStub as unknown as typeof fetch);
    last = r;
    await act(() => new Promise((r) => setTimeout(r, 30)));
    expect(r.container.textContent).toContain("Tobi was present");
    const chip = (name: string) => Array.from(r.container.querySelectorAll<HTMLButtonElement>(".child-picker-chip")).find((b) => b.textContent?.includes(name))!;
    await act(async () => {
      chip("Somto").click();
      await new Promise((r) => setTimeout(r, 30));
    });
    expect(chip("Somto").getAttribute("aria-pressed")).toBe("true");
    const asked = fetchStub.mock.calls.some(([input]) => /\/children\/22\/attendance\//.test(String(input instanceof Request ? input.url : input)));
    expect(asked).toBe(true);
    expect(r.container.textContent).toContain("Somto's attendance this term");
  });
});

