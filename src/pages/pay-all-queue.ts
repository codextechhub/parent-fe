import type { PayAllStep } from "@/redux/services/portal-api";

/** Where the queue sits across the trip to the gateway and back. */
const KEY = "parent-fe:pay-all";

export type PayAllQueue = {
  steps: PayAllStep[];
  /** Which step is next to start (0-based). */
  index: number;
};

type Guarded<T> = T | null;

function readStorage(): Guarded<Storage> {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

/**
 * The queue currently in flight, or null when there is none.
 *
 * sessionStorage can throw in a locked-down browser; a null here means
 * "no queue is in flight", which the Pay-all route treats as fresh.
 */
export function readPayAllQueue(): PayAllQueue | null {
  const storage = readStorage();
  if (!storage) return null;
  try {
    const raw = storage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PayAllQueue;
    if (!Array.isArray(parsed.steps) || typeof parsed.index !== "number") return null;
    if (parsed.index >= parsed.steps.length) {
      storage.removeItem(KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function savePayAllQueue(queue: PayAllQueue): void {
  const storage = readStorage();
  if (!storage) return;
  try {
    storage.setItem(KEY, JSON.stringify(queue));
  } catch {
    // Nothing to do; the parent can still pay each invoice directly.
  }
}

/** Move to the next step. Returns the step just entered, or null if done. */
export function advancePayAllQueue(): PayAllStep | null {
  const queue = readPayAllQueue();
  if (!queue) return null;
  const next = queue.index + 1;
  if (next >= queue.steps.length) {
    clearPayAllQueue();
    return null;
  }
  const updated: PayAllQueue = { steps: queue.steps, index: next };
  savePayAllQueue(updated);
  return updated.steps[next];
}

export function clearPayAllQueue(): void {
  const storage = readStorage();
  if (!storage) return;
  try {
    storage.removeItem(KEY);
  } catch {
    // No-op.
  }
}
