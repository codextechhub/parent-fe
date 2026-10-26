import { baseApi } from "./base-api";

/**
 * Whether the signed-in parent may delete their own account, and how.
 *
 * `mode` is `close` for a parent: the account closes at once. `eligible`
 * false, or a 403 `ACCOUNT_CLOSURE_NOT_OFFERED` (a teacher who is also a
 * parent), means this account is not offered the option and the app shows no
 * entry for it. `pending` is set only where the school decides.
 */
export type ClosureState = {
  eligible: boolean;
  mode: "close" | "request" | null;
  pending: { requested_at: string } | null;
};

/** What confirming did: the account is closed now, or the school was asked. */
export type ClosureOutcome = { status: "closed" } | { status: "requested"; requested_at: string };

/**
 * Account deletion for the signed-in parent (`/user/me/account-closure/`).
 *
 * The state is a live look, never kept: its answer can change while the app is
 * away. Confirming does not invalidate anything, because an account that
 * closed at once can no longer be read; the screen ends the session itself.
 */
export const accountClosureApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    closureState: build.query<ClosureState, void>({
      query: () => "/user/me/account-closure/",
      transformResponse: (body: { data: ClosureState }) => body.data,
      keepUnusedDataFor: 0,
    }),
    confirmClosure: build.mutation<ClosureOutcome, void>({
      query: () => ({ url: "/user/me/account-closure/", method: "POST", body: { confirm: true } }),
      transformResponse: (body: { data: ClosureOutcome }) => body.data,
    }),
  }),
});

export const { useClosureStateQuery, useConfirmClosureMutation } = accountClosureApi;

/** Whether the screens offer deletion for this answer: the parent is eligible, or has a request waiting. */
export function closureOffered(state: ClosureState | undefined): boolean {
  return !!state && (state.eligible || !!state.pending);
}
