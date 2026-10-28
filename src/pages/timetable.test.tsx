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

import { TimetablePage } from "./timetable";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const ME: MeData = {
  parent: { first_name: "Patricia", full_name: "Patricia", initials: "P" },
  school: { name: "Lagoon View", logo_url: "" },
  show_branch: true,
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
      branch: { id: 1, name: "Lekki" },
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
      branch: { id: 2, name: "Ikoyi" },
    },
  ],
};

const UNPUBLISHED = {
  success: true,
  message: "",
  data: {
    published: false,
    class_name: "JSS1 A",
    days: [],
    today: null,
  },
};

const PUBLISHED = {
  success: true,
  message: "",
  data: {
    published: true,
    class_name: "Primary 4",
    days: [
      {
        day_of_week: 1,
        day_label: "Monday",
        is_today: true,
        cells: [
          {
            start_time: "08:00:00",
            end_time: "09:00:00",
            kind: "LESSON",
            label: "English",
            subject: "English",
            teacher: "Mrs. Afolabi",
            room: "A1",
          },
        ],
      },
    ],
    today: {
      date: "2026-10-19",
      periods: [
        {
          start_time: "08:00:00",
          end_time: "09:00:00",
          kind: "LESSON",
          label: "English",
          subject: "English",
          teacher: "Mrs. Afolabi",
          room: "A1",
          state: "now",
        },
      ],
    },
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

function render(path: string, fetchImpl: typeof fetch, store = makeStore()) {
  globalThis.fetch = fetchImpl;
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() =>
    root.render(
      <Provider store={store}>
        <MemoryRouter initialEntries={[path]}>
          <TimetablePage />
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

describe("TimetablePage", () => {
  it("tells the parent when the class's timetable has not been published", async () => {
    const fetchStub = vi.fn(async () =>
      new Response(JSON.stringify(UNPUBLISHED), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    const r = render("/timetable", fetchStub as unknown as typeof fetch);
    last = r;
    await act(() => new Promise((r) => setTimeout(r, 30)));
    expect(r.container.textContent).toContain(
      "Tobi's class timetable hasn't been published yet",
    );
    // The title names the child, with their class and branch over it.
    expect(r.container.querySelector("h1")?.textContent).toBe("Tobi's timetable");
    expect(r.container.querySelector(".screen-title-eyebrow")?.textContent).toContain("JSS1 A");
    expect(r.container.querySelector(".screen-title-eyebrow")?.textContent).toContain("Lekki");
  });

  it("renders the published grid for a child whose class has one", async () => {
    const fetchStub = vi.fn(async (input: Parameters<typeof fetch>[0]) => {
      const url = input instanceof Request ? input.url : String(input);
      // Return UNPUBLISHED for child=11, PUBLISHED for child=22 - the active
      // child comes from ?child=22, so this is the one that fetches.
      if (url.includes("/children/22/timetable/")) {
        return new Response(JSON.stringify(PUBLISHED), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      return new Response(JSON.stringify(UNPUBLISHED), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });
    const r = render("/timetable?child=22", fetchStub as unknown as typeof fetch);
    last = r;
    await act(() => new Promise((r) => setTimeout(r, 30)));
    expect(r.container.textContent).toContain("English");
    expect(r.container.textContent).toContain("Mrs. Afolabi");
    // The "unpublished" banner must NOT render here.
    expect(r.container.textContent).not.toContain("hasn't been published yet");
    const showing = r.container.querySelector('.child-picker-chip[aria-pressed="true"]');
    expect(showing?.textContent).toContain("Somto");
  });
});
