import { useState } from "react";
import { Check, Copy } from "lucide-react";

import { ChildAvatar } from "@/components/child-avatar";
import type { TransferAccount } from "@/redux/services/portal-api";

type IssuedAccount = Extract<TransferAccount, { state: "ISSUED" }>;

/**
 * One child's account number as a line in Fees' "Show account numbers"
 * (design 1g): the child's avatar in their colour, the bank and account name
 * over the number, and Copy. The Pay and Invoice screens use the larger
 * `TransferAccountCard`.
 */
export function TransferAccountRow({ account, childId, firstName, fullName }: { account: IssuedAccount; childId: number; firstName: string; fullName: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="fees-account-row">
      <ChildAvatar name={fullName} childId={childId} size={34} />
      <span className="fees-account-text">
        <span className="fees-account-bank">{account.bank_name} · {account.account_name}</span>
        <strong className="fees-account-number">{account.account_number}</strong>
      </span>
      <button
        type="button"
        className="fees-account-copy"
        aria-label={copied ? `${firstName}'s account number copied` : `Copy ${firstName}'s account number`}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(account.account_number);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 2000);
          } catch {
            setCopied(false);
          }
        }}
      >
        {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
        <span role="status">{copied ? "Copied" : "Copy"}</span>
      </button>
    </div>
  );
}
