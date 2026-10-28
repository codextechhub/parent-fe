import { useState } from "react";
import { Check, Copy } from "lucide-react";

import type { TransferAccount } from "@/redux/services/portal-api";

type IssuedAccount = Extract<TransferAccount, { state: "ISSUED" }>;

/**
 * One child's account number on the Pay step (design 1m), where the parent
 * is about to transfer: the bank, the number large with Copy beside it, the
 * account name, and that the number stays the same for the child.
 */
export function TransferAccountLead({ account, title, firstName }: { account: IssuedAccount; title: string; firstName: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <section className="transfer-lead" aria-label={title}>
      <span className="transfer-lead-bank">{account.bank_name}</span>
      <div className="transfer-lead-number">
        <strong>{account.account_number}</strong>
        <button
          type="button"
          className="transfer-lead-copy"
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
          {copied ? <Check size={15} aria-hidden="true" /> : <Copy size={15} aria-hidden="true" />}
          <span role="status">{copied ? "Copied" : "Copy"}</span>
        </button>
      </div>
      <p className="transfer-lead-name">{account.account_name}</p>
      <p className="transfer-lead-hint">Save this number in your bank app. It stays the same for {firstName}.</p>
    </section>
  );
}
