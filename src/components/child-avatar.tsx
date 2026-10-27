import { useState } from "react";

import { childHues, solidOf } from "@/lib/name-hue";
import { useShownImage } from "@/lib/shown-image";
import { cn } from "@/lib/utils";
import { useAppSelector } from "@/redux/hooks";

/** The hue the child with this id wears everywhere, or null for a child not on the parent's list. */
export function useChildHue(childId: number | undefined): number | null {
  const ids = useAppSelector((s) => s.auth.me?.children.map((child) => child.id) ?? []);
  return childId === undefined ? null : (childHues(ids).get(childId) ?? null);
}

/**
 * A child's photo, or their initials on the child's own colour (`useChildHue`)
 * where there is none or it cannot be shown.
 *
 * The photo is the one `me/` carries for the child named by `childId`, so
 * every screen shows the same face whatever payload it was drawn from. It is
 * served only to a signed-in reader, so it is fetched with the parent's token
 * (`useShownImage`) rather than linked.
 */
export function ChildAvatar({
  name,
  childId,
  size = 32,
  className,
}: {
  name: string;
  childId?: number;
  size?: number;
  className?: string;
}) {
  const photo = useAppSelector(
    (s) => s.auth.me?.children.find((child) => child.id === childId)?.photo_url ?? "",
  );
  const shown = useShownImage(photo);
  const hue = useChildHue(childId);
  const [failed, setFailed] = useState(false);
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");
  const style = { width: size, height: size };

  if (shown.src && !failed) {
    return (
      <img
        src={shown.src}
        alt=""
        style={style}
        onError={() => setFailed(true)}
        className={cn("shrink-0 rounded-full object-cover", className)}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      style={{ ...style, fontSize: Math.round(size * 0.36), ...(hue === null ? {} : { background: solidOf(hue) }) }}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full bg-primary font-semibold tracking-[-.01em] text-primary-foreground",
        className,
      )}
    >
      {initials}
    </span>
  );
}
