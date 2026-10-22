import { useEffect, useSyncExternalStore, type RefObject } from "react";

/**
 * The width, in px, from which Messages shows its list and an open
 * conversation side by side. `messages.css` switches its layout at the same
 * number; below it the two are separate screens.
 */
export const TWO_PANES_MIN_PX = 900;

/** How much shorter the visible screen has to be than the window before it counts as a keyboard. */
const KEYBOARD_MIN_PX = 120;

const NARROW = `(max-width: ${TWO_PANES_MIN_PX - 1}px)`;

function subscribeNarrow(notify: () => void): () => void {
  if (typeof window.matchMedia !== "function") return () => {};
  const query = window.matchMedia(NARROW);
  query.addEventListener("change", notify);
  return () => query.removeEventListener("change", notify);
}

/** True below `TWO_PANES_MIN_PX`: a phone, or a tablet held upright. */
export function useNarrowScreen(): boolean {
  return useSyncExternalStore(
    subscribeNarrow,
    () => typeof window.matchMedia === "function" && window.matchMedia(NARROW).matches,
    () => false,
  );
}

/**
 * Sizes `ref`'s element to the part of the screen the parent can see.
 *
 * While `active`, the element's `--vv-height` and `--vv-top` follow
 * `window.visualViewport`, which shrinks when a phone keyboard opens even
 * though the window does not, so a composer pinned to the element's bottom
 * rides above the keyboard instead of under it. `data-keyboard` is set while
 * the keyboard is up, so the home-bar inset can be dropped. iOS also scrolls
 * the window to reveal a focused field; the element is fixed, so that scroll
 * is undone. A pinched-in page (scale above 1) is left alone, since its
 * visible area is not the keyboard's doing. Without `visualViewport` the
 * element keeps its `100dvh` fallback.
 */
export function useVisibleViewport(ref: RefObject<HTMLElement | null>, active: boolean): void {
  useEffect(() => {
    const element = ref.current;
    const viewport = window.visualViewport;
    if (!active || !element || !viewport) return;

    const clear = () => {
      element.style.removeProperty("--vv-height");
      element.style.removeProperty("--vv-top");
      element.removeAttribute("data-keyboard");
    };
    const follow = () => {
      if (viewport.scale > 1.01) {
        clear();
        return;
      }
      element.style.setProperty("--vv-height", `${viewport.height}px`);
      element.style.setProperty("--vv-top", `${viewport.offsetTop}px`);
      element.toggleAttribute("data-keyboard", window.innerHeight - viewport.height > KEYBOARD_MIN_PX);
      if (window.scrollY !== 0) window.scrollTo(0, 0);
    };

    follow();
    viewport.addEventListener("resize", follow);
    viewport.addEventListener("scroll", follow);
    return () => {
      viewport.removeEventListener("resize", follow);
      viewport.removeEventListener("scroll", follow);
      clear();
    };
  }, [ref, active]);
}
