import { useState } from "react";
import { ArrowLeft, Clock3 } from "lucide-react";
import { Link, useNavigate } from "react-router";

import { leaveAfterClosure } from "@/auth/leave-after-closure";
import { PageShell } from "@/components/layout/page-shell";
import { Button } from "@/components/ui/button";
import { CLOSE_SENTENCE, pendingSentence, REQUEST_SENTENCE } from "@/lib/closure-words";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import {
  closureOffered,
  useClosureStateQuery,
  useConfirmClosureMutation,
} from "@/redux/services/account-closure-api";
import { refusal } from "@/redux/services/portal-api";

import "./profile.css";
import "./delete-account.css";

/**
 * Deleting the parent's own account, from Profile (browser and store app
 * alike; the app stores require it inside the app).
 *
 * A parent's account closes at once: the screen says so, and what stays with
 * the school, before the one button. On success the parent is taken off this
 * device (`leaveAfterClosure`) and lands on the sign-in. Where the school is
 * the one to decide (a `request` mode), the screen says the request was sent
 * and shows its date while it waits. An account the API does not offer
 * deletion for (a 403, or not eligible) is told to ask the school office.
 */
export function DeleteAccountPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const offline = useAppSelector((s) => s.connectivity.offline);
  const { data: state, isLoading, isError, error, refetch } = useClosureStateQuery();
  const [confirm, { isLoading: sending }] = useConfirmClosureMutation();
  const [problem, setProblem] = useState("");
  const [sent, setSent] = useState(false);
  const closesNow = state?.mode !== "request";
  const notOffered = (isError && (error as { status?: unknown })?.status === 403) || (!!state && !closureOffered(state));

  const submit = async () => {
    setProblem("");
    try {
      const outcome = await confirm().unwrap();
      if (outcome.status === "closed") {
        await dispatch(leaveAfterClosure());
        navigate("/sign-in", { replace: true });
        return;
      }
      setSent(true);
      void refetch();
    } catch (failure) {
      setProblem(refusal(failure).message);
    }
  };

  return (
    <PageShell className="delete-account-page">
      <div className="delete-account-wrap">
        <Link to="/profile" className="delete-account-back"><ArrowLeft size={17} aria-hidden="true" />My profile</Link>
        <section className="profile-surface delete-account-card" aria-labelledby="delete-account-title">
          <h1 id="delete-account-title">Delete my account</h1>
          {isLoading && !state && <div className="profile-loading" role="status" aria-label="Loading" style={{ height: 96, marginTop: 16 }} />}
          {isError && !notOffered && !state && (
            <p role="alert">Deleting your account can&apos;t be checked right now. <button type="button" className="text-primary underline" onClick={() => void refetch()}>Try again</button></p>
          )}
          {notOffered && <p>Deleting your account isn&apos;t available here for this account. Ask the school office for help.</p>}
          {state?.pending && !sent && (
            <div className="delete-account-pending" role="status">
              <Clock3 size={18} aria-hidden="true" />
              <span>{pendingSentence(state.pending.requested_at)} You can keep using the app until the school has acted on it.</span>
            </div>
          )}
          {state && !state.pending && !sent && closureOffered(state) && (
            <>
              <p>{closesNow ? CLOSE_SENTENCE : REQUEST_SENTENCE}</p>
              {problem && <p className="delete-account-error" role="alert">{problem}</p>}
              {offline && <p>You can do this when you&apos;re back online.</p>}
              <div className="delete-account-actions">
                <Button variant="destructive" loading={sending} disabled={sending || offline} onClick={() => void submit()}>
                  {closesNow ? "Delete my account now" : "Send my request to the school"}
                </Button>
                <Button variant="outline" disabled={sending} onClick={() => navigate("/profile")}>Keep my account</Button>
              </div>
            </>
          )}
          {sent && <p role="status">Your request has been sent to your school. You can keep using the app until the school has acted on it.</p>}
        </section>
      </div>
    </PageShell>
  );
}
