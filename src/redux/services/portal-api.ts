import { setAccessToken } from "@/auth/access-token";
import { resetSessionInvalidation } from "@/auth/refresh";
import {
  meLoaded,
  meRefused,
  sessionEnded,
  signInStarted,
  type MeData,
} from "@/redux/features/auth-slice";
import { currentSchoolSlug } from "@/utils/school-host";

import { baseApi } from "./base-api";

/** The envelope every parent-portal response uses. */
type Envelope<T> = { message: string; data: T };

export type LoginRequest = { email: string; password: string };

/** What the platform `login/` route answers for an ordinary tenant sign-in. */
export type LoginData = {
  access: string;
  session_id: number;
  user: { email: string; first_name: string; last_name: string; full_name: string };
  school: { name?: string; logo?: string } | null;
  tenant: { kind?: string; slug?: string } | null;
  permissions: string[];
  /**
   * Set for an account that is handed off to a device-session app (student).
   * Not set for parents: they sign in on this app on their own account.
   */
  device_app?: { path: string } | null;
};

export const portalApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    login: builder.mutation<Envelope<LoginData>, LoginRequest>({
      query: ({ email, password }) => ({
        url: "/user/auth/login/",
        method: "POST",
        body: { email, password, tenant: currentSchoolSlug() },
      }),
      async onQueryStarted(_args, { dispatch, queryFulfilled }) {
        dispatch(signInStarted());
        try {
          const { data: result } = await queryFulfilled;
          const data = result.data;
          // The parent app is for parent / guardian accounts only. Codex
          // staff and pupils (device-session accounts) get signed back out
          // here; the sign-in page shows the right message off the response
          // before this handler runs.
          if (data?.tenant?.kind === "PLATFORM") return;
          if (data?.device_app) return;
          resetSessionInvalidation();
          setAccessToken(data?.access || "");
          // The `me/` fetch triggers from the route guard once the mutation
          // settles, which turns a successful tenant login into a confirmed
          // "yes, you are a parent" with the shell loaded.
        } catch {
          // The sign-in page shows the refusal inline from the mutation's error.
        }
      },
    }),
    logout: builder.mutation<void, void>({
      queryFn: async (_arg, _api, _extraOptions, baseQuery) => {
        const result = await baseQuery({
          url: "/user/auth/logout/",
          method: "POST",
          body: {},
        });
        if (result.error) return { error: result.error };
        return { data: undefined };
      },
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        try {
          await queryFulfilled;
        } finally {
          // Server-side revocation may have failed - clear local state anyway.
          setAccessToken("");
          dispatch(sessionEnded());
          dispatch(baseApi.util.resetApiState());
        }
      },
    }),
    me: builder.query<MeData, void>({
      query: () => ({ url: "/portal/parent/me/", method: "GET" }),
      transformResponse: (res: Envelope<MeData>) => res.data,
      providesTags: ["Me"],
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        try {
          const data = await queryFulfilled;
          dispatch(meLoaded(data.data));
        } catch (err) {
          const status = (err as { error?: { status?: number } }).error?.status;
          if (status === 404) dispatch(meRefused());
          else if (status === 401) dispatch(sessionEnded());
        }
      },
    }),
  }),
});

export const { useLoginMutation, useLogoutMutation, useMeQuery, useLazyMeQuery } = portalApi;
