/**
 * Paying a bill by card in the store app: Patricia pays Tobi's Third Term fees on the
 * gateway in the phone's in-app browser. The app comes back to the result by
 * the return link, or by her closing the browser, and the API alone says
 * whether she paid.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  open: vi.fn(),
  close: vi.fn(),
  navigate: vi.fn(),
  listeners: {} as Record<string, (event: unknown) => void>,
}));
vi.mock("@capacitor/browser", () => ({
  Browser: {
    open: (options: unknown) => mocks.open(options),
    close: () => mocks.close(),
    addListener: async (name: string, listener: (event: unknown) => void) => {
      mocks.listeners[name] = listener;
      return { remove: async () => undefined };
    },
  },
}));
vi.mock("@capacitor/app", () => ({
  App: {
    addListener: async (name: string, listener: (event: unknown) => void) => {
      mocks.listeners[name] = listener;
      return { remove: async () => undefined };
    },
  },
}));
vi.mock("react-router", () => ({ useNavigate: () => mocks.navigate }));
vi.mock("@/utils/school-host", () => ({ currentSchoolSlug: () => "lagoon-view" }));
vi.mock("./school-lookup", () => ({ lookUpSchool: vi.fn() }));

import { checkoutClosed, isPaymentReturn, openCheckout, resultPath } from "./checkout";
import { NativeCheckoutReturn } from "./native-checkout";
import { NativeLinks } from "./native-links";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;
beforeEach(async () => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  mocks.open.mockReset().mockResolvedValue(undefined);
  mocks.close.mockReset().mockResolvedValue(undefined);
  mocks.navigate.mockReset();
  mocks.listeners = {};
  checkoutClosed();
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const mountBoth = async () => {
  await act(async () => root.render(<><NativeLinks /><NativeCheckoutReturn /></>));
  await act(async () => undefined);
};
const RETURN = "https://lagoon-view.xvs.codexng.com/parent/fees/paid?reference=R-77&trxref=R-77";

describe("opening the checkout", () => {
  it("opens the gateway's page in the in-app browser, not in the web view", async () => {
    await openCheckout("https://checkout.paystack.com/abc", "R-77");
    expect(mocks.open).toHaveBeenCalledWith({ url: "https://checkout.paystack.com/abc" });
  });

  it("refuses an address that is not https, and one the browser cannot open", async () => {
    await expect(openCheckout("http://checkout.example/abc", "R-1")).rejects.toThrow();
    await expect(openCheckout("javascript:alert(1)", "R-1")).rejects.toThrow();
    expect(mocks.open).not.toHaveBeenCalled();
    mocks.open.mockRejectedValue(new Error("no browser"));
    await expect(openCheckout("https://checkout.paystack.com/abc", "R-2")).rejects.toThrow();
    expect(checkoutClosed()).toBeNull();
  });
});

describe("coming back by the return link", () => {
  it("closes the browser and shows the result for the reference in the link", async () => {
    await mountBoth();
    await openCheckout("https://checkout.paystack.com/abc", "R-77");
    await act(async () => mocks.listeners.appUrlOpen({ url: RETURN }));
    expect(mocks.close).toHaveBeenCalledTimes(1);
    expect(mocks.navigate).toHaveBeenCalledWith("/fees/paid?reference=R-77&trxref=R-77");
  });

  it("does not also send her to the result when the browser then goes away", async () => {
    await mountBoth();
    await openCheckout("https://checkout.paystack.com/abc", "R-77");
    await act(async () => mocks.listeners.appUrlOpen({ url: RETURN }));
    mocks.navigate.mockClear();
    await act(async () => mocks.listeners.browserFinished({}));
    expect(mocks.navigate).not.toHaveBeenCalled();
  });

  it("takes only the address from the link: nothing in it can mark a payment paid", async () => {
    await mountBoth();
    await openCheckout("https://checkout.paystack.com/abc", "R-77");
    await act(async () =>
      mocks.listeners.appUrlOpen({ url: "https://lagoon-view.xvs.codexng.com/parent/fees/paid?reference=R-77&status=success&paid=true" }),
    );
    expect(mocks.navigate).toHaveBeenCalledTimes(1);
    expect(mocks.navigate.mock.calls[0][0]).toMatch(/^\/fees\/paid\?/);
    expect(mocks.navigate.mock.calls[0]).toHaveLength(1);
  });

  it("closes no browser for a link that is not the payment return", async () => {
    await mountBoth();
    await openCheckout("https://checkout.paystack.com/abc", "R-77");
    await act(async () => mocks.listeners.appUrlOpen({ url: "https://lagoon-view.xvs.codexng.com/parent/notices" }));
    expect(mocks.close).not.toHaveBeenCalled();
    expect(mocks.navigate).toHaveBeenCalledWith("/notices");
  });
});

describe("closing the browser herself", () => {
  it("shows the result screen for the checkout she left, which asks the API", async () => {
    await mountBoth();
    await openCheckout("https://checkout.paystack.com/abc", "R-77");
    await act(async () => mocks.listeners.browserFinished({}));
    expect(mocks.navigate).toHaveBeenCalledWith(resultPath("R-77"));
    expect(resultPath("R-77")).toBe("/fees/paid?reference=R-77");
  });

  it("does so once, and not at all when no checkout was started", async () => {
    await mountBoth();
    await act(async () => mocks.listeners.browserFinished({}));
    expect(mocks.navigate).not.toHaveBeenCalled();
    await openCheckout("https://checkout.paystack.com/abc", "R-78");
    await act(async () => mocks.listeners.browserFinished({}));
    await act(async () => mocks.listeners.browserFinished({}));
    expect(mocks.navigate).toHaveBeenCalledTimes(1);
  });

  it("encodes the reference in the address", () => {
    expect(resultPath("a b&c")).toBe("/fees/paid?reference=a%20b%26c");
  });
});

describe("the return address", () => {
  it("is the payment result screen only", () => {
    expect(isPaymentReturn("/fees/paid")).toBe(true);
    expect(isPaymentReturn("/fees/paid?reference=R")).toBe(true);
    expect(isPaymentReturn("/fees")).toBe(false);
    expect(isPaymentReturn("/fees/paid-up")).toBe(false);
    expect(isPaymentReturn("/fees/pay/12")).toBe(false);
  });
});
