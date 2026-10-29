/**
 * The whole app crashing while it draws: the error page in place of a blank
 * white screen, with a way back in.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { Provider } from "react-redux";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CrashBoundary } from "@/components/crash-boundary";
import { store } from "@/redux/store";

import { CrashPage } from "./crash";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let container: HTMLDivElement;
let root: Root;

function Broken(): never {
  throw new Error("a bug at the top of the app");
}

/** As `main.tsx` draws the app: the boundary inside the store, which the page's crest reads. */
const app = () => <Provider store={store}><CrashBoundary fallback={() => <CrashPage />}><Broken /></CrashBoundary></Provider>;

beforeEach(() => {
  // React reports the caught error to the console; the test expects it.
  vi.spyOn(console, "error").mockImplementation(() => {});
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => { act(() => root.unmount()); container.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("the app crashing", () => {
  it("shows the error page instead of a blank screen", () => {
    act(() => root.render(app()));
    expect(container.querySelector("[role=alert]")?.textContent).toContain("The app stopped working.");
  });

  it("loads the app again on Try again, and offers the home screen in case this address is the one that breaks", () => {
    const reload = vi.fn();
    vi.stubGlobal("location", { ...window.location, reload });
    act(() => root.render(app()));
    act(() => container.querySelector("button")!.click());
    expect(reload).toHaveBeenCalled();
    expect(container.querySelector<HTMLAnchorElement>("a")?.getAttribute("href")).toBe("/parent/");
  });
});
