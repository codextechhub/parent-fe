import { Trash2 } from "lucide-react";
import { Link } from "react-router";

import { pendingSentence } from "@/lib/closure-words";
import { closureOffered, useClosureStateQuery } from "@/redux/services/account-closure-api";

/**
 * The "Delete my account" entry on Profile, in the browser and in the store app.
 *
 * Absent for an account the API does not offer deletion for (a 403, or not
 * eligible) and while the answer has not arrived. With a request waiting at
 * the school it states since when, in place of the link.
 */
export function DeleteAccountCard() {
  const { data: state } = useClosureStateQuery();
  if (!closureOffered(state)) return null;

  return (
    <section className="profile-surface profile-notifications" aria-labelledby="delete-account-heading">
      <div className="profile-card-heading">
        <span className="profile-card-icon"><Trash2 size={19} aria-hidden="true" /></span>
        <div><h2 id="delete-account-heading">Delete my account</h2><p>Close your sign-in to this app</p></div>
      </div>
      <div className="profile-delete-body">
        {state?.pending ? (
          <p role="status">{pendingSentence(state.pending.requested_at)}</p>
        ) : (
          <>
            <p>Your children&apos;s school records, results and fees stay with the school.</p>
            <Link to="/profile/delete-account">Delete my account</Link>
          </>
        )}
      </div>
    </section>
  );
}
