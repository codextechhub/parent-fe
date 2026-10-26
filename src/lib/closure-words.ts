import { formatTimestampDate } from "@/lib/format";

/** What closing the account does, in a parent's words. */
export const CLOSE_SENTENCE =
  "Your sign-in will be closed now. Your children's school records, results and fees stay with the school.";

/** What the school is asked to do, where it decides rather than the app. */
export const REQUEST_SENTENCE =
  "Your school will be asked to close your sign-in. Your children's school records, results and fees stay with the school.";

/** The sentence for a request already waiting. */
export const pendingSentence = (requestedAt: string): string => {
  const since = formatTimestampDate(requestedAt);
  return since ? `Your request is with the school since ${since}.` : "Your request is with the school.";
};
