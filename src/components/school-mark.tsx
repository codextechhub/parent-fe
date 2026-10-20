import { useId, useState } from "react";

import { useShownImage } from "@/lib/shown-image";
import { cn } from "@/lib/utils";
import { INK, PEN, WORDMARK_RATIO, WORDMARK_VIEWBOX } from "./xvs-wordmark";

/**
 * A school's crest, which turns over on hover and writes "XVS" underneath it,
 * then turns back when the pointer leaves. The sidebar's mark and the sign-in
 * page's are the same object at two sizes.
 *
 * The back face is the product's wordmark, not the school's name. A school's
 * name is arbitrary text - "Holy Cross College" would set happily at this size,
 * "Government Comprehensive Secondary School, Ikeja" at no size that is still
 * readable - so a face carrying it needs a rule for shrinking and replacing it,
 * and every school past the rule is shown something that is not its name anyway.
 * Three fixed letters need no rule, and they can be drawn rather than set.
 *
 * Everything here is CSS (see `.school-mark` in index.css): the flip is a
 * transition on `transform`, and the write-on is a transition on each pen
 * stroke's dash offset. Transitions rather than keyframes on purpose - they
 * reverse from wherever they had got to, so flicking the pointer across the mark
 * never leaves it stranded mid-spin, and the letters un-write in the reverse
 * order they were written. No JS, no timers, no state.
 *
 * `logo` may be the crest the API stores, which is served only to a signed-in
 * reader: it is fetched with the app's token (`useShownImage`), and the space
 * is held empty until it arrives, so the XVS crest never flashes in its place.
 */

/** Height of the crest, in px, where the caller names none. */
const DEFAULT_SIZE = 30;

/**
 * The wordmark's height, as a multiple of the crest's.
 *
 * A little shorter than the crest, so the calligraphy does not tower over the
 * crest. The box is sized from the wordmark, which is the wider of the two
 * faces, so the row cannot shift as the card turns.
 */
const WORDMARK_SCALE = 0.8;

/**
 * The XVS logo, used when a school has no crest of its own: the full-colour
 * crest on a light surface, the white crest on a dark one. Never the CodeX
 * mark, which belongs to the console.
 *
 * Under this app's own base path: school-fe serves the same origin, so a
 * root-relative path would load school-fe's copy of the file instead.
 */
const FALLBACK_SRC = {
  blue: `${import.meta.env.BASE_URL}svg/xvs-logo.svg`,
  white: `${import.meta.env.BASE_URL}svg/xvs-logo-white.svg`,
} as const;

export function SchoolMark({
  logo,
  /**
   * Names the mark to a screen reader. Empty where an enclosing link already
   * carries the name, which is the sidebar's case: a repeat there makes a
   * screen reader say the school twice.
   */
  alt = "",
  size = DEFAULT_SIZE,
  /**
   * Turn the flip off where there is no room for the wordmark - the collapsed
   * icon rail being the case that matters. The crest still renders.
   */
  animate = true,
  surface = "other",
  className,
}: {
  logo?: string | null;
  alt?: string;
  size?: number;
  animate?: boolean;
  surface?: "blue" | "other";
  className?: string;
}) {
  // Masks are referenced by id, and the mark renders more than once per page.
  const maskId = useId();
  // A crest can be missing two ways: never given to us, or given and then
  // unfetchable - a file gone from storage, or a public endpoint answering 404
  // for a slug that is not a school. Both land on the product's own mark, so
  // neither leaves a blank space where a badge belongs.
  const [failed, setFailed] = useState(false);
  const shown = useShownImage(logo);
  const fallback = surface === "blue" ? FALLBACK_SRC.white : FALLBACK_SRC.blue;
  const src = failed || !shown.src ? fallback : shown.src;

  // The school's crest is on its way: hold its space rather than flash the XVS one.
  if (shown.pending && !failed) {
    return <span aria-hidden="true" className={cn("inline-block shrink-0", className)} style={{ height: size, width: size }} />;
  }

  const crest = (className?: string) => (
    <img
      src={src}
      alt={alt}
      className={cn("w-auto", className)}
      style={{ height: size }}
      onError={() => setFailed(true)}
    />
  );

  if (!animate) return crest(className);

  const wordmarkHeight = size * WORDMARK_SCALE;

  return (
    <span
      className={cn(
        "school-mark",
        surface === "blue" ? "text-white" : "text-primary",
        className,
      )}
      style={{ height: size, width: wordmarkHeight * WORDMARK_RATIO }}
    >
      <span className="school-mark__card">
        <span className="school-mark__face">{crest()}</span>

        <span className="school-mark__face school-mark__face--back">
          <svg
            viewBox={WORDMARK_VIEWBOX}
            className="w-full"
            style={{ height: wordmarkHeight }}
            aria-hidden="true"
            focusable="false"
          >
            <mask
              id={maskId}
              maskUnits="userSpaceOnUse"
              x="-20"
              y="-20"
              width="230"
              height="140"
            >
              {PEN.map((stroke, i) => (
                <path
                  key={i}
                  className="school-mark__pen"
                  d={stroke.d}
                  pathLength={1}
                  style={
                    // Each stroke's slice of the write-on (as fractions of the
                    // shared duration) and its hidden dash offset. Read by the
                    // transition timings in the CSS.
                    {
                      "--s": stroke.s,
                      "--l": stroke.l,
                      "--o": stroke.o,
                    } as React.CSSProperties
                  }
                />
              ))}
            </mask>
            <path d={INK} fill="currentColor" mask={`url(#${maskId})`} />
          </svg>
        </span>
      </span>
    </span>
  );
}
