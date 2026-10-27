import { useLayoutEffect, useRef, type CSSProperties } from "react";

import { ChildAvatar } from "@/components/child-avatar";
import { childHues, solidOf } from "@/lib/name-hue";
import { cn } from "@/lib/utils";
import { useAppSelector } from "@/redux/hooks";

import { useActiveChild, useChooseChild } from "./child-switcher";
import "./child-picker.css";

/**
 * The children as chips under a per-child screen's title (designs 1d to 1f),
 * so a parent always sees whose record it is and can move to another child
 * in one tap. The child showing is white and ringed in their colour; the
 * others are faint. Choosing goes through `useChooseChild`, as the switcher
 * does, so every screen follows. The row scrolls sideways when the children
 * do not fit, and is brought round to the child showing whenever it is
 * drawn, so a fourth child chosen is never off the edge. A parent with one
 * child sees that child alone. The column
 * it sits in needs a `minmax(0, 1fr)` track, or the row widens the page
 * instead of scrolling.
 */
export function ChildPicker() {
  const children = useAppSelector((s) => s.auth.me?.children ?? []);
  const active = useActiveChild();
  const choose = useChooseChild();
  const hues = childHues(children.map((child) => child.id));
  const row = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const chip = row.current?.querySelector<HTMLElement>(".is-showing");
    // Centred in the row by scrolling the row alone; scrollIntoView would move the page too.
    if (row.current && chip) row.current.scrollLeft = chip.offsetLeft - (row.current.clientWidth - chip.offsetWidth) / 2;
  }, [active?.id]);
  if (children.length === 0) return null;
  return (
    <div ref={row} className="child-picker" role="group" aria-label="Whose record">
      {children.map((child) => {
        const showing = child.id === active?.id;
        const hue = hues.get(child.id);
        return (
          <button
            key={child.id}
            type="button"
            className={cn("child-picker-chip", showing && "is-showing")}
            aria-pressed={showing}
            style={hue === undefined ? undefined : ({ "--child-ring": solidOf(hue) } as CSSProperties)}
            onClick={() => !showing && choose(child.id)}
          >
            <ChildAvatar name={child.full_name} childId={child.id} size={34} />
            <span className="child-picker-text">
              <strong>{child.first_name}</strong>
              {child.class_name && <small>{child.class_name}</small>}
            </span>
          </button>
        );
      })}
    </div>
  );
}
