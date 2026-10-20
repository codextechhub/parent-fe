import { useState } from "react";
import { Check, X } from "lucide-react";
import { Dialog } from "radix-ui";
import { useLocation, useNavigate, useSearchParams } from "react-router";

import { ChildAvatar } from "@/components/child-avatar";
import { itemFor } from "@/components/shell/nav";
import { useAppSelector } from "@/redux/hooks";
import type { Child } from "@/redux/features/auth-slice";

import "./child-switcher.css";

/** The query key the active child's id is carried in. */
export const CHILD_PARAM = "child";

/** The child whose record is showing, else the first child, else null. */
export function useActiveChild(): Child | null {
  const children = useAppSelector((s) => s.auth.me?.children ?? []);
  const [params] = useSearchParams();
  const chosen = params.get(CHILD_PARAM);
  if (chosen) {
    const match = children.find((c) => String(c.id) === chosen);
    if (match) return match;
  }
  return children[0] ?? null;
}

/**
 * Picks which child the per-child screens are reading. In the header on
 * every screen; the one shown is the switcher's "showing" row.
 */
export function ChildSwitcher() {
  const children = useAppSelector((s) => s.auth.me?.children ?? []);
  const showBranch = useAppSelector((s) => s.auth.me?.show_branch ?? false);
  const location = useLocation();
  const navigate = useNavigate();
  const active = useActiveChild();
  const [open, setOpen] = useState(false);

  // Nothing to switch between: a parent with one child reads the switcher as
  // a plain avatar, no sheet to open.
  if (children.length === 0) return null;
  const onlyOne = children.length === 1;

  const choose = (childId: number) => {
    const current = itemFor(location.pathname);
    const next = new URLSearchParams(location.search);
    // Keep the child in the URL where a route uses it so a reload stays on
    // the same child; drop it on a route that scopes to the family (Fees,
    // Notices, Profile) so a stale segment does not travel with it.
    if (current?.perChild) next.set(CHILD_PARAM, String(childId));
    else next.delete(CHILD_PARAM);
    const query = next.toString();
    navigate(`${location.pathname}${query ? `?${query}` : ""}`, { replace: true });
    setOpen(false);
  };

  return (
    <Dialog.Root open={open && !onlyOne} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button
          type="button"
          className="child-switcher-trigger"
          aria-label={
            active
              ? `Showing ${active.first_name}. Switch child.`
              : "Switch child"
          }
          disabled={onlyOne}
        >
          {active && <ChildAvatar name={active.full_name} childId={active.id} size={32} />}
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="child-switcher-overlay" />
        <Dialog.Content aria-describedby={undefined} className="child-switcher-sheet">
          <Dialog.Title>Viewing</Dialog.Title>
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
                  <ChildAvatar name={child.full_name} childId={child.id} size={38} />
                  <span className="child-switcher-text">
                    <strong>{child.full_name}</strong>
                    <small>
                      {[child.class_name, showBranch ? child.branch?.name : null]
                        .filter(Boolean)
                        .join(" · ")}
                    </small>
                  </span>
                  {active && child.id === active.id && (
                    <Check size={18} aria-label="Showing" />
                  )}
                </button>
              </li>
            ))}
          </ul>
          <p className="child-switcher-note">
            Only the school can add a child here. Ask the school to link
            another child to your account.
          </p>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
