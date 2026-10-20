import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Lagoon View Academy has uploaded its crest. The API stores it and serves it
 * only to a signed-in reader, so the header's mark fetches it with Patricia Okafor's
 * token; an `<img>` pointed at it directly would be refused and show the XVS
 * crest instead. The sign-in page's public crest needs no token.
 */
const image = vi.hoisted(() => ({
  answer: { data: undefined as string | undefined, isLoading: false, isError: false },
  asked: [] as string[],
}));
vi.mock("@/redux/services/portal-api", () => ({
  useAuthImageQuery: (url: string, options: { skip?: boolean }) => {
    if (!options.skip) image.asked.push(url);
    return options.skip ? { data: undefined, isLoading: false, isError: false } : image.answer;
  },
}));

import { SchoolMark } from "./school-mark";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const STORED = "/media/branding/lagoon-view-crest.png?token=abc&tenant=lagoon-view";
const PUBLIC = "https://api.codexng.com/v1/i/public/schools/lagoon-view/logo/";

describe("SchoolMark", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    image.asked = [];
    image.answer = { data: undefined, isLoading: false, isError: false };
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  const shownSrc = () => container.querySelector("img")?.getAttribute("src") ?? null;

  it("shows the school's stored crest fetched with the app's token", async () => {
    image.answer = { data: "blob:crest", isLoading: false, isError: false };
    await act(async () => root.render(<SchoolMark logo={STORED} animate={false} />));
    expect(image.asked).toHaveLength(1);
    expect(shownSrc()).toBe("blob:crest");
  });

  it("holds the space while the stored crest is on its way, with no XVS crest in it", async () => {
    image.answer = { data: undefined, isLoading: true, isError: false };
    await act(async () => root.render(<SchoolMark logo={STORED} animate={false} />));
    expect(shownSrc()).toBeNull();
  });

  it("falls back to the XVS crest when the stored crest cannot be had", async () => {
    image.answer = { data: undefined, isLoading: false, isError: true };
    await act(async () => root.render(<SchoolMark logo={STORED} animate={false} />));
    expect(shownSrc()).toContain("svg/xvs-logo.svg");
  });

  it("shows the public crest as it is, asking for no token", async () => {
    await act(async () => root.render(<SchoolMark logo={PUBLIC} animate={false} />));
    expect(image.asked).toHaveLength(0);
    expect(shownSrc()).toBe(PUBLIC);
  });
});
