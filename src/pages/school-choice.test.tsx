import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  lookUp: vi.fn(),
  save: vi.fn(async () => {}),
  current: "",
}));
vi.mock("@/native/school-lookup", () => ({ lookUpSchool: mocks.lookUp }));
vi.mock("@/native/school-code", async (original) => ({
  ...(await original<typeof import("@/native/school-code")>()),
  saveSchoolCode: mocks.save,
}));
vi.mock("@/utils/school-host", () => ({ currentSchoolSlug: () => mocks.current }));
vi.mock("@/utils/school-brand", () => ({ schoolLogoUrl: () => "" }));
vi.mock("@/components/school-mark", () => ({ SchoolMark: ({ alt }: { alt?: string }) => <span>{alt}</span> }));

import { SchoolChoicePage } from "./school-choice";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let container: HTMLDivElement;
let root: Root;
const reload = vi.fn();
beforeEach(() => {
  mocks.lookUp.mockReset();
  mocks.save.mockClear();
  mocks.current = "";
  reload.mockClear();
  vi.stubGlobal("location", { ...window.location, replace: reload });
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root.render(<MemoryRouter><SchoolChoicePage /></MemoryRouter>));
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

async function enter(code: string) {
  const input = container.querySelector("input") as HTMLInputElement;
  await act(async () => {
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    set.call(input, code);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await act(async () => {
    (container.querySelector("form") as HTMLFormElement).requestSubmit();
  });
}

describe("choosing a school", () => {
  it("asks for the code with a hint", () => {
    expect(container.textContent).toContain("Enter your school code");
    expect(container.textContent).toContain("It is on the letter from your school, for example meridian.");
  });

  it("shows the school's name to confirm and keeps the code only when confirmed", async () => {
    mocks.lookUp.mockResolvedValue({ ok: true, name: "Meridian Crest Academy" });
    await enter(" Meridian ");
    expect(mocks.lookUp).toHaveBeenCalledWith("meridian");
    expect(container.textContent).toContain("Meridian Crest Academy");
    expect(mocks.save).not.toHaveBeenCalled();
    await act(async () => {
      (Array.from(container.querySelectorAll("button")).find((b) => b.textContent?.includes("Yes, this is my school")) as HTMLButtonElement).click();
    });
    expect(mocks.save).toHaveBeenCalledWith("meridian");
    expect(reload).toHaveBeenCalledWith("/");
  });

  it("says so when no school has the code, and keeps nothing", async () => {
    mocks.lookUp.mockResolvedValue({ ok: false, reason: "not-found" });
    await enter("nowhere");
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("could not find a school");
    expect(mocks.save).not.toHaveBeenCalled();
  });

  it("does not look up something that cannot be a code", async () => {
    await enter("not a code");
    expect(mocks.lookUp).not.toHaveBeenCalled();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("Enter your school code");
  });
});
