import { useState } from "react";

import { useShownImage } from "@/lib/shown-image";
import { cn } from "@/lib/utils";
import { useAppSelector } from "@/redux/hooks";

/**
 * A child's photo, or their initials on the brand colour where there is none
 * or it cannot be shown.
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
      style={{ ...style, fontSize: Math.round(size * 0.38) }}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full bg-primary font-semibold text-primary-foreground",
        className,
      )}
    >
      {initials}
    </span>
  );
}
