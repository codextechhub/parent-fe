import { describe, expect, it } from "vitest";

import type { Conversation } from "@/redux/services/messages-api";
import type { Notice } from "@/redux/services/portal-api";

import { forChildren, inboxShow, mergeInbox, rowTime } from "./inbox";

const notice = (id: number, at: string): Notice => ({
  id, title: `Notice ${id}`, body: "", audience_label: "All parents", published_at: at, edited_at: null, unread: false, children: [],
});
const conversation = (id: number, at: string | null, activity = "2026-10-01T08:00:00Z"): Conversation => ({
  id, kind: "FAMILY", kind_label: "", display_name: `Teacher ${id}`, counterpart: null,
  child: { id: 1, name: "Tunde Okafor", class_name: "JSS 3 Gold" },
  last_message: at ? { id, preview: "", sender_name: "", sent_at: at, mine: false } : null,
  last_activity_at: activity, unread_count: 0, read_only: false, can_send: true, read_only_reason: "",
});
const ids = (entries: ReturnType<typeof mergeInbox>["entries"]) =>
  entries.map((e) => (e.kind === "notice" ? `n${e.notice.id}` : `m${e.conversation.id}`));

describe("the Inbox list", () => {
  it("puts notices and conversations together, newest first", () => {
    const { entries, more } = mergeInbox(
      { rows: [notice(1, "2026-10-24T09:00:00Z"), notice(2, "2026-10-20T09:00:00Z")], more: false },
      { rows: [conversation(7, "2026-10-26T09:12:00Z"), conversation(8, "2026-10-22T09:00:00Z")], more: false },
    );
    expect(ids(entries)).toEqual(["m7", "n1", "m8", "n2"]);
    expect(more).toBe(false);
  });

  it("dates a conversation with no messages by its last activity", () => {
    const { entries } = mergeInbox(
      { rows: [notice(1, "2026-10-24T09:00:00Z")], more: false },
      { rows: [conversation(7, null, "2026-10-25T09:00:00Z")], more: false },
    );
    expect(ids(entries)).toEqual(["m7", "n1"]);
  });

  it("holds back what is older than an unread page could be, and offers older", () => {
    const { entries, more } = mergeInbox(
      { rows: [notice(1, "2026-10-24T09:00:00Z"), notice(2, "2026-10-20T09:00:00Z")], more: true },
      { rows: [conversation(7, "2026-10-26T09:00:00Z"), conversation(8, "2026-10-10T09:00:00Z")], more: false },
    );
    // Notices' next page may hold one from 15 October, newer than conversation 8.
    expect(ids(entries)).toEqual(["m7", "n1", "n2"]);
    expect(more).toBe(true);
  });

  it("shows one source on its own when the other is filtered out", () => {
    const { entries, more } = mergeInbox(null, { rows: [conversation(7, "2026-10-26T09:00:00Z")], more: true });
    expect(ids(entries)).toEqual(["m7"]);
    expect(more).toBe(true);
  });
});

describe("the Inbox filter", () => {
  it("reads notices or messages from the address, and anything else as everything", () => {
    expect(inboxShow("notices")).toBe("notices");
    expect(inboxShow("messages")).toBe("messages");
    expect(inboxShow(null)).toBe("all");
    expect(inboxShow("spam")).toBe("all");
  });
});

describe("the words on a row", () => {
  it("names the children a notice is for, or gives its audience", () => {
    expect(forChildren([], "All parents")).toBe("All parents");
    expect(forChildren(["Tunde"], "JSS 3")).toBe("For Tunde");
    expect(forChildren(["Tunde", "Amara"], "All parents")).toBe("For Tunde and Amara");
    expect(forChildren(["Tunde", "Amara", "Chidi"], "All parents")).toBe("For Tunde, Amara and Chidi");
  });

  it("leaves this year off a date", () => {
    const now = new Date(2026, 9, 27, 12);
    expect(rowTime("2026-10-14T09:00:00", now)).toBe("14 Oct");
    expect(rowTime("2025-10-14T09:00:00", now)).toBe("14 Oct 2025");
  });
});
