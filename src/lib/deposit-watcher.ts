import type { Deposit } from "@/redux/services/portal-api";

/** How often the watcher asks whether a transfer has arrived. */
export const WATCH_EVERY_MS = 5_000;

/** How long without a tap, key press or scroll before the watcher stops asking. */
export const IDLE_AFTER_MS = 10 * 60_000;

/**
 * What the watcher needs from the place it runs: whether the screen is showing,
 * and a way to hear that the parent came back or touched it. The browser's
 * answers are in `browserEnvironment`; a store app supplies its own.
 */
export type WatchEnvironment = {
  visible(): boolean;
  /** Calls `listener` when the screen shows or hides. Returns the way to stop. */
  onVisibility(listener: (visible: boolean) => void): () => void;
  /** Calls `listener` on any sign the parent is using the screen. Returns the way to stop. */
  onInteraction(listener: () => void): () => void;
};

export type DepositListener = (deposits: Deposit[]) => void;

export type WatcherOptions = {
  fetchDeposits: (childId: number, since: string) => Promise<Deposit[]>;
  /** Called once for each transfer the first time it is seen booked. */
  onBooked: (deposit: Deposit, childId: number) => void;
  environment: WatchEnvironment;
  intervalMs?: number;
  idleMs?: number;
  now?: () => number;
};

type Entry = {
  since: string;
  listeners: Set<DepositListener>;
  deposits: Deposit[];
  booked: Set<string>;
  inFlight: boolean;
};

/**
 * Watches the transfers into every shown child's account, together.
 *
 * Screens register the children they show (`watch`); one timer then asks for
 * each child's transfers once per cycle, however many screens or cards want
 * them, so a parent of four children costs four requests every five seconds
 * and no more. The timer runs only while the screen is showing and the parent
 * has used it within the last ten minutes: hiding the screen stops it, coming
 * back asks at once, and a tap after a long idle starts it again.
 *
 * A transfer is "on its way" until the school books it, and `onBooked` fires
 * once when a booked one is first seen, which is when balances are read again.
 */
export class DepositWatcher {
  fetchDeposits: WatcherOptions["fetchDeposits"];
  onBooked: WatcherOptions["onBooked"];

  private readonly environment: WatchEnvironment;
  private readonly intervalMs: number;
  private readonly idleMs: number;
  private readonly now: () => number;
  private readonly entries = new Map<number, Entry>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private lastActive: number;
  private idle = false;
  private stopListening: Array<() => void> = [];

  constructor(options: WatcherOptions) {
    this.fetchDeposits = options.fetchDeposits;
    this.onBooked = options.onBooked;
    this.environment = options.environment;
    this.intervalMs = options.intervalMs ?? WATCH_EVERY_MS;
    this.idleMs = options.idleMs ?? IDLE_AFTER_MS;
    this.now = options.now ?? Date.now;
    this.lastActive = this.now();
  }

  /**
   * Starts watching one child's transfers since `since`. A child already being
   * watched keeps the time it was first watched from, so a transfer shown on
   * the screen does not vanish when a second card asks for the same child.
   * Returns the way to stop.
   */
  watch(childId: number, since: string, listener: DepositListener): () => void {
    let entry = this.entries.get(childId);
    if (!entry) {
      entry = { since, listeners: new Set(), deposits: [], booked: new Set(), inFlight: false };
      this.entries.set(childId, entry);
    }
    entry.listeners.add(listener);
    if (entry.deposits.length > 0) listener(entry.deposits);
    this.listen();
    this.settle();
    return () => {
      const current = this.entries.get(childId);
      if (!current) return;
      current.listeners.delete(listener);
      if (current.listeners.size > 0) return;
      this.entries.delete(childId);
      if (this.entries.size === 0) this.unlisten();
      this.settle();
    };
  }

  /** Asks about every watched child now, for example when a "Payment received" notice arrives. */
  refresh(): void {
    this.touch();
    void this.cycle();
  }

  /** Stops everything. */
  dispose(): void {
    this.entries.clear();
    this.unlisten();
    this.settle();
  }

  private listen(): void {
    if (this.stopListening.length > 0) return;
    this.stopListening = [
      this.environment.onVisibility((visible) => {
        if (!visible) return this.settle();
        this.touch();
        void this.cycle();
      }),
      this.environment.onInteraction(() => {
        const wasIdle = this.idle;
        this.lastActive = this.now();
        if (wasIdle) {
          this.idle = false;
          this.settle();
          void this.cycle();
        }
      }),
    ];
  }

  private unlisten(): void {
    for (const stop of this.stopListening) stop();
    this.stopListening = [];
  }

  private touch(): void {
    this.lastActive = this.now();
    this.idle = false;
    this.settle();
  }

  /** Runs the timer exactly when there is something to watch, on a showing screen, in use. */
  private settle(): void {
    const wanted = this.entries.size > 0 && !this.idle && this.environment.visible();
    if (wanted && !this.timer) {
      this.timer = setInterval(() => this.tick(), this.intervalMs);
    } else if (!wanted && this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private tick(): void {
    if (this.now() - this.lastActive >= this.idleMs) {
      this.idle = true;
      this.settle();
      return;
    }
    void this.cycle();
  }

  /** One request per watched child, none while the last for that child is still out. */
  private async cycle(): Promise<void> {
    await Promise.all(
      [...this.entries.entries()].map(async ([childId, entry]) => {
        if (entry.inFlight) return;
        entry.inFlight = true;
        try {
          const deposits = await this.fetchDeposits(childId, entry.since);
          if (this.entries.get(childId) !== entry) return;
          this.accept(childId, entry, deposits);
        } catch {
          // The next cycle asks again.
        } finally {
          entry.inFlight = false;
        }
      }),
    );
  }

  private accept(childId: number, entry: Entry, deposits: Deposit[]): void {
    const changed =
      deposits.length !== entry.deposits.length ||
      deposits.some((deposit, i) => {
        const before = entry.deposits[i];
        return !before || before.reference !== deposit.reference || before.status !== deposit.status;
      });
    entry.deposits = deposits;
    for (const deposit of deposits) {
      if (deposit.status !== "CONFIRMED" || entry.booked.has(deposit.reference)) continue;
      entry.booked.add(deposit.reference);
      this.onBooked(deposit, childId);
    }
    if (changed) for (const listener of entry.listeners) listener(deposits);
  }
}

/** The browser's answers: the page is showing, and the parent is touching it. */
export const browserEnvironment: WatchEnvironment = {
  visible: () => typeof document === "undefined" || document.visibilityState !== "hidden",
  onVisibility(listener) {
    if (typeof document === "undefined") return () => undefined;
    const changed = () => listener(document.visibilityState !== "hidden");
    const focused = () => listener(true);
    document.addEventListener("visibilitychange", changed);
    window.addEventListener("focus", focused);
    return () => {
      document.removeEventListener("visibilitychange", changed);
      window.removeEventListener("focus", focused);
    };
  },
  onInteraction(listener) {
    if (typeof window === "undefined") return () => undefined;
    const events = ["pointerdown", "keydown", "touchstart", "wheel", "scroll"] as const;
    for (const name of events) window.addEventListener(name, listener, { passive: true, capture: true });
    return () => {
      for (const name of events) window.removeEventListener(name, listener, { capture: true });
    };
  },
};
