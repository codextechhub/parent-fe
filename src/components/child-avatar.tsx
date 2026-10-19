import { cn } from "@/lib/utils";

/**
 * A child's photo, or their initials on the brand colour where there is none.
 *
 * Phase 2 shows initials. The authenticated photo URL on `me.children[].photo_url`
 * carries a token the parent can read, so a plain `<img>` would work; it is
 * deferred to Phase 4 along with the per-child screens that make the choice
 * meaningful.
 */
export function ChildAvatar({
  name,
  size = 32,
  className,
}: {
  name: string;
  size?: number;
  className?: string;
}) {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");
  const style = { width: size, height: size, fontSize: Math.round(size * 0.38) };
  return (
    <span
      aria-hidden="true"
      style={style}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full bg-primary font-semibold text-primary-foreground",
        className,
      )}
    >
      {initials}
    </span>
  );
}
