import { cn } from "@/lib/utils";

/** A person's initials on a tinted disc: the parent's staff have no photographs here. */
export function Initials({ name, className }: { name: string; className?: string }) {
  const letters = name
    .replace(/^(mr|mrs|ms|miss|dr|prof|engr|chief)\.?\s+/i, "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");
  return (
    <span className={cn("msg-avatar", className)} aria-hidden="true">
      {letters || "?"}
    </span>
  );
}
