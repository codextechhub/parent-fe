import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { keepCheckingForUpdates, UPDATE_CHECK_EVERY_MS, UPDATE_CHECK_GAP_MS } from "./update-check";

/**
 * Mrs Okafor opens the installed app in the morning and leaves it in the
 * background. A new version is released at noon. The app asks again when
 * they come back to it and every hour while it is open, so the update bar
 * appears without them closing the app first.
 */
describe("keepCheckingForUpdates", () => {
  let clock = 0;
  const now = () => clock;
  let stop: () => void = () => {};
  let visibility: DocumentVisibilityState = "visible";
  let online = true;

  const registration = () => ({ update: vi.fn(async () => undefined), installing: null as ServiceWorker | null });

  const returnToApp = () => {
    visibility = "visible";
    document.dispatchEvent(new Event("visibilitychange"));
  };

  beforeEach(() => {
    vi.useFakeTimers();
    clock = 0;
    visibility = "visible";
    online = true;
    vi.spyOn(document, "visibilityState", "get").mockImplementation(() => visibility);
    vi.spyOn(navigator, "onLine", "get").mockImplementation(() => online);
  });

  afterEach(() => {
    stop();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("asks every hour while the app stays open", () => {
    const reg = registration();
    stop = keepCheckingForUpdates(reg, now);
    clock += UPDATE_CHECK_EVERY_MS;
    vi.advanceTimersByTime(UPDATE_CHECK_EVERY_MS);
    expect(reg.update).toHaveBeenCalledTimes(1);
    clock += UPDATE_CHECK_EVERY_MS;
    vi.advanceTimersByTime(UPDATE_CHECK_EVERY_MS);
    expect(reg.update).toHaveBeenCalledTimes(2);
  });

  it("asks when the app is returned to after a while away", () => {
    const reg = registration();
    stop = keepCheckingForUpdates(reg, now);
    visibility = "hidden";
    document.dispatchEvent(new Event("visibilitychange"));
    clock += 5 * 60 * 1000;
    returnToApp();
    expect(reg.update).toHaveBeenCalledTimes(1);
  });

  it("does not ask again on a return within a minute of the last check", () => {
    const reg = registration();
    stop = keepCheckingForUpdates(reg, now);
    clock += UPDATE_CHECK_GAP_MS - 1;
    returnToApp();
    expect(reg.update).not.toHaveBeenCalled();
  });

  it("does not ask while offline or while a new version is already downloading", () => {
    const reg = registration();
    stop = keepCheckingForUpdates(reg, now);
    online = false;
    clock += 10 * 60 * 1000;
    returnToApp();
    expect(reg.update).not.toHaveBeenCalled();
    online = true;
    reg.installing = {} as ServiceWorker;
    returnToApp();
    expect(reg.update).not.toHaveBeenCalled();
  });

  it("keeps checking after the server could not be reached", async () => {
    const reg = registration();
    reg.update.mockRejectedValueOnce(new Error("offline"));
    stop = keepCheckingForUpdates(reg, now);
    clock += 10 * 60 * 1000;
    returnToApp();
    await Promise.resolve();
    clock += 10 * 60 * 1000;
    returnToApp();
    expect(reg.update).toHaveBeenCalledTimes(2);
  });

  it("stops asking once stopped", () => {
    const reg = registration();
    stop = keepCheckingForUpdates(reg, now);
    stop();
    clock += UPDATE_CHECK_EVERY_MS;
    vi.advanceTimersByTime(UPDATE_CHECK_EVERY_MS);
    returnToApp();
    expect(reg.update).not.toHaveBeenCalled();
  });
});
