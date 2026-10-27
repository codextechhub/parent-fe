import { useEffect, useState, type CSSProperties } from "react";
import { Check, ChevronRight, LogOut, UserRound, X } from "lucide-react";
import { Dialog } from "radix-ui";
import { useLocation, useNavigate, useSearchParams } from "react-router";

import { ChildAvatar, useChildHue } from "@/components/child-avatar";
import { solidOf } from "@/lib/name-hue";
import { itemFor } from "@/components/shell/nav";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import { childFocused, type Child } from "@/redux/features/auth-slice";
import { useLogoutMutation } from "@/redux/services/portal-api";

import "./child-switcher.css";

/** The query key the active child's id is carried in. */
export const CHILD_PARAM = "child";

/**
 * The child in focus: the one the address names (a link from a child's card,
 * a notification), else the one the parent last chose in the switcher on any
 * screen, else the first child, else null.
 */
export function useActiveChild(): Child | null {
  const children = useAppSelector((s) => s.auth.me?.children ?? []);
  const focused = useAppSelector((s) => s.auth.focusChildId);
  const [params] = useSearchParams();
  const chosen = params.get(CHILD_PARAM);
  if (chosen) {
    const match = children.find((c) => String(c.id) === chosen);
    if (match) return match;
  }
  return children.find((c) => c.id === focused) ?? children[0] ?? null;
}

/**
 * Keeps the remembered child in step with a child the address names, so a
 * parent who follows a link to Tunde's results and then opens Attendance
 * sees Tunde's attendance.
 */
export function useFollowAddressedChild(): void {
  const dispatch = useAppDispatch();
  const children = useAppSelector((s) => s.auth.me?.children ?? []);
  const focused = useAppSelector((s) => s.auth.focusChildId);
  const [params] = useSearchParams();
  const named = Number(params.get(CHILD_PARAM));
  const known = children.some((c) => c.id === named);
  useEffect(() => {
    if (known && named !== focused) dispatch(childFocused(named));
  }, [known, named, focused, dispatch]);
}

/**
 * The header's avatar and the sheet it opens (design 1c), as the student
 * app's switcher: which child the per-child screens are reading, then the
 * parent's own account, with My profile and Sign out. The avatar is ringed in
 * the showing child's colour; the sheet comes up from the bottom on a phone
 * and drops from the avatar on a wide screen.
 *
 * Choosing a child on any screen puts them in focus for every screen: a
 * family-wide screen such as Fees looks the same, and Results, Attendance
 * and Timetable open on that child next. It opens for every parent, one
 * child or none included, because it is the only way out of the app. The avatar is the showing child's, or the parent's
 * own initials when no child is linked.
 */
export function ChildSwitcher() {
  const children = useAppSelector((s) => s.auth.me?.children ?? []);
  const showBranch = useAppSelector((s) => s.auth.me?.show_branch ?? false);
  const parent = useAppSelector((s) => s.auth.me?.parent);
  const location = useLocation();
  const navigate = useNavigate();
  const active = useActiveChild();
  const [open, setOpen] = useState(false);
  const [logout, signingOut] = useLogoutMutation();
  const dispatch = useAppDispatch();
  const hue = useChildHue(active?.id);

  const signOut = async () => {
    await logout().unwrap().catch(() => {});
    setOpen(false);
    navigate("/sign-in", { replace: true });
  };

  const openProfile = () => {
    setOpen(false);
    navigate("/profile");
  };

  const choose = (childId: number) => {
    dispatch(childFocused(childId));
    const current = itemFor(location.pathname);
    const next = new URLSearchParams(location.search);
    // The choice is remembered either way; the address names the child only where the screen is about one.
    if (current?.perChild) next.set(CHILD_PARAM, String(childId));
    else next.delete(CHILD_PARAM);
    const query = next.toString();
    navigate(`${location.pathname}${query ? `?${query}` : ""}`, { replace: true });
    setOpen(false);
  };

  return (
    <Dialog.Root open={open} onOpenChange={(next) => !signingOut.isLoading && setOpen(next)}>
      <Dialog.Trigger asChild>
        <button
          type="button"
          className="child-switcher-trigger"
          style={hue === null ? undefined : ({ "--child-ring": solidOf(hue) } as CSSProperties)}
          aria-label={
            active
              ? `Showing ${active.first_name}. Switch child or sign out.`
              : "Your account. Sign out."
          }
        >
          {active ? (
            <ChildAvatar name={active.full_name} childId={active.id} size={36} />
          ) : (
            <span aria-hidden="true" className="child-switcher-initials">{parent?.initials ?? ""}</span>
          )}
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="child-switcher-overlay" />
        <Dialog.Content aria-describedby={undefined} className="child-switcher-sheet">
          <Dialog.Title>{children.length > 0 ? "Viewing" : "Your account"}</Dialog.Title>
          <Dialog.Close className="child-switcher-close" aria-label="Close switcher">
            <X size={17} aria-hidden="true" />
          </Dialog.Close>
          <ul className="child-switcher-list">
            {children.map((child) => (
              <li key={child.id}>
                <button
                  type="button"
                  onClick={() => choose(child.id)}
                  className={active && child.id === active.id ? "is-current" : ""}
                >
                  <ChildAvatar name={child.full_name} childId={child.id} size={44} />
                  <span className="child-switcher-text">
                    <strong>{child.full_name}</strong>
                    <small>
                      {[child.class_name, showBranch ? child.branch?.name : null]
                        .filter(Boolean)
                        .join(" · ")}
                    </small>
                  </span>
                  {active && child.id === active.id && (
                    <span className="child-switcher-check"><Check size={15} strokeWidth={3} aria-label="Showing" /></span>
                  )}
                </button>
              </li>
            ))}
          </ul>
          <p className="child-switcher-note">
            Only the school can add a child here. Ask the school to link
            another child to your account.
          </p>
          <div className="child-switcher-actions">
            <button type="button" disabled={signingOut.isLoading} onClick={openProfile}>
              <UserRound size={18} aria-hidden="true" />
              <span className="child-switcher-text">
                <strong>My profile</strong>
                {parent?.full_name && <small>{parent.full_name}</small>}
              </span>
              <ChevronRight size={18} aria-hidden="true" className="child-switcher-chevron" />
            </button>
            <button type="button" className="is-signout" disabled={signingOut.isLoading} onClick={signOut}>
              <LogOut size={18} aria-hidden="true" />
              {signingOut.isLoading ? "Signing out…" : "Sign out"}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
