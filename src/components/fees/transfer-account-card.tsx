import { useState } from "react";
import { Building2, Check, Copy } from "lucide-react";

import type { TransferAccount } from "@/redux/services/portal-api";

type IssuedAccount = Extract<TransferAccount, { state: "ISSUED" }>;

/**
 * One child's permanent transfer account. The child's name sits in large
 * type beside the number so a parent of two picks the right one.
 *
 * Shared with student-fe's card; the difference is this card names a child
 * (not "your account"). Keep the two in step.
 */
export function TransferAccountCard({
  account,
  childName,
  title,
}: {
  account: IssuedAccount;
  childName: string;
  title: string;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <section className="student-transfer-card">
      <div>
        <div className="student-transfer-top">
          <span className="student-transfer-icon">
            <Building2 size={18} aria-hidden="true" />
          </span>
          <span className="student-transfer-status">Ready to use</span>
        </div>
        <h2 className="student-transfer-label">{title}</h2>
        <p className="student-transfer-name">For {childName}</p>
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(account.account_number);
              setCopied(true);
              window.setTimeout(() => setCopied(false), 2000);
            } catch {
              setCopied(false);
            }
          }}
          className="student-transfer-number"
          aria-label={`Account number ${account.account_number} for ${childName}. Copy`}
        >
          <span>{account.account_number}</span>
          {copied ? <Check className="size-4 text-green-700" /> : <Copy className="size-4 text-muted-foreground" />}
        </button>
        <p className="student-transfer-bank">{account.bank_name}</p>
        <p className="student-transfer-bank">Bank account name: {account.account_name}</p>
      </div>
      <p className="student-transfer-hint">
        This number stays the same, so you can save it and pay at any time. Any amount over what
        is owed waits as credit for the next bill.
      </p>
    </section>
  );
}
