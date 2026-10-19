import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Calendar } from "./calendar";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let container: HTMLDivElement;
let root: Root;
beforeEach(() => { container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container); });
afterEach(() => { act(() => root.unmount()); container.remove(); });

describe("school calendar", () => {
  it("moves to another month and returns the selected date", () => {
    const choose = vi.fn();
    act(() => root.render(<Calendar selected="2026-10-18" onSelect={choose} />));
    act(() => (container.querySelector('button[aria-label="Next month"]') as HTMLButtonElement).click());
    expect((container.querySelector('select[aria-label="Month"]') as HTMLSelectElement).value).toBe("10");
    act(() => (container.querySelector('button[aria-label*="9 November 2026"]') as HTMLButtonElement).click());
    expect(choose).toHaveBeenCalledWith("2026-11-09");
  });
});
