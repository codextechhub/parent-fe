import { useState } from "react";

import { Button } from "@/components/ui/button";
import { refusal, useOpenChildTransferAccountMutation } from "@/redux/services/portal-api";

/**
 * The offer of a permanent account number for one child, when they have
 * none yet.
 *
 * The backend throttles opening these to keep a parent of several
 * children from accidentally issuing many; a refusal from the mutation
 * carries the server's own sentence.
 */
export function GetTransferAccount({ childId, firstName }: { childId: number; firstName: string }) {
  const [open, { isLoading }] = useOpenChildTransferAccountMutation();
  const [error, setError] = useState("");
  return (
    <section className="fees-get-account">
      <h3>{firstName}&apos;s transfer account</h3>
      <p>
        {firstName} doesn&apos;t have an account number for school fees yet. Get one and you can
        pay in from any bank.
      </p>
      {error && (
        <p className="fees-get-account-error" role="alert">
          {error}
        </p>
      )}
      <Button
        className="fees-get-account-action"
        loading={isLoading}
        disabled={isLoading}
        onClick={async () => {
          setError("");
          try {
            await open(childId).unwrap();
          } catch (failure) {
            setError(refusal(failure).message);
          }
        }}
      >
        Get {firstName}&apos;s account number
      </Button>
    </section>
  );
}
