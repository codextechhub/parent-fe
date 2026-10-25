import { useState } from "react";
import { Link } from "react-router";

import { formatNaira } from "@/lib/format";
import { useDepositWatch } from "@/lib/use-deposit-watch";
import {
  useChildTransferAccountQuery,
  type Deposit,
} from "@/redux/services/portal-api";

import { GetTransferAccount } from "./get-transfer-account";
import { TransferAccountCard } from "./transfer-account-card";

/** What the card says under the number, where a school's families pay by transfer alone. */
export const TRANSFER_HINT =
  "Pay any amount by transfer from your bank app. It shows here as soon as it arrives.";

type Props = {
  childId: number;
  firstName: string;
  fullName: string;
  /** What the child owes (kobo), shown with the number when more than nothing. */
  owing?: number;
  /** Replaces the card's heading, "<first name>'s account". */
  title?: string;
  hint?: string;
  /**
   * False hides the number and keeps only the transfers seen, for a bill that
   * has just been paid: the parent still sees "Received" and the receipt, and
   * the watch is not restarted by the screen changing shape.
   */
  showAccount?: boolean;
};

/**
 * One child's way to pay by bank transfer, with their transfers arriving live.
 *
 * It reads the child's account afresh each time the screen opens, so the time
 * it watches from is the moment the parent arrived, and shows by state: the
 * number (`ISSUED`) with the transfers into it, a button to get a number
 * (`NONE`), or the school's sentence (`UNAVAILABLE`). The transfers are kept
 * current by the app's one watcher while this is on screen.
 */
export function ChildTransferAccount({ childId, firstName, fullName, owing, title, hint = TRANSFER_HINT, showAccount = true }: Props) {
  const { data: account, isLoading, isFetching, isError } = useChildTransferAccountQuery(childId, {
    refetchOnMountOrArgChange: true,
  });
  const issued = account?.state === "ISSUED" ? account : null;
  const [since, setSince] = useState<string | null>(null);
  if (issued && !isFetching && since === null) setSince(issued.as_of);
  const deposits = useDepositWatch(issued ? childId : null, since);

  if (!showAccount) {
    return deposits.length > 0 ? (
      <div className="fees-transfer-card"><TransferActivity deposits={deposits} firstName={firstName} /></div>
    ) : null;
  }
  if (isLoading && !account) {
    return (
      <div
        className="fees-transfer-card fees-transfer-card--loading"
        role="status"
        aria-label={`Loading ${firstName}'s transfer account`}
      />
    );
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
      <TransferAccountCard
        account={account}
        childName={fullName}
        title={title ?? `${firstName}'s account`}
        owing={owing}
        hint={hint}
      />
      <TransferActivity deposits={deposits} firstName={firstName} />
    </div>
  );
}

/** The transfers seen since the screen opened: on their way, then received with their receipt. */
export function TransferActivity({ deposits, firstName }: { deposits: Deposit[]; firstName: string }) {
  if (deposits.length === 0) return null;
  return (
    <ul className="fees-transfer-activity" role="status" aria-label={`${firstName}'s transfers`}>
      {deposits.map((deposit) => {
        const received = deposit.status === "CONFIRMED";
        return (
          <li key={deposit.reference} className={received ? "is-received" : "is-pending"}>
            {received ? (
              <span>
                <strong>Received:</strong> {formatNaira(deposit.amount)} for {firstName}
              </span>
            ) : (
              <span>
                <strong>On its way:</strong> {formatNaira(deposit.amount)} for {firstName}
              </span>
            )}
            {received && deposit.has_receipt && deposit.payment_ref && (
              <Link to={`/fees/receipts/${deposit.payment_ref}`}>View receipt</Link>
            )}
          </li>
        );
      })}
    </ul>
  );
}
