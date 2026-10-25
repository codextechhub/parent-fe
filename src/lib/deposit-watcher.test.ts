/**
 * The deposit watcher against a fake clock and a fake screen.
 *
 * Patricia has Tobi and Somto on the Fees screen, each with their own account.
 * One timer asks about both children every five seconds, no more than one
 * request each; it stops when the screen is hidden or left alone for ten
 * minutes, and asks at once when she is back.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Deposit } from "@/redux/services/portal-api";

import { DepositWatcher, IDLE_AFTER_MS, WATCH_EVERY_MS, type WatchEnvironment } from "./deposit-watcher";

function deposit(reference: string, status: "PENDING" | "CONFIRMED", amount = 250_000): Deposit {
  return {
    reference,
    amount,
    status,
    status_label: status === "CONFIRMED" ? "Received" : "Arriving",
    received_at: "2026-10-25T10:00:00Z",
    payment_ref: status === "CONFIRMED" ? 77 : null,
    has_receipt: status === "CONFIRMED",
  };
}

function fakeScreen() {
  let visible = true;
  const visibility = new Set<(visible: boolean) => void>();
  const interaction = new Set<() => void>();
  const environment: WatchEnvironment = {
    visible: () => visible,
    onVisibility: (listener) => {
      visibility.add(listener);
      return () => visibility.delete(listener);
    },
    onInteraction: (listener) => {
      interaction.add(listener);
      return () => interaction.delete(listener);
    },
  };
  return {
    environment,
    hide() {
      visible = false;
      visibility.forEach((listener) => listener(false));
    },
    show() {
      visible = true;
      visibility.forEach((listener) => listener(true));
    },
    touch() {
      interaction.forEach((listener) => listener());
    },
    listening: () => visibility.size + interaction.size,
  };
}

function setup() {
  const screen = fakeScreen();
  const answers = new Map<number, Deposit[]>();
  const fetchDeposits = vi.fn(async (childId: number, _since: string) => answers.get(childId) ?? []);
  const onBooked = vi.fn();
  const watcher = new DepositWatcher({ fetchDeposits, onBooked, environment: screen.environment });
  return { screen, answers, fetchDeposits, onBooked, watcher };
}

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("DepositWatcher", () => {
  it("asks once per child per cycle, however many listeners want the child", async () => {
    const { watcher, fetchDeposits } = setup();
    watcher.watch(11, "t0", () => undefined);
    watcher.watch(11, "t0", () => undefined);
    watcher.watch(22, "t0", () => undefined);
    expect(fetchDeposits).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(WATCH_EVERY_MS);
    expect(fetchDeposits.mock.calls.map(([id]) => id).sort()).toEqual([11, 22]);

    await vi.advanceTimersByTimeAsync(WATCH_EVERY_MS);
    expect(fetchDeposits).toHaveBeenCalledTimes(4);
    watcher.dispose();
  });

  it("shows a transfer on its way, then received, and tells the app once when it is booked", async () => {
    const { watcher, answers, onBooked } = setup();
    const seen: Deposit[][] = [];
    watcher.watch(11, "t0", (deposits) => seen.push(deposits));

    answers.set(11, [deposit("DEP-1", "PENDING")]);
    await vi.advanceTimersByTimeAsync(WATCH_EVERY_MS);
    expect(seen.at(-1)?.[0].status).toBe("PENDING");
    expect(onBooked).not.toHaveBeenCalled();

    answers.set(11, [deposit("DEP-1", "CONFIRMED")]);
    await vi.advanceTimersByTimeAsync(WATCH_EVERY_MS);
    expect(seen.at(-1)?.[0].status).toBe("CONFIRMED");
    expect(onBooked).toHaveBeenCalledTimes(1);
    expect(onBooked.mock.calls[0][1]).toBe(11);

    await vi.advanceTimersByTimeAsync(WATCH_EVERY_MS * 3);
    expect(onBooked).toHaveBeenCalledTimes(1);
    watcher.dispose();
  });

  it("does not repeat an answer that has not changed", async () => {
    const { watcher, answers } = setup();
    const listener = vi.fn();
    answers.set(11, [deposit("DEP-1", "PENDING")]);
    watcher.watch(11, "t0", listener);
    await vi.advanceTimersByTimeAsync(WATCH_EVERY_MS * 3);
    expect(listener).toHaveBeenCalledTimes(1);
    watcher.dispose();
  });

  it("keeps what a screen already shows when a second card watches the same child", async () => {
    const { watcher, answers } = setup();
    answers.set(11, [deposit("DEP-1", "PENDING")]);
    watcher.watch(11, "t0", () => undefined);
    await vi.advanceTimersByTimeAsync(WATCH_EVERY_MS);
    const late = vi.fn();
    watcher.watch(11, "later", late);
    expect(late).toHaveBeenCalledWith([expect.objectContaining({ reference: "DEP-1" })]);
    watcher.dispose();
  });

  it("stops asking while the screen is hidden and asks at once when it is back", async () => {
    const { watcher, screen, fetchDeposits } = setup();
    watcher.watch(11, "t0", () => undefined);
    await vi.advanceTimersByTimeAsync(WATCH_EVERY_MS);
    expect(fetchDeposits).toHaveBeenCalledTimes(1);

    screen.hide();
    await vi.advanceTimersByTimeAsync(WATCH_EVERY_MS * 6);
    expect(fetchDeposits).toHaveBeenCalledTimes(1);

    screen.show();
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchDeposits).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(WATCH_EVERY_MS);
    expect(fetchDeposits).toHaveBeenCalledTimes(3);
    watcher.dispose();
  });

  it("stops after ten idle minutes and starts again on the next touch", async () => {
    const { watcher, screen, fetchDeposits } = setup();
    watcher.watch(11, "t0", () => undefined);
    await vi.advanceTimersByTimeAsync(IDLE_AFTER_MS + WATCH_EVERY_MS);
    const before = fetchDeposits.mock.calls.length;
    await vi.advanceTimersByTimeAsync(WATCH_EVERY_MS * 12);
    expect(fetchDeposits).toHaveBeenCalledTimes(before);

    screen.touch();
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchDeposits).toHaveBeenCalledTimes(before + 1);
    await vi.advanceTimersByTimeAsync(WATCH_EVERY_MS);
    expect(fetchDeposits).toHaveBeenCalledTimes(before + 2);
    watcher.dispose();
  });

  it("keeps asking while the parent keeps using the screen", async () => {
    const { watcher, screen, fetchDeposits } = setup();
    watcher.watch(11, "t0", () => undefined);
    for (let minute = 0; minute < 15; minute += 1) {
      await vi.advanceTimersByTimeAsync(60_000);
      screen.touch();
    }
    expect(fetchDeposits.mock.calls.length).toBeGreaterThan(150);
    watcher.dispose();
  });

  it("asks every child now when told a payment was received", async () => {
    const { watcher, fetchDeposits } = setup();
    watcher.watch(11, "t0", () => undefined);
    watcher.watch(22, "t0", () => undefined);
    watcher.refresh();
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchDeposits).toHaveBeenCalledTimes(2);
    watcher.dispose();
  });

  it("does not start a second request for a child while the last is still out", async () => {
    const { watcher, screen } = setup();
    let release: (value: Deposit[]) => void = () => undefined;
    const slow = vi.fn(() => new Promise<Deposit[]>((resolve) => { release = resolve; }));
    watcher.fetchDeposits = slow;
    watcher.watch(11, "t0", () => undefined);
    await vi.advanceTimersByTimeAsync(WATCH_EVERY_MS * 3);
    expect(slow).toHaveBeenCalledTimes(1);
    release([]);
    await vi.advanceTimersByTimeAsync(WATCH_EVERY_MS);
    expect(slow).toHaveBeenCalledTimes(2);
    expect(screen.listening()).toBeGreaterThan(0);
    watcher.dispose();
  });

  it("lets go of the screen and the timer when the last child is no longer watched", async () => {
    const { watcher, screen, fetchDeposits } = setup();
    const stop = watcher.watch(11, "t0", () => undefined);
    expect(screen.listening()).toBe(2);
    stop();
    expect(screen.listening()).toBe(0);
    await vi.advanceTimersByTimeAsync(WATCH_EVERY_MS * 4);
    expect(fetchDeposits).not.toHaveBeenCalled();
  });

  it("carries on after a failed request", async () => {
    const { watcher, answers, fetchDeposits } = setup();
    fetchDeposits.mockRejectedValueOnce(new Error("offline"));
    const listener = vi.fn();
    watcher.watch(11, "t0", listener);
    await vi.advanceTimersByTimeAsync(WATCH_EVERY_MS);
    answers.set(11, [deposit("DEP-1", "PENDING")]);
    await vi.advanceTimersByTimeAsync(WATCH_EVERY_MS);
    expect(listener).toHaveBeenCalledTimes(1);
    watcher.dispose();
  });
});
