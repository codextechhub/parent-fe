import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { PageHeader } from "./page-header";

/**
 * The heading every menu screen draws, at the Support screen's size.
 */
describe("PageHeader", () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
  });

  const render = (node: React.ReactNode) => act(() => root.render(node));

  it("draws the title as the page's h1 at the Support size", () => {
    render(<PageHeader title="Support" description="Issues raised at your school." />);
    const h1 = host.querySelector("h1");
    expect(h1?.textContent).toBe("Support");
    expect(h1?.className).toContain("font-semibold");
    expect(h1?.className).not.toMatch(/\btext-(xs|sm|lg|xl|\dxl)\b/);
    const description = host.querySelector("h1")?.parentElement?.nextElementSibling;
    expect(description?.textContent).toBe("Issues raised at your school.");
    expect(description?.className).toContain("text-xs");
    expect(description?.className).toContain("text-gray-01");
  });

  it("leaves out the description and the actions when there are none", () => {
    render(<PageHeader title="Students" />);
    expect(host.querySelector("h1")?.parentElement?.nextElementSibling).toBeNull();
    expect(host.firstElementChild?.children.length).toBe(1);
  });

  it("puts the aside on the title's line and the actions on the right", () => {
    render(
      <PageHeader
        title="Audit Trail"
        titleAside={<span data-testid="hint" />}
        actions={<button type="button">Export</button>}
        data-guide="finance.audit"
      />,
    );
    const titleLine = host.querySelector("h1")?.parentElement;
    expect(titleLine?.querySelector("[data-testid=hint]")).not.toBeNull();
    expect(host.querySelector("button")?.textContent).toBe("Export");
    expect(host.firstElementChild?.getAttribute("data-guide")).toBe("finance.audit");
  });
});
