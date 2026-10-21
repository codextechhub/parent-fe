import { useState } from "react";
import { ArrowLeft, Check } from "lucide-react";
import { Link, useNavigate } from "react-router";
import { toast } from "sonner";

import { useActiveChild } from "@/components/session/child-switcher";
import { sendRefusalMessage } from "@/lib/messages";
import { cn } from "@/lib/utils";
import { useAppSelector } from "@/redux/hooks";
import {
  useMessageContactsQuery,
  useStartConversationMutation,
} from "@/redux/services/messages-api";

import { Composer } from "./messages-composer";
import { Initials } from "./messages-row";

/**
 * Writing to a member of staff for the first time.
 *
 * Three steps on one screen: the child it is about (defaults to the child
 * showing in the header, and is not asked at all when the parent has only
 * one), the member of staff the school lets the family reach about that
 * child, then the words. Where the school has switched family messaging off
 * the screen gives the school's sentence instead of the form. Starting
 * finds the conversation that already exists with that person about that
 * child if there is one, so the parent lands in it either way.
 */
export function NewMessage() {
  const navigate = useNavigate();
  const children = useAppSelector((s) => s.auth.me?.children ?? []);
  const active = useActiveChild();
  const [chosenChild, setChosenChild] = useState<number | null>(null);
  const childId = chosenChild ?? active?.id ?? children[0]?.id ?? null;
  const child = children.find((c) => c.id === childId) ?? null;
  const [pick, setPick] = useState<{ child: number; staff: number } | null>(null);
  const [start] = useStartConversationMutation();

  const { data: list, isLoading, isError, refetch } = useMessageContactsQuery(childId ?? 0, {
    skip: childId === null,
  });
  const contacts = list?.contacts ?? [];
  // A contact picked for another child does not carry over.
  const staffId =
    pick && pick.child === childId
      ? pick.staff
      : contacts.length === 1
        ? contacts[0].user_id
        : null;
  const staff = contacts.find((c) => c.user_id === staffId) ?? null;

  const begin = async (body: string, token: string): Promise<boolean> => {
    if (childId === null || staffId === null) return false;
    try {
      const started = await start({
        child: childId,
        staff: staffId,
        body,
        client_token: token,
      }).unwrap();
      navigate(`/messages/${started.conversation.id}`, { replace: true });
      return true;
    } catch (error) {
      toast.error(sendRefusalMessage(error));
      return false;
    }
  };

  return (
    <section className="msg-new-card" aria-labelledby="msg-new-title">
      <Link to="/messages" className="msg-detail-back">
        <ArrowLeft size={17} aria-hidden="true" />
        All messages
      </Link>
      <h2 id="msg-new-title" className="msg-new-title">
        New message
      </h2>

      {children.length === 0 && (
        <p className="msg-new-note">No child is linked to your account yet, so there is nobody to write to.</p>
      )}

      {children.length > 1 && (
        <fieldset className="msg-step">
          <legend>Which child is it about?</legend>
          <div className="msg-choices">
            {children.map((c) => (
              <label key={c.id} className={cn("msg-choice", c.id === childId && "is-on")}>
                <input
                  type="radio"
                  name="msg-child"
                  checked={c.id === childId}
                  onChange={() => setChosenChild(c.id)}
                />
                <span className="msg-choice-text">
                  <strong>{c.first_name}</strong>
                  {c.class_name && <small>{c.class_name}</small>}
                </span>
                {c.id === childId && <Check size={17} aria-hidden="true" />}
              </label>
            ))}
          </div>
        </fieldset>
      )}

      {child && (
        <fieldset className="msg-step">
          <legend>Who do you want to write to{children.length === 1 ? ` about ${child.first_name}` : ""}?</legend>
          {isLoading && <div className="msg-loading is-short" role="status" aria-label="Loading staff" />}
          {isError && !list && (
            <p className="msg-new-note" role="alert">
              The staff list can&apos;t be shown right now.{" "}
              <button type="button" className="msg-link" onClick={() => refetch()}>
                Try again
              </button>
            </p>
          )}
          {list && !list.canStart && (
            <p className="msg-new-note" role="status">
              {list.canStartReason || "Messaging is switched off at this school."}
            </p>
          )}
          {list && list.canStart && contacts.length === 0 && (
            <p className="msg-new-note" role="status">
              The school has no one set up to receive messages about {child.first_name} yet.
            </p>
          )}
          {list && list.canStart && contacts.length > 0 && (
            <div className="msg-choices">
              {contacts.map((c) => (
                <label key={c.user_id} className={cn("msg-choice", c.user_id === staffId && "is-on")}>
                  <input
                    type="radio"
                    name="msg-staff"
                    checked={c.user_id === staffId}
                    onChange={() => childId !== null && setPick({ child: childId, staff: c.user_id })}
                  />
                  <Initials name={c.name} />
                  <span className="msg-choice-text">
                    <strong>{c.name}</strong>
                    <small>{c.label}</small>
                  </span>
                  {c.user_id === staffId && <Check size={17} aria-hidden="true" />}
                </label>
              ))}
            </div>
          )}
        </fieldset>
      )}

      {list?.canStart && staff && child && (
        <div className="msg-step">
          <p className="msg-step-title">Your message to {staff.name}</p>
          <Composer
            scope={`start-${childId}-${staffId}`}
            onSend={begin}
            label={`Message to ${staff.name} about ${child.first_name}`}
            placeholder={`Write about ${child.first_name}`}
            className="is-inline"
          />
        </div>
      )}
    </section>
  );
}
