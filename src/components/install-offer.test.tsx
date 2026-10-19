/**
 * The "Get the app" card on Home and the "Install the app" row on Profile, at
 * Lagoon View, whose manifest names the app "Lagoon" under its icon.
 *
 * Neither shows on a device where the app is installed: inside the installed
 * app, in a browser on a phone that installed it earlier, or where Chrome
 * says it is installed. Elsewhere the card says one thing for the browser in
 * hand. On an iPhone the install card comes before the notifications offer,
 * which waits for the installed app; that order is tested in `home.test.tsx`.
 */
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/redux/services/school-api", () => ({ useSchoolNameQuery: () => ({ data: "Lagoon View Academy" }) }));
vi.mock("@/utils/school-host", () => ({ currentSchoolSlug: () => "lagoon-view" }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const UA = {
  androidChrome:
    "Mozilla/5.0 (Linux; Android 14; SM-A546E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36",
  iPhoneSafari:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
  samsungInternet:
    "Mozilla/5.0 (Linux; Android 14; SAMSUNG SM-A546E) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/27.0 Chrome/125.0.0.0 Mobile Safari/537.36",
  iPhoneChrome:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0.6723.90 Mobile/15E148 Safari/604.1",
  instagramAndroid:
    "Mozilla/5.0 (Linux; Android 14; SM-A546E; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/129.0.6668.100 Mobile Safari/537.36 Instagram 352.0.0.38.100 Android",
};

/** The display modes the page answers to, and who is listening for a change. */
const display = { modes: new Set<string>(), listeners: new Set<() => void>() };

function setBrowser(userAgent: string, platform = "Linux armv8l") {
  Object.defineProperty(navigator, "userAgent", { configurable: true, get: () => userAgent });
  Object.defineProperty(navigator, "platform", { configurable: true, get: () => platform });
}

function openAs(mode: "browser" | "standalone" | "fullscreen" | "minimal-ui") {
  display.modes = new Set(mode === "browser" ? [] : [`(display-mode: ${mode})`]);
  for (const listener of display.listeners) listener();
}

/**
 * Fresh copies of the install modules, so nothing one test learned leaks into
 * the next, with the React, router and `act` they render with.
 */
async function load() {
  vi.resetModules();
  const React = await import("react");
  const { act } = React;
  const { createRoot } = await import("react-dom/client");
  const { MemoryRouter } = await import("react-router");
  const offer = await import("./install-offer");
  const prompt = await import("@/install/install-prompt");
  const installed = await import("@/install/installed");
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  const render = (node: ReactNode) => act(() => root.render(React.createElement(MemoryRouter, null, node)));
  cleanup = () => {
    act(() => root.unmount());
    container.remove();
  };
  const text = () => container.textContent ?? "";
  const button = (label: string) => [...container.querySelectorAll("button")].find((b) => b.textContent?.includes(label));
  return { React, act, offer, prompt, installed, container, render, text, button };
}

let cleanup = () => {};

beforeEach(() => {
  localStorage.clear();
  display.listeners.clear();
  openAs("browser");
  setBrowser(UA.androidChrome);
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: (media: string) => ({
      media,
      get matches() {
        return display.modes.has(media);
      },
      addEventListener: (_: string, listener: () => void) => display.listeners.add(listener),
      removeEventListener: (_: string, listener: () => void) => display.listeners.delete(listener),
    }),
  });
});

afterEach(() => {
  cleanup();
  cleanup = () => {};
  vi.unstubAllGlobals();
  delete (navigator as { standalone?: boolean }).standalone;
  delete (navigator as { getInstalledRelatedApps?: unknown }).getInstalledRelatedApps;
});

/** The card and the row, side by side, as Home and Profile draw them. */
function both(m: Awaited<ReturnType<typeof load>>) {
  return m.React.createElement(
    m.React.Fragment,
    null,
    m.React.createElement(m.offer.InstallOffer),
    m.React.createElement(m.offer.InstallSetting),
  );
}

function expectNothingShown(m: Awaited<ReturnType<typeof load>>) {
  expect(m.container.querySelector('[aria-label="Get the app"]')).toBeNull();
  expect(m.container.querySelector('[aria-label="Install the app"]')).toBeNull();
}

describe("once the app is installed, neither the card nor the row shows", () => {
  for (const mode of ["standalone", "fullscreen", "minimal-ui"] as const) {
    it(`inside the installed app (${mode})`, async () => {
      openAs(mode);
      const m = await load();
      m.render(both(m));
      expectNothingShown(m);
    });
  }

  it("inside the app on an iPhone's Home Screen (navigator.standalone)", async () => {
    setBrowser(UA.iPhoneSafari, "iPhone");
    Object.defineProperty(navigator, "standalone", { configurable: true, value: true });
    const m = await load();
    m.render(both(m));
    expectNothingShown(m);
  });

  it("in the browser on a phone that installed it earlier", async () => {
    localStorage.setItem("xvs.parent.installed", "1");
    const m = await load();
    m.render(both(m));
    expectNothingShown(m);
  });

  it("where Chrome says the app is installed", async () => {
    Object.defineProperty(navigator, "getInstalledRelatedApps", {
      configurable: true,
      value: async () => [{ platform: "webapp", url: "https://lagoon-view.xvs.codexng.com/parent/manifest.webmanifest" }],
    });
    const m = await load();
    m.render(both(m));
    expect(m.container.querySelector('[aria-label="Get the app"]')).not.toBeNull();
    await m.act(() => m.installed.checkRelatedApps());
    expectNothingShown(m);
  });

  it("but storage that cannot be read reads as not installed, and not put away", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    const m = await load();
    m.render(both(m));
    expect(m.container.querySelector('[aria-label="Get the app"]')).not.toBeNull();
    expect(m.container.querySelector('[aria-label="Install the app"]')).not.toBeNull();
    vi.restoreAllMocks();
  });
});

describe("the card", () => {
  it("names the app by the school's short name from its manifest", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ name: "Lagoon View Academy", short_name: "Lagoon", icons: [] }))),
    );
    const m = await load();
    await (await import("@/lib/school-app")).applySchoolApp();
    m.render(m.React.createElement(m.offer.InstallOffer));
    expect(m.text()).toContain("To install Lagoon, use your browser's menu");
  });

  it("falls back to the school's name, as it shows under the icon, before the manifest is read", async () => {
    const m = await load();
    m.render(m.React.createElement(m.offer.InstallOffer));
    expect(m.text()).toContain("To install Lagoon, use your browser's menu");
  });

  it("offers Install with Chrome's prompt, and goes for good once accepted", async () => {
    const m = await load();
    m.prompt.captureInstallPrompt();
    m.render(both(m));
    const event = Object.assign(new Event("beforeinstallprompt", { cancelable: true }), {
      prompt: vi.fn(async () => {}),
      userChoice: Promise.resolve({ outcome: "accepted" as const }),
    });
    m.act(() => void window.dispatchEvent(event));
    await m.act(async () => m.button("Install app")!.click());
    expect(event.prompt).toHaveBeenCalledOnce();
    expectNothingShown(m);
    expect(localStorage.getItem("xvs.parent.installed")).toBe("1");
  });

  it("puts the Home card away with its X, and keeps the Profile row", async () => {
    const m = await load();
    m.render(both(m));
    m.act(() => m.container.querySelector<HTMLButtonElement>('[aria-label="Get the app"] button[aria-label="Close"]')!.click());
    expect(m.container.querySelector('[aria-label="Get the app"]')).toBeNull();
    expect(m.container.querySelector('[aria-label="Install the app"]')).not.toBeNull();
    // Still put away the next time the app opens.
    const again = await load();
    again.render(both(again));
    expect(again.container.querySelector('[aria-label="Get the app"]')).toBeNull();
  });

  it("shows Safari's three steps on an iPhone, with the notifications line", async () => {
    setBrowser(UA.iPhoneSafari, "iPhone");
    const m = await load();
    m.render(m.React.createElement(m.offer.InstallOffer));
    const steps = [...m.container.querySelectorAll("ol li")].map((li) => li.textContent);
    expect(steps).toEqual(["1Tap Share", "2Tap Add to Home Screen", "3Tap Add"]);
    expect(m.text()).toContain("Notifications only work in the installed app.");
    expect(m.button("Install app")).toBeUndefined();
  });

  it("sends Instagram's browser to Chrome with Copy link, and never shows the address as text", async () => {
    setBrowser(UA.instagramAndroid);
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    const { toast } = await import("sonner");
    const m = await load();
    m.render(m.React.createElement(m.offer.InstallOffer));
    expect(m.text()).toContain("To install the app, open this page in Chrome.");
    expect(m.text()).not.toContain(window.location.origin);
    await m.act(async () => m.button("Copy link")!.click());
    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/`);
    expect(toast.success).toHaveBeenCalledWith("Link copied");
  });

  it("sends Samsung Internet to Chrome in one tap, never through its own install", async () => {
    setBrowser(UA.samsungInternet);
    const m = await load();
    m.prompt.captureInstallPrompt();
    m.render(m.React.createElement(m.offer.InstallOffer));
    const event = Object.assign(new Event("beforeinstallprompt", { cancelable: true }), {
      prompt: vi.fn(async () => {}),
      userChoice: Promise.resolve({ outcome: "accepted" as const }),
    });
    m.act(() => void window.dispatchEvent(event));
    expect(m.text()).toContain("To install the app, open this page in Chrome.");
    expect(m.button("Install app")).toBeUndefined();
    const open = [...m.container.querySelectorAll("a")].find((a) => a.textContent?.includes("Open in Chrome"));
    expect(open?.getAttribute("href")).toBe(
      `intent://${window.location.host}/#Intent;scheme=${window.location.protocol.replace(":", "")};package=com.android.chrome;end`,
    );
    expect(m.button("Copy link")).toBeDefined();
  });

  it("offers Copy link but no Open in Chrome on an iPhone", async () => {
    setBrowser(UA.iPhoneChrome, "iPhone");
    const m = await load();
    m.render(m.React.createElement(m.offer.InstallOffer));
    expect(m.text()).toContain("open this page in Safari");
    expect(m.text()).not.toContain("Open in Chrome");
    expect(m.button("Copy link")).toBeDefined();
  });

  it("goes the moment the page opens as the installed app", async () => {
    const m = await load();
    m.render(both(m));
    expect(m.container.querySelector('[aria-label="Get the app"]')).not.toBeNull();
    m.act(() => openAs("standalone"));
    expectNothingShown(m);
  });
});

describe("the link that opens Chrome", () => {
  it("names Chrome's package and keeps the school's address and scheme", async () => {
    const { chromeIntentUrl } = await import("./install-offer");
    expect(chromeIntentUrl("https://lagoon-view.xvs-staging.codexng.com/parent/")).toBe(
      "intent://lagoon-view.xvs-staging.codexng.com/parent/#Intent;scheme=https;package=com.android.chrome;end",
    );
  });
});
