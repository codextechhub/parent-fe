import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { Provider } from "react-redux";
import { MemoryRouter } from "react-router";
import { configureStore } from "@reduxjs/toolkit";
import { Toaster } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { setAccessToken } from "@/auth/access-token";
import { _resetCsrfCache } from "@/auth/csrf";
import { _resetRefreshForTests } from "@/auth/refresh";
import { authReducer, meLoaded, type MeData } from "@/redux/features/auth-slice";
import { connectivityReducer } from "@/redux/features/connectivity-slice";
import { baseApi } from "@/redux/services/base-api";
import "@/redux/services/portal-api";

import { ProfilePage } from "./profile";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const ME: MeData = {
  parent: { first_name: "Patricia", full_name: "Mrs. Patricia Okafor", initials: "PO" },
  school: { name: "Lagoon View", logo_url: "" },
  show_branch: true,
  session: null,
  term: null,
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
  ],
};

function profilePayload() {
  return {
    success: true,
    message: "ok",
    data: {
      photo_url: "",
      managed_by_school: {
        full_name: "Mrs. Patricia Okafor",
        sign_in_email: "patricia@example.ng",
        children: ME.children,
      },
      editable: { phone: "0803 456 7890", alt_phone: "", address: "" },
      email_editable: false,
    },
  };
}

function render(fetchImpl: typeof fetch) {
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
  store.dispatch(meLoaded(ME));
  act(() =>
    root.render(
      <Provider store={store}>
        <MemoryRouter initialEntries={["/profile"]}>
          <ProfilePage />
          <Toaster />
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

describe("ProfilePage", () => {
  it("shows the sign-in email as read-only with the backend's sentence", async () => {
    const fetchStub = vi.fn(async () =>
      new Response(JSON.stringify(profilePayload()), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    const r = render(fetchStub as unknown as typeof fetch);
    last = r;
    await act(() => new Promise((r) => setTimeout(r, 20)));
    expect(r.container.textContent).toContain("patricia@example.ng");
    expect(r.container.textContent).toContain(
      "Your email is the address you sign in with. Ask the school to change it.",
    );
    // No "Edit email" control anywhere.
    expect(r.container.textContent).not.toContain("Edit email");
  });

  it("opens Edit and saves a changed address, surfacing a per-field refusal", async () => {
    let patchCalls = 0;
    const current = profilePayload();
    const fetchStub = vi.fn(async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
      const url = input instanceof Request ? input.url : String(input);
      const method = (input instanceof Request ? input.method : init?.method) ?? "GET";
      if (url.includes("/portal/parent/profile/") && method === "PATCH") {
        patchCalls += 1;
        if (patchCalls === 1) {
          return new Response(
            JSON.stringify({
              success: false,
              message: "That could not be saved.",
              error: {
                code: "VALIDATION_ERROR",
                detail: { address: ["Keep the address to 500 characters or fewer."] },
              },
            }),
            { status: 400, headers: { "content-type": "application/json" } },
          );
        }
        current.data.editable.address = "123 Lekki";
        return new Response(JSON.stringify(current), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      return new Response(JSON.stringify(current), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });
    const r = render(fetchStub as unknown as typeof fetch);
    last = r;
    await act(() => new Promise((r) => setTimeout(r, 20)));
    const editButton = r.container.querySelector<HTMLButtonElement>('button[aria-label="Edit your contact details"]') ?? undefined;
    await act(async () => {
      editButton!.click();
    });
    const address = r.container.querySelector<HTMLTextAreaElement>("#profile-address")!;
    // React tracks the input's value through a native setter; set it that way so
    // the controlled-component change handler fires.
    const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")!.set!;
    await act(async () => {
      setter.call(address, "123 Lekki");
      address.dispatchEvent(new Event("input", { bubbles: true }));
    });
    const saveButton = Array.from(r.container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Save changes"),
    ) as HTMLButtonElement | undefined;
    expect(saveButton?.disabled).toBe(false);
    // First submit: 400 → inline per-field refusal under the address box.
    await act(async () => {
      saveButton!.click();
      await new Promise((r) => setTimeout(r, 30));
    });
    expect(r.container.textContent).toContain("Keep the address to 500 characters or fewer.");
    // Second submit: 200 → form closes, dl shows the new address.
    await act(async () => {
      saveButton!.click();
      await new Promise((r) => setTimeout(r, 30));
    });
    expect(r.container.textContent).toContain("123 Lekki");
    // Form closed.
    expect(r.container.querySelector("#profile-address")).toBeNull();
  });

  it("lists linked children with branch when show_branch is true", async () => {
    const fetchStub = vi.fn(async () =>
      new Response(JSON.stringify(profilePayload()), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    const r = render(fetchStub as unknown as typeof fetch);
    last = r;
    await act(() => new Promise((r) => setTimeout(r, 20)));
    const list = r.container.querySelector(".profile-linked-list");
    expect(list?.textContent).toContain("Tobi Okafor");
    expect(list?.textContent).toContain("JSS1 A");
    expect(list?.textContent).toContain("Lekki");
    const link = list?.querySelector("a") as HTMLAnchorElement;
    expect(link.getAttribute("href")).toBe("/results?child=11");
  });

  it("uploads the parent's photo from the camera in the banner", async () => {
    const sent: Request[] = [];
    const fetchStub = vi.fn(async (input: RequestInfo | URL) => {
      if (input instanceof Request) sent.push(input.clone());
      return new Response(JSON.stringify(profilePayload()), {
        status: input instanceof Request && input.method === "POST" ? 201 : 200,
        headers: { "content-type": "application/json" },
      });
    });
    const r = render(fetchStub as unknown as typeof fetch);
    last = r;
    await act(() => new Promise((r) => setTimeout(r, 20)));
    expect(r.container.querySelector(".profile-hero-avatar")?.textContent).toBe("PO");
    expect(r.container.querySelector('button[aria-label="Profile photo options"]')).not.toBeNull();

    const input = r.container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File([new Uint8Array([137, 80, 78, 71])], "me.png", { type: "image/png" });
    Object.defineProperty(input, "files", { value: [file], configurable: true });
    await act(async () => {
      input.dispatchEvent(new Event("change", { bubbles: true }));
      await new Promise((r) => setTimeout(r, 20));
    });
    const post = sent.find((req) => req.method === "POST" && req.url.includes("/portal/parent/profile/photo/"));
    expect(post).toBeDefined();
  });

  it("refuses a file that is not a photo before sending anything", async () => {
    const fetchStub = vi.fn(async () =>
      new Response(JSON.stringify(profilePayload()), { status: 200, headers: { "content-type": "application/json" } }),
    );
    const r = render(fetchStub as unknown as typeof fetch);
    last = r;
    await act(() => new Promise((r) => setTimeout(r, 20)));
    const calls = fetchStub.mock.calls.length;
    const input = r.container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["%PDF"], "me.pdf", { type: "application/pdf" });
    Object.defineProperty(input, "files", { value: [file], configurable: true });
    await act(async () => {
      input.dispatchEvent(new Event("change", { bubbles: true }));
      await new Promise((r) => setTimeout(r, 20));
    });
    expect(fetchStub.mock.calls.length).toBe(calls);
  });
});
