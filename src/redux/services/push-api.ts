import { baseApi } from "./base-api";

/** The parent's push subscription, as the browser gives it (`PushSubscription.toJSON()`). */
export type ParentSubscription = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

const unwrap = <T,>(body: { data: T }) => body.data;

/**
 * Push notifications for the signed-in parent.
 *
 * - `pushKey` — the school's `applicationServerKey`. 503 `PUSH_NOT_CONFIGURED`
 *   where the backend has no VAPID keys; the app then offers no push at all.
 * - `subscribePush` — remember this browser for the signed-in parent, so a
 *   confirmed payment can reach them on a locked screen. Posted again on each
 *   open to re-send a browser that has rotated the subscription.
 * - `unsubscribePush` — forget this browser (the parent turned push off or
 *   signed out).
 *
 * The subscription carries the device `account` of the sign-in, so the
 * school ends this device's pushes when it signs out. The backend also
 * accepts it omitted, and then keys the row by (user, endpoint).
 */
export const pushApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    pushKey: build.query<string, void>({
      query: () => ({ url: "/notify/push/key/", method: "GET" }),
      transformResponse: (body: { data: { public_key: string } }) =>
        unwrap(body).public_key,
      keepUnusedDataFor: 3600,
    }),
    subscribePush: build.mutation<void, ParentSubscription & { account?: string }>({
      query: (body) => ({
        url: "/notify/push/subscriptions/",
        method: "POST",
        body,
      }),
    }),
    unsubscribePush: build.mutation<void, { endpoint: string }>({
      query: (body) => ({
        url: "/notify/push/subscriptions/",
        method: "DELETE",
        body,
      }),
    }),
  }),
});

export const { usePushKeyQuery } = pushApi;
