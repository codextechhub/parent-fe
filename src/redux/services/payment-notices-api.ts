import { PAYMENT_RECEIVED_EVENT } from "@/lib/payment-notices";

import { baseApi } from "./base-api";

/** One unread "payment received" notice from the signed-in parent's own notification feed. */
export type PaymentNotice = {
  id: string;
  subject: string;
  body: string;
  createdAt: string;
};

type FeedRow = {
  id?: unknown;
  event_type_key?: unknown;
  subject?: unknown;
  body?: unknown;
  created_at?: unknown;
  is_read?: unknown;
};

/** How many unread payment notices Home reads; older ones wait in the feed. */
export const PAYMENT_NOTICES_SHOWN = 5;

/**
 * The parent's payment notices.
 *
 * - `paymentNotices` reads the unread rows of the person's own in-app feed
 *   (`GET /notify/`, which only ever answers the signed-in account's rows) for
 *   the one event a booked payment raises. The same filter is applied again to
 *   what comes back, so a server that ignores a filter cannot put another
 *   notice on Home.
 * - `markPaymentNoticeRead` clears one row when the parent opens it, and takes
 *   it off Home straight away.
 */
export const paymentNoticesApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    paymentNotices: builder.query<PaymentNotice[], void>({
      query: () => ({
        url: "/notify/",
        method: "GET",
        params: {
          is_read: false,
          event_type_key: PAYMENT_RECEIVED_EVENT,
          page_size: PAYMENT_NOTICES_SHOWN,
        },
      }),
      transformResponse: (res: { data?: unknown }): PaymentNotice[] => {
        const rows: FeedRow[] = Array.isArray(res?.data) ? (res.data as FeedRow[]) : [];
        return rows
          .filter(
            (row) =>
              row.event_type_key === PAYMENT_RECEIVED_EVENT &&
              row.is_read !== true &&
              typeof row.id === "string",
          )
          .map((row) => ({
            id: row.id as string,
            subject: typeof row.subject === "string" ? row.subject : "",
            body: typeof row.body === "string" ? row.body : "",
            createdAt: typeof row.created_at === "string" ? row.created_at : "",
          }));
      },
      providesTags: ["PaymentNotices"],
    }),
    markPaymentNoticeRead: builder.mutation<void, string>({
      query: (id) => ({ url: "/notify/mark-read/", method: "POST", body: { ids: [id] } }),
      // The home screen's unread bell counts the same row.
      invalidatesTags: ["Me"],
      async onQueryStarted(id, { dispatch, queryFulfilled }) {
        const patch = dispatch(
          paymentNoticesApi.util.updateQueryData("paymentNotices", undefined, (draft) => {
            const at = draft.findIndex((n) => n.id === id);
            if (at >= 0) draft.splice(at, 1);
          }),
        );
        try {
          await queryFulfilled;
        } catch {
          patch.undo();
        }
      },
    }),
  }),
});

export const { usePaymentNoticesQuery, useMarkPaymentNoticeReadMutation } = paymentNoticesApi;
