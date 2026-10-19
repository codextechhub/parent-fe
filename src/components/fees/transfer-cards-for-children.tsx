import { TransferAccountCard } from "./transfer-account-card";
import { GetTransferAccount } from "./get-transfer-account";
import {
  useChildTransferAccountQuery,
  type ChildFeesEntry,
} from "@/redux/services/portal-api";

/**
 * One transfer-account card per child, with the child's first name beside
 * the number in large type so a parent of two picks the right one.
 *
 * Children with unavailable books (fees `available: false`) are listed as a
 * small line pointing the parent at the Fees unavailable sentence; we never
 * ask the backend to issue an account for a child whose books cannot be
 * read.
 */
export function TransferCardsForChildren({ children }: { children: ChildFeesEntry[] }) {
  if (children.length === 0) {
    return <p className="fees-empty">No children on your account.</p>;
  }
  return (
    <div className="fees-transfer-grid">
      {children.map((entry) =>
        entry.available ? (
          <ChildTransferCard
            key={entry.child.id}
            childId={entry.child.id}
            firstName={entry.child.first_name}
            fullName={entry.child.full_name}
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

function ChildTransferCard({
  childId,
  firstName,
  fullName,
}: {
  childId: number;
  firstName: string;
  fullName: string;
}) {
  const { data: account, isLoading, isError } = useChildTransferAccountQuery(childId);

  if (isLoading && !account) {
    return <div className="fees-transfer-card fees-transfer-card--loading" role="status" aria-label={`Loading ${firstName}'s transfer account`} />;
  }
  if (isError || !account) {
    return (
      <div className="fees-transfer-card fees-transfer-card--note">
        <strong>{firstName}&apos;s transfer account</strong>
        <p>Can&apos;t be shown right now. Try again in a moment.</p>
      </div>
    );
  }
  if (account.state === "UNAVAILABLE") {
    return (
      <div className="fees-transfer-card fees-transfer-card--note">
        <strong>{firstName}&apos;s transfer account</strong>
        <p>{account.message}</p>
      </div>
    );
  }
  if (account.state === "NONE") {
    return (
      <div className="fees-transfer-card">
        <GetTransferAccount childId={childId} firstName={firstName} />
      </div>
    );
  }
  return (
    <div className="fees-transfer-card">
      <TransferAccountCard account={account} childName={fullName} title={`${firstName}'s account`} />
    </div>
  );
}
