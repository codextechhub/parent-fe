import type { ChildFeesEntry } from "@/redux/services/portal-api";

import { ChildTransferAccount } from "./child-transfer-account";

/**
 * Every child's transfer account as a line each in Fees, with the child's
 * avatar and the account name beside the number so a parent of two picks the
 * right one.
 *
 * A child whose books cannot be read (fees `available: false`) is listed as a
 * line saying so; we never ask the backend to issue an account for a child
 * whose books cannot be read.
 */
export function TransferCardsForChildren({ children }: { children: ChildFeesEntry[] }) {
  if (children.length === 0) {
    return <p className="fees-empty">No children on your account.</p>;
  }
  return (
    <div className="fees-account-list">
      {children.map((entry) =>
        entry.available ? (
          <ChildTransferAccount
            key={entry.child.id}
            childId={entry.child.id}
            firstName={entry.child.first_name}
            fullName={entry.child.full_name}
            layout="row"
          />
        ) : (
          <p className="fees-transfer-card fees-transfer-card--note" key={entry.child.id}>
            {entry.child.first_name}: fees are unavailable, so no account can be shown.
          </p>
        ),
      )}
    </div>
  );
}
