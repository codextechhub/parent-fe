import type { ChildFeesEntry } from "@/redux/services/portal-api";

import { ChildTransferAccount } from "./child-transfer-account";

/**
 * One transfer-account card per child, with the child's first name beside
 * the number in large type so a parent of two picks the right one.
 *
 * A child whose books cannot be read (fees `available: false`) is listed as a
 * line saying so; we never ask the backend to issue an account for a child
 * whose books cannot be read.
 */
export function TransferCardsForChildren({ children, hint }: { children: ChildFeesEntry[]; hint?: string }) {
  if (children.length === 0) {
    return <p className="fees-empty">No children on your account.</p>;
  }
  return (
    <div className="fees-transfer-grid">
      {children.map((entry) =>
        entry.available ? (
          <ChildTransferAccount
            key={entry.child.id}
            childId={entry.child.id}
            firstName={entry.child.first_name}
            fullName={entry.child.full_name}
            owing={entry.owing}
            hint={hint}
          />
        ) : (
          <p className="fees-empty" key={entry.child.id}>
            {entry.child.first_name}: fees are unavailable, so no account can be shown.
          </p>
        ),
      )}
    </div>
  );
}
