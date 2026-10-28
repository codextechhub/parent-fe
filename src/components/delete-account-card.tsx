import { Trash2 } from "lucide-react";
import { Link } from "react-router";

import { pendingSentence } from "@/lib/closure-words";
import { closureOffered, useClosureStateQuery } from "@/redux/services/account-closure-api";

/**
 * The "Delete my account" row on Profile (design 1k), red, under Sign out.
 *
 * Absent for an account the API does not offer deletion for (a 403, or not
 * eligible) and while the answer has not arrived. With a request waiting at
 * the school it states since when, in place of the link.
 */
export function DeleteAccountRow() {
  const { data: state } = useClosureStateQuery();
  if (!closureOffered(state)) return null;

  return state?.pending ? (
    <div className="settings-row is-danger" role="status">
      <Trash2 size={18} aria-hidden="true" />
      <span className="settings-label">
        <span id="delete-account-heading">Delete my account</span>
        <small>{pendingSentence(state.pending.requested_at)}</small>
      </span>
    </div>
  ) : (
    <Link to="/profile/delete-account" className="settings-row is-danger">
      <Trash2 size={18} aria-hidden="true" />
      <span className="settings-label" id="delete-account-heading">Delete my account</span>
    </Link>
  );
}
