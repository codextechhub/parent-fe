/**
 * The hues the redesign gives people and subjects: ten, evenly round the
 * wheel from the brand blue, so two names that differ never land on near
 * neighbours by accident of the list. Each name keeps its hue wherever it
 * appears, so a subject is the same colour on Home, Timetable and Results.
 */
const HUES = [255, 291, 327, 3, 39, 75, 111, 147, 183, 219] as const;

/** A name's hue, the same every time for the same name. */
export function hueFor(name: string): number {
  let hash = 0;
  for (const char of name.trim().toLowerCase()) hash = (hash * 31 + (char.codePointAt(0) ?? 0)) >>> 0;
  return HUES[hash % HUES.length];
}

/** The soft background and the strong text colour for a name, as a style. */
export function toneFor(name: string): { background: string; color: string } {
  return toneOf(hueFor(name));
}

/** The bright dot or bar for a name: a subject's colour in a timetable list. */
export function dotFor(name: string): string {
  return dotOf(hueFor(name));
}

/**
 * The order hues are handed to a class's subjects: each a long way round the
 * wheel from the one before, so neighbours in the list never look alike.
 */
const SPREAD = [255, 39, 147, 327, 75, 183, 3, 111, 219, 291] as const;

/**
 * A hue for each of a class's subjects, all different while there are ten or
 * fewer. The subjects are taken in alphabetical order, so the same class gets
 * the same colours on every screen and every phone. A name hashed on its own
 * (`hueFor`) can land on the same hue as another; this cannot.
 */
export function subjectHues(names: Iterable<string>): Map<string, number> {
  const unique = [...new Set([...names].map((name) => name.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  return new Map(unique.map((name, index) => [name.toLowerCase(), SPREAD[index % SPREAD.length]]));
}

/** The soft background and strong text for a hue, as a style. */
export function toneOf(hue: number): { background: string; color: string } {
  return { background: `oklch(0.95 0.035 ${hue})`, color: `oklch(0.45 0.11 ${hue})` };
}

/** The bright dot or bar colour for a hue. */
export function dotOf(hue: number): string {
  return `oklch(0.64 0.14 ${hue})`;
}
