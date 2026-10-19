/**
 * What the parent chose about notifications on this browser.
 *
 * `on` once they turned push on, `off` once they turned it off, `not-now`
 * once they put the offer away. A parent with no choice yet is offered push
 * once on Home. The Profile setting lets them change it later.
 *
 * One parent per browser (unlike student-fe), so this is a single flag per
 * browser rather than a per-account map. Storage that cannot be read reads as
 * no choice, so the worst case is the offer shown twice.
 */
export type PushChoice = "on" | "off" | "not-now";

const STORAGE_KEY = "xvs.parent.push";

/** Shape kept in storage: a single choice for this browser. */
type Stored = { choice: PushChoice };

function readStored(): Stored | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const choice = (parsed as { choice?: unknown }).choice;
    if (choice === "on" || choice === "off" || choice === "not-now") {
      return { choice };
    }
    return null;
  } catch {
    return null;
  }
}

export function pushChoice(): PushChoice | null {
  return readStored()?.choice ?? null;
}

export function setPushChoice(choice: PushChoice | null): void {
  try {
    if (choice) localStorage.setItem(STORAGE_KEY, JSON.stringify({ choice }));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // A choice that cannot be kept is offered again next time.
  }
}
