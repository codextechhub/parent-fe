import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * The iOS switch between views of one screen (the Inbox's All, Notices and
 * Messages): a grey track with the chosen option on a white pill that slides
 * across to the one tapped. The options may be different widths, so the pill
 * is measured to the chosen button, again whenever the track changes size
 * (a count appears, the screen turns). Styles are in `screen.css`.
 */
export function Segmented<K extends string>({
  options,
  value,
  onChange,
  label,
  className,
  style,
}: {
  options: { key: K; label: ReactNode }[];
  value: K;
  onChange: (key: K) => void;
  /** Names the group to a screen reader ("Show"). */
  label: string;
  className?: string;
  style?: CSSProperties;
}) {
  const track = useRef<HTMLDivElement>(null);
  const [pill, setPill] = useState<{ left: number; width: number } | null>(null);
  const index = options.findIndex((option) => option.key === value);
  const keys = options.map((option) => option.key).join(" ");

  useLayoutEffect(() => {
    const element = track.current;
    if (!element) return;
    const measure = () => {
      const chosen = element.querySelectorAll<HTMLButtonElement>("button")[index];
      const next = chosen ? { left: chosen.offsetLeft, width: chosen.offsetWidth } : null;
      setPill((shown) => (shown && next && shown.left === next.left && shown.width === next.width ? shown : next));
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [index, keys]);

  return (
    <div ref={track} className={cn("segmented", className)} style={style} role="group" aria-label={label}>
      {pill && <span className="segmented-pill" style={{ transform: `translateX(${pill.left}px)`, width: pill.width }} aria-hidden="true" />}
      {options.map((option) => (
        <button key={option.key} type="button" aria-pressed={option.key === value} onClick={() => onChange(option.key)}>
          {option.label}
        </button>
      ))}
    </div>
  );
}
