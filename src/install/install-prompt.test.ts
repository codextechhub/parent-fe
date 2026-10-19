/**
 * Chrome's install prompt on Ebere's mother's Android phone.
 *
 * Chrome fires `beforeinstallprompt` as the app opens, before the screen has
 * drawn. The app keeps it, so the card's Install button can show it later;
 * accepted, or installed from Chrome's own menu, the install is recorded and
 * announced once.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

type PromptModule = typeof import("./install-prompt");
type InstalledModule = typeof import("./installed");

let prompt: PromptModule;
let installed: InstalledModule;

/** A fresh copy of both modules, listening, as `main.tsx` leaves them. */
beforeEach(async () => {
  localStorage.clear();
  vi.resetModules();
  installed = await import("./installed");
  prompt = await import("./install-prompt");
  prompt.captureInstallPrompt();
});

function chromeOffers(outcome: "accepted" | "dismissed") {
  const event = Object.assign(new Event("beforeinstallprompt", { cancelable: true }), {
    prompt: vi.fn(async () => {}),
    userChoice: Promise.resolve({ outcome, platform: "web" }),
  });
  window.dispatchEvent(event);
  return event;
}

describe("keeping the prompt", () => {
  it("stops Chrome's own banner and keeps the event for the card", () => {
    const changed = vi.fn();
    prompt.subscribePrompt(changed);
    const event = chromeOffers("accepted");
    expect(event.defaultPrevented).toBe(true);
    expect(prompt.promptState()).toBe("ready");
    expect(changed).toHaveBeenCalled();
  });

  it("has nothing to show before Chrome offers", async () => {
    expect(prompt.promptState()).toBe("none");
    expect(await prompt.promptInstall()).toBe("unavailable");
  });
});

describe("showing it", () => {
  it("shows Chrome's prompt and records an accepted install, announced once", async () => {
    const announced = vi.fn();
    prompt.onInstalled(announced);
    const event = chromeOffers("accepted");
    expect(await prompt.promptInstall()).toBe("accepted");
    expect(event.prompt).toHaveBeenCalledOnce();
    expect(localStorage.getItem("xvs.parent.installed")).toBe("1");
    expect(installed.isInstalled()).toBe(true);
    // Chrome follows an accepted prompt with appinstalled: still one toast.
    window.dispatchEvent(new Event("appinstalled"));
    expect(announced).toHaveBeenCalledOnce();
    expect(prompt.promptState()).toBe("none");
  });

  it("turns to the browser's menu once the prompt is turned down", async () => {
    chromeOffers("dismissed");
    expect(await prompt.promptInstall()).toBe("dismissed");
    expect(prompt.promptState()).toBe("dismissed");
    expect(installed.isInstalled()).toBe(false);
    expect(await prompt.promptInstall()).toBe("unavailable");
  });
});

describe("installed from the browser's own menu", () => {
  it("records the install on appinstalled and lets the kept prompt go", async () => {
    const announced = vi.fn();
    prompt.onInstalled(announced);
    chromeOffers("accepted");
    window.dispatchEvent(new Event("appinstalled"));
    expect(installed.isInstalled()).toBe(true);
    expect(announced).toHaveBeenCalledOnce();
    expect(prompt.promptState()).toBe("none");
    expect(await prompt.promptInstall()).toBe("unavailable");
  });
});
