import { ChildAvatar } from "@/components/child-avatar";
import { useActiveChild } from "@/components/session/child-switcher";
import { useAppSelector } from "@/redux/hooks";

import "./child-strip.css";

/**
 * The slim strip at the top of every per-child screen.
 *
 * A parent scrolling a long screen (Attendance's calendar, a term's
 * subject list) can lose track of whose record they are reading. The
 * strip names the showing child with their class and branch at the top
 * of the viewport. It reads `useActiveChild()` so switching child from
 * the header refetches the screen AND rewrites the strip in step.
 */
export function ChildStrip() {
  const child = useActiveChild();
  const showBranch = useAppSelector((s) => s.auth.me?.show_branch ?? false);
  if (!child) return null;
  const meta = [child.class_name, showBranch ? child.branch?.name : null]
    .filter(Boolean)
    .join(" · ");
  return (
    <div className="child-strip" aria-label={`Showing ${child.full_name}'s record`}>
      <ChildAvatar name={child.full_name} size={32} />
      <div>
        <strong>{child.first_name}</strong>
        {meta && <span>{meta}</span>}
      </div>
    </div>
  );
}
