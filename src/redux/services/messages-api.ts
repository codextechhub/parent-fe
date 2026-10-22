import { baseApi } from "./base-api";

/** The envelope every parent-portal response uses. */
type Envelope<T> = { message: string; data: T };

/* ─── Shapes ────────────────────────────────────────────────────────────── */

/** A member of staff the parent can write to, with the label the family reads. */
export type StaffContact = { user_id: number; name: string; label: string };

export type ConversationChild = { id: number; name: string; class_name: string };

export type LastMessage = {
  id: number;
  preview: string;
  sender_name: string;
  sent_at: string;
  mine: boolean;
};

/**
 * One conversation row. `FAMILY` is the parent's own conversation with a
 * member of staff about one child; `PUPIL` is a child's conversation with
 * staff that the parent reads, and never answers, as the child's primary
 * parent.
 */
export type Conversation = {
  id: number;
  kind: "FAMILY" | "PUPIL";
  kind_label: string;
  display_name: string;
  counterpart: StaffContact | null;
  child: ConversationChild;
  last_message: LastMessage | null;
  last_activity_at: string;
  unread_count: number;
  read_only: boolean;
  can_send: boolean;
  read_only_reason: string;
  /**
   * Whether to draw read ticks. Only an open conversation's detail carries it:
   * false when the school has receipts off or the parent only watches a
   * child's conversation; absent counts as false.
   */
  receipts?: boolean;
};

/**
 * Whether the person written to has read a message the parent sent. Only the
 * parent's own messages carry one, and only while the school shows receipts.
 */
export type Receipt = { state: "sent" | "read"; read_count: number; recipient_count: number };

export type ThreadMessage = {
  id: number;
  body: string;
  sender: { user_id: number; name: string } | null;
  sent_at: string;
  mine: boolean;
  receipt?: Receipt;
};

export type ConversationPage = {
  conversations: Conversation[];
  unreadCount: number;
  nextPage: number | null;
};

export type ContactList = {
  contacts: StaffContact[];
  canStart: boolean;
  canStartReason: string;
};

/**
 * The messages the app holds for one conversation, oldest first, plus where
 * the next older page starts. `loadedOlder` records that the parent has
 * paged back, after which a refresh of the newest page never rewinds the
 * cursor.
 */
export type Thread = {
  messages: ThreadMessage[];
  hasMore: boolean;
  nextBefore: number | null;
  loadedOlder: boolean;
};

type MessagePageResponse = { results: ThreadMessage[]; has_more: boolean; next_before: number | null };

type PollResponse = {
  results: ThreadMessage[];
  has_more: boolean;
  receipts?: (Receipt & { id: number })[];
};

/** How many messages the newest page and each older page carry. */
export const THREAD_PAGE_SIZE = 50;

/** The tag a conversation's list rows, row and badge hang on. */
const LIST = { type: "Messages", id: "LIST" } as const;
const UNREAD = { type: "Messages", id: "UNREAD" } as const;

/** Messages arrive newest first; the thread reads oldest first. */
function oldestFirst(page: MessagePageResponse): ThreadMessage[] {
  return [...page.results].sort((a, b) => a.id - b.id);
}

function union(a: ThreadMessage[], b: ThreadMessage[]): ThreadMessage[] {
  const byId = new Map<number, ThreadMessage>();
  for (const message of a) byId.set(message.id, message);
  for (const message of b) byId.set(message.id, message);
  return [...byId.values()].sort((x, y) => x.id - y.id);
}

export type StartArgs = { child: number; staff: number; body: string; client_token: string };
export type SendArgs = { id: number; body: string; client_token: string };

export const messagesApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    /** One page of the parent's conversations, newest activity first. */
    conversations: builder.query<ConversationPage, { page: number; child: number | null }>({
      query: ({ page, child }) => ({
        url: "/portal/parent/messages/conversations/",
        method: "GET",
        params: { page, ...(child ? { child } : {}) },
      }),
      transformResponse: (
        res: {
          data: Conversation[];
          pagination?: { next?: string | null };
          unread_count?: number;
        },
        _meta,
        { page },
      ) => ({
        conversations: res.data ?? [],
        unreadCount: res.unread_count ?? 0,
        nextPage: res.pagination?.next ? page + 1 : null,
      }),
      providesTags: [LIST],
    }),

    /** One conversation row, for the header of an open thread. */
    conversation: builder.query<Conversation, number>({
      query: (id) => ({ url: `/portal/parent/messages/conversations/${id}/`, method: "GET" }),
      transformResponse: (res: Envelope<Conversation>) => res.data,
      providesTags: (_r, _e, id) => [{ type: "Messages", id: `row-${id}` }],
    }),

    /** The unread total the tab bar badge reads. */
    unreadMessages: builder.query<number, void>({
      query: () => ({ url: "/portal/parent/messages/unread-count/", method: "GET" }),
      transformResponse: (res: Envelope<{ total: number }>) => res.data.total,
      providesTags: [UNREAD],
    }),

    /** The staff the parent may write to about one child. */
    messageContacts: builder.query<ContactList, number>({
      query: (child) => ({
        url: "/portal/parent/messages/contacts/",
        method: "GET",
        params: { child, page_size: 100 },
      }),
      transformResponse: (res: {
        data: StaffContact[];
        can_start?: boolean;
        can_start_reason?: string;
      }) => ({
        contacts: res.data ?? [],
        canStart: res.can_start ?? true,
        canStartReason: res.can_start_reason ?? "",
      }),
    }),

    /**
     * The newest page of a conversation's messages, kept as one thread per
     * conversation. A refresh merges into what the app already holds, so
     * older pages the parent paged back to stay put; if the refreshed page
     * does not reach back to anything held, what was held is replaced.
     */
    thread: builder.query<Thread, number>({
      query: (id) => ({
        url: `/portal/parent/messages/conversations/${id}/messages/`,
        method: "GET",
        params: { limit: THREAD_PAGE_SIZE },
      }),
      transformResponse: (res: Envelope<MessagePageResponse>): Thread => ({
        messages: oldestFirst(res.data),
        hasMore: res.data.has_more,
        nextBefore: res.data.next_before,
        loadedOlder: false,
      }),
      providesTags: (_r, _e, id) => [{ type: "Messages", id: `thread-${id}` }],
      merge: (current, incoming) => {
        const overlaps = incoming.messages.some((m) => current.messages.some((c) => c.id === m.id));
        if (incoming.hasMore && !overlaps) {
          Object.assign(current, incoming);
          return;
        }
        current.messages = union(current.messages, incoming.messages);
        if (!current.loadedOlder) {
          current.hasMore = incoming.hasMore;
          current.nextBefore = incoming.nextBefore;
        }
      },
      forceRefetch: () => true,
    }),

    /** Pages one step further back in a conversation. */
    loadOlderMessages: builder.mutation<void, { id: number; before: number }>({
      queryFn: async ({ id, before }, api, _extra, baseQuery) => {
        const result = await baseQuery({
          url: `/portal/parent/messages/conversations/${id}/messages/`,
          method: "GET",
          params: { before, limit: THREAD_PAGE_SIZE },
        });
        if (result.error) return { error: result.error };
        const page = (result.data as Envelope<MessagePageResponse>).data;
        api.dispatch(
          messagesApi.util.updateQueryData("thread", id, (draft) => {
            draft.messages = union(draft.messages, oldestFirst(page));
            draft.hasMore = page.has_more;
            draft.nextBefore = page.next_before;
            draft.loadedOlder = true;
          }),
        );
        return { data: undefined };
      },
    }),

    /**
     * Reads what came after the newest message the app holds, and the current
     * ticks of the parent's recent messages, and folds both into the thread.
     * Answers the newest id now held and whether more waits beyond the 100 the
     * backend returns at once, so the caller can ask again.
     */
    pollNewerMessages: builder.mutation<
      { newest: number; more: boolean },
      { id: number; after: number }
    >({
      queryFn: async ({ id, after }, api, _extra, baseQuery) => {
        const result = await baseQuery({
          url: `/portal/parent/messages/conversations/${id}/messages/`,
          method: "GET",
          params: { after },
        });
        if (result.error) return { error: result.error };
        const page = (result.data as Envelope<PollResponse>).data;
        const fresh = [...page.results].sort((a, b) => a.id - b.id);
        api.dispatch(
          messagesApi.util.updateQueryData("thread", id, (draft) => {
            draft.messages = union(draft.messages, fresh);
            for (const receipt of page.receipts ?? []) {
              const held = draft.messages.find((m) => m.id === receipt.id);
              if (held?.mine) {
                held.receipt = {
                  state: receipt.state,
                  read_count: receipt.read_count,
                  recipient_count: receipt.recipient_count,
                };
              }
            }
          }),
        );
        if (fresh.length > 0) {
          api.dispatch(
            messagesApi.util.invalidateTags([LIST, UNREAD, { type: "Messages", id: `row-${id}` }]),
          );
        }
        return { data: { newest: fresh.at(-1)?.id ?? after, more: page.has_more } };
      },
    }),

    /**
     * Writes a message. The same `client_token` on a retry answers the stored
     * message instead of sending a second one.
     */
    sendMessage: builder.mutation<ThreadMessage, SendArgs>({
      query: ({ id, body, client_token }) => ({
        url: `/portal/parent/messages/conversations/${id}/messages/`,
        method: "POST",
        body: { body, client_token },
      }),
      transformResponse: (res: Envelope<ThreadMessage>) => res.data,
      async onQueryStarted({ id }, { dispatch, queryFulfilled }) {
        try {
          const { data: sent } = await queryFulfilled;
          dispatch(
            messagesApi.util.updateQueryData("thread", id, (draft) => {
              draft.messages = union(draft.messages, [sent]);
            }),
          );
          dispatch(
            messagesApi.util.invalidateTags([LIST, { type: "Messages", id: `row-${id}` }]),
          );
        } catch {
          // The caller shows the refusal and keeps the text for a retry.
        }
      },
    }),

    /** Starts a conversation about a child (or finds the one that exists). */
    startConversation: builder.mutation<
      { conversation: Conversation; message: ThreadMessage | null },
      StartArgs
    >({
      query: (body) => ({ url: "/portal/parent/messages/conversations/", method: "POST", body }),
      transformResponse: (
        res: Envelope<{ conversation: Conversation; message: ThreadMessage | null }>,
      ) => res.data,
      invalidatesTags: [LIST, UNREAD],
    }),

    /** Marks a conversation read up to the newest message the parent has seen. */
    markConversationRead: builder.mutation<number, { id: number; up_to: number }>({
      query: ({ id, up_to }) => ({
        url: `/portal/parent/messages/conversations/${id}/read/`,
        method: "POST",
        body: { up_to },
      }),
      transformResponse: (res: Envelope<{ unread_count: number }>) => res.data.unread_count,
      invalidatesTags: (_r, _e, { id }) => [LIST, UNREAD, { type: "Messages", id: `row-${id}` }],
    }),
  }),
});

export const {
  useConversationsQuery,
  useConversationQuery,
  useUnreadMessagesQuery,
  useMessageContactsQuery,
  useThreadQuery,
  useLoadOlderMessagesMutation,
  usePollNewerMessagesMutation,
  useSendMessageMutation,
  useStartConversationMutation,
  useMarkConversationReadMutation,
} = messagesApi;
