import { setAccessToken } from "@/auth/access-token";
import { resetSessionInvalidation } from "@/auth/refresh";
import {
  meLoaded,
  meRefused,
  sessionEnded,
  signInStarted,
  type Child,
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

/* ─── Home ──────────────────────────────────────────────────────────────── */

/** Every per-block answer carries `available`; false means a sentence replaces the figures. */
export type Unavailable = { available: false; message: string };

export type ChildAttendance =
  | ({ available: true; rate: number | null } & Record<string, unknown>)
  | Unavailable;
export type ChildFees =
  | { available: true; balance: number; status: "OWING" | "CLEAR" | "IN_CREDIT"; open_invoice_count: number }
  | Unavailable;
export type ChildResults =
  | { available: true; released: false }
  | { available: true; released: true; term: { id: number; name: string; session: string }; overall_average: string }
  | Unavailable;

export type ChildHomeBlock = {
  id: number;
  first_name: string;
  class_name: string;
  attendance: ChildAttendance;
  fees: ChildFees;
  results: ChildResults;
};

export type FamilyFees =
  | { available: true; outstanding: number; pay_all_total: number }
  | Unavailable;

export type HomeNotice = {
  id: number;
  title: string;
  body: string;
  audience_label: string;
  published_at: string;
  edited_at: string | null;
  unread: boolean;
  children: string[];
};

export type HomeNoticesBlock =
  | { available: true; latest: HomeNotice | null; unread_count: number }
  | Unavailable;

export type NotificationsBlock =
  | { available: true; unread_count: number }
  | Unavailable;

export type Home = {
  date: string;
  children: ChildHomeBlock[];
  fees: FamilyFees;
  notices: HomeNoticesBlock;
  notifications: NotificationsBlock;
};

/* ─── Notices ───────────────────────────────────────────────────────────── */

export type Notice = HomeNotice;

export type NoticePage = {
  notices: Notice[];
  unreadCount: number;
  nextPage: number | null;
};

/* ─── Profile ───────────────────────────────────────────────────────────── */

export type ProfileData = {
  managed_by_school: {
    full_name: string;
    sign_in_email: string;
    children: Child[];
  };
  editable: { phone: string; alt_phone: string; address: string };
  email_editable: false;
};

export type EditableFields = Partial<{ phone: string; alt_phone: string; address: string }>;

/* ─── Password ──────────────────────────────────────────────────────────── */

export type PasswordPolicy = { min_length: number; requirements: string[] };
export type PasswordChange = {
  current_password: string;
  password: string;
  confirm_password: string;
};

/* ─── Per-child reads ───────────────────────────────────────────────────── */

export type TimetableCell = {
  start_time: string;
  end_time: string;
  kind: "LESSON" | "BREAK" | string;
  label: string;
  subject?: string;
  teacher?: string;
  room?: string;
};

export type TodayPeriod = TimetableCell & {
  state: "done" | "now" | "next" | "later";
};

export type Timetable = {
  published: boolean;
  class_name: string;
  days: { day_of_week: number; day_label: string; is_today: boolean; cells: TimetableCell[] }[];
  today: { date: string; periods: TodayPeriod[] } | null;
};

export type AttendanceTerm = {
  id: number;
  name: string;
  session_name: string;
  start_date: string;
  end_date: string;
  is_current: boolean;
};

export type AttendanceDay = {
  date: string;
  state: "MARKED" | "NOT_TAKEN" | "CLOSED" | "SUSPENDED" | "NOT_ON_ROLL" | string;
  mark: "P" | "L" | "A" | "E" | null;
  arrived_at: string | null;
  closed_reason: string | null;
};

export type AttendanceNote = {
  date: string;
  mark: "L" | "A" | "E";
  mark_label: string;
  reason_label: string | null;
  note: string;
  arrived_at: string | null;
};

export type Attendance = {
  term: AttendanceTerm | null;
  terms: AttendanceTerm[];
  counts: {
    present: number;
    late: number;
    absent: number;
    excused: number;
    not_taken: number;
    opened: number;
    rate: number | null;
  };
  days: AttendanceDay[];
  notes: AttendanceNote[];
  today: AttendanceDay | null;
};

export type ResultTerm = {
  id: number;
  name: string;
  session: string;
  state: "released" | "withheld";
};

export type SubjectResult = {
  name: string;
  teacher: string | null;
  cells: { short_name: string; max_score: number | null; mark: number | string | null }[];
  total: number | null;
  obtainable: number | null;
  percentage: string | null;
  grade: string | null;
  remark: string | null;
};

export type TermResult = {
  state: "released" | "withheld" | "not_published";
  term: { id: number; name: string; session: string } | null;
  terms: ResultTerm[];
  message?: string;
  released_at?: string;
  class_name?: string;
  components?: { short_name: string; max_score: number; is_exam: boolean }[];
  subjects?: SubjectResult[];
  summary?: {
    overall_average: string | null;
    subjects: number;
    position?: number;
    position_label?: string;
    class_average?: string;
  };
  teacher_comment?: string;
  class_teacher?: string | null;
  next_term_begins?: string | null;
};

export type SessionResults = {
  state: "released" | "withheld" | "not_published";
  session: { id: number; name: string } | null;
  terms: (ResultTerm & {
    released_at?: string;
    average?: string | null;
    position_label?: string;
    class_average?: string;
  })[];
  terms_released?: number;
  terms_total?: number;
  cumulative: null | {
    terms: { id: number; name: string }[];
    subjects: {
      name: string;
      terms: { term: string; percentage: string | null }[];
      annual_average: string | null;
      annual_grade?: string | null;
    }[];
    annual_average: string | null;
    annual_position_label?: string;
    class_average?: string;
    promotion: string | null;
    remark: string;
    class_teacher: string | null;
  };
  next_term_begins?: string | null;
};

/** The report-card payload the parent portal serves; same shape as school-fe's. */
export type ReportCard = {
  letterhead: {
    school_name: string;
    logo_url: string | null;
    branch_name: string | null;
    branch_address: string | null;
    phone: string | null;
  };
  term_line: string;
  facts: { label: string; value: string }[];
  components: { short_name: string; max_score: number }[];
  subjects: {
    name: string;
    cells?: string[];
    total?: number | null;
    grade?: string | null;
    remark?: string | null;
    class_average?: string | null;
    highest?: number | null;
    lowest?: number | null;
  }[];
  totals: { label: string; value: string }[];
  attendance?: { label: string; value: string }[];
  ratings?: { trait: string; value: number }[];
  rating_key?: string;
  teacher_comment?: string;
  teacher_name?: string | null;
  principal_comment?: string | null;
  principal_name?: string | null;
  grading_key: string;
  cumulative?: {
    terms: string[];
    subjects: { name: string; totals?: string[]; annual_average?: string | null }[];
    annual_average?: string | null;
    annual_position?: string;
    promotion_line?: string;
  };
  next_term_line?: string;
  version: number;
  /** Backend's parent portal only serves released cards; this is here for shape parity. */
  held: boolean;
};

export const parentApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    home: builder.query<Home, void>({
      query: () => ({ url: "/portal/parent/home/", method: "GET" }),
      transformResponse: (res: Envelope<Home>) => res.data,
      providesTags: ["Me"],
    }),
    profile: builder.query<ProfileData, void>({
      query: () => ({ url: "/portal/parent/profile/", method: "GET" }),
      transformResponse: (res: Envelope<ProfileData>) => res.data,
      providesTags: ["Profile"],
    }),
    updateProfile: builder.mutation<ProfileData, EditableFields>({
      query: (body) => ({ url: "/portal/parent/profile/", method: "PATCH", body }),
      transformResponse: (res: Envelope<ProfileData>) => res.data,
      invalidatesTags: ["Profile", "Me"],
    }),
    notices: builder.query<NoticePage, number>({
      query: (page) => ({ url: "/portal/parent/notices/", method: "GET", params: { page } }),
      transformResponse: (res: {
        data: Notice[];
        pagination?: { next?: string | null };
        unread_count?: number;
      }, _meta, page) => ({
        notices: res.data ?? [],
        unreadCount: res.unread_count ?? 0,
        nextPage: res.pagination?.next ? page + 1 : null,
      }),
      providesTags: (result, _err, page) =>
        result
          ? [{ type: "Notices", id: `page-${page}` }, { type: "Notices", id: "LIST" }]
          : [{ type: "Notices", id: "LIST" }],
    }),
    notice: builder.query<Notice, number>({
      query: (id) => ({ url: `/portal/parent/notices/${id}/`, method: "GET" }),
      transformResponse: (res: Envelope<Notice>) => res.data,
      providesTags: (_r, _e, id) => [{ type: "Notices", id }],
    }),
    markNoticeRead: builder.mutation<Notice, number>({
      query: (id) => ({ url: `/portal/parent/notices/${id}/read/`, method: "POST", body: {} }),
      transformResponse: (res: Envelope<Notice>) => res.data,
      // Invalidate the detail (so the server's updated row refetches) and the
      // Home's `me` latest-notice reference. The list rows are patched
      // optimistically below so the row flips to "Read" without a round trip.
      invalidatesTags: (_r, _e, id) => [{ type: "Notices", id }, "Me"],
      async onQueryStarted(id, { dispatch, queryFulfilled }) {
        const undo: Array<{ undo: () => void }> = [];
        for (const page of [1, 2, 3, 4, 5]) {
          const patch = dispatch(
            parentApi.util.updateQueryData("notices", page, (draft) => {
              const row = draft.notices.find((n) => n.id === id);
              if (row && row.unread) {
                row.unread = false;
                draft.unreadCount = Math.max(0, draft.unreadCount - 1);
              }
            }),
          );
          undo.push(patch);
        }
        const detailPatch = dispatch(
          parentApi.util.updateQueryData("notice", id, (draft) => {
            draft.unread = false;
          }),
        );
        try {
          await queryFulfilled;
        } catch {
          for (const patch of undo) patch.undo();
          detailPatch.undo();
        }
      },
    }),
    markAllNoticesRead: builder.mutation<void, void>({
      queryFn: async (_arg, _api, _extraOptions, baseQuery) => {
        const result = await baseQuery({ url: "/portal/parent/notices/read-all/", method: "POST", body: {} });
        if (result.error) return { error: result.error };
        return { data: undefined };
      },
      invalidatesTags: [{ type: "Notices", id: "LIST" }, "Me"],
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        const undo: Array<{ undo: () => void }> = [];
        for (const page of [1, 2, 3, 4, 5]) {
          const patch = dispatch(
            parentApi.util.updateQueryData("notices", page, (draft) => {
              for (const row of draft.notices) row.unread = false;
              draft.unreadCount = 0;
            }),
          );
          undo.push(patch);
        }
        try {
          await queryFulfilled;
        } catch {
          for (const patch of undo) patch.undo();
        }
      },
    }),
    passwordPolicy: builder.query<PasswordPolicy, void>({
      query: () => ({ url: "/user/auth/password/policy/", method: "GET" }),
      transformResponse: (res: Envelope<PasswordPolicy>) => res.data,
    }),
    changePassword: builder.mutation<void, PasswordChange>({
      queryFn: async (body, _api, _extraOptions, baseQuery) => {
        const result = await baseQuery({ url: "/user/auth/password/change/", method: "POST", body });
        if (result.error) return { error: result.error };
        return { data: undefined };
      },
    }),
    /* Per-child reads. Each refetches when `childId` changes, so the shell
       never shows one child's data under another's name. */
    childTimetable: builder.query<Timetable, number>({
      query: (childId) => ({
        url: `/portal/parent/children/${childId}/timetable/`,
        method: "GET",
      }),
      transformResponse: (res: Envelope<Timetable>) => res.data,
      providesTags: (_r, _e, childId) => [{ type: "Timetable", id: childId }],
    }),
    childAttendance: builder.query<Attendance, { childId: number; term: number | null }>({
      query: ({ childId, term }) => ({
        url: `/portal/parent/children/${childId}/attendance/`,
        method: "GET",
        params: term ? { term } : {},
      }),
      transformResponse: (res: Envelope<Attendance>) => res.data,
      providesTags: (_r, _e, args) => [{ type: "Attendance", id: `${args.childId}:${args.term ?? "current"}` }],
    }),
    childResults: builder.query<TermResult, { childId: number; term: number | null }>({
      query: ({ childId, term }) => ({
        url: `/portal/parent/children/${childId}/results/`,
        method: "GET",
        params: term ? { term } : {},
      }),
      transformResponse: (res: Envelope<TermResult>) => res.data,
      providesTags: (_r, _e, args) => [{ type: "Results", id: `${args.childId}:${args.term ?? "current"}` }],
    }),
    childSessionResults: builder.query<SessionResults, { childId: number; session: number | null }>({
      query: ({ childId, session }) => ({
        url: `/portal/parent/children/${childId}/results/session/`,
        method: "GET",
        params: session ? { session } : {},
      }),
      transformResponse: (res: Envelope<SessionResults>) => res.data,
      providesTags: (_r, _e, args) => [{ type: "Results", id: `session:${args.childId}:${args.session ?? "current"}` }],
    }),
    childReportCard: builder.query<ReportCard, { childId: number; term: number }>({
      query: ({ childId, term }) => ({
        url: `/portal/parent/children/${childId}/results/report-card/`,
        method: "GET",
        params: { term },
      }),
      transformResponse: (res: Envelope<ReportCard>) => res.data,
      providesTags: (_r, _e, args) => [{ type: "Results", id: `card:${args.childId}:${args.term}` }],
    }),
  }),
});

export const {
  useHomeQuery,
  useProfileQuery,
  useUpdateProfileMutation,
  useNoticesQuery,
  useNoticeQuery,
  useMarkNoticeReadMutation,
  useMarkAllNoticesReadMutation,
  usePasswordPolicyQuery,
  useChangePasswordMutation,
  useChildTimetableQuery,
  useChildAttendanceQuery,
  useChildResultsQuery,
  useChildSessionResultsQuery,
  useChildReportCardQuery,
} = parentApi;

/** The sentence a mutation refused for one field, as the backend wraps it. */
export type FieldRefusal = { message: string; field: string };

export function refusal(error: unknown): FieldRefusal {
  const err = error as {
    status?: number | string;
    data?: { message?: string; error?: { code?: string; detail?: unknown; field?: string } };
  } | undefined;
  if (!err) return { message: "Something went wrong.", field: "" };
  if (err.status === "FETCH_ERROR") {
    return { message: "You are offline. Try again when you have a connection.", field: "" };
  }
  const data = err.data;
  const detail = data?.error?.detail;
  // ProfileFieldInvalid serialises as {error: {detail: {<field>: ["sentence"]}}}
  // or a plain object with the field names; take the first sentence.
  let field = data?.error?.field ?? "";
  let message = data?.message ?? "";
  if (detail && typeof detail === "object" && !Array.isArray(detail)) {
    const [firstField, firstValue] = Object.entries(detail)[0] ?? [];
    if (firstField) field = firstField;
    if (Array.isArray(firstValue) && typeof firstValue[0] === "string") {
      message = firstValue[0];
    } else if (typeof firstValue === "string") {
      message = firstValue;
    }
  }
  if (!message) message = "That could not be saved. Try again in a moment.";
  return { message, field };
}

export type PasswordRefusals = {
  current_password?: string;
  password?: string;
  confirm_password?: string;
  form?: string;
};

function readSentence(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.filter((v) => typeof v === "string").join(" ");
  return "";
}

export function passwordRefusals(error: unknown): PasswordRefusals {
  const err = error as { status?: number | string; data?: { message?: string; error?: Record<string, unknown> } } | undefined;
  if (err?.status === "FETCH_ERROR") {
    return { form: "You are offline. Try again when you have a connection." };
  }
  const detail = err?.data?.error ?? {};
  const out: PasswordRefusals = {};
  for (const field of ["current_password", "password", "confirm_password"] as const) {
    const text = readSentence(detail[field]);
    if (text) out[field] = text;
  }
  if (!out.password) {
    const policy = readSentence(detail.messages);
    if (policy) out.password = policy;
  }
  if (Object.keys(out).length === 0) {
    out.form = err?.data?.message || "Your password could not be changed. Try again in a moment.";
  }
  return out;
}
