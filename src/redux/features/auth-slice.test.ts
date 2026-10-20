import { describe, expect, it } from "vitest";

import {
  authReducer,
  childFocused,
  meLoaded,
  meRefused,
  sessionEnded,
  signInStarted,
  type MeData,
} from "./auth-slice";

const ME: MeData = {
  parent: { first_name: "A", full_name: "A B", initials: "AB" },
  school: { name: "S", logo_url: "" },
  show_branch: false,
  session: null,
  term: null,
  children: [],
};

describe("auth slice", () => {
  it("loads a parent", () => {
    const next = authReducer(undefined, meLoaded(ME));
    expect(next.me).toEqual(ME);
    expect(next.checked).toBe(true);
    expect(next.notAParent).toBe(false);
  });

  it("marks the account as not a parent", () => {
    const next = authReducer({ checked: false, me: ME, notAParent: false, focusChildId: null }, meRefused());
    expect(next.me).toBeNull();
    expect(next.notAParent).toBe(true);
  });

  it("ends the session", () => {
    const next = authReducer({ checked: true, me: ME, notAParent: true, focusChildId: null }, sessionEnded());
    expect(next.me).toBeNull();
    expect(next.notAParent).toBe(false);
    expect(next.checked).toBe(true);
  });

  it("clears the not-a-parent flag when a new sign-in starts", () => {
    const next = authReducer(
      { checked: true, me: null, notAParent: true, focusChildId: null },
      signInStarted(),
    );
    expect(next.notAParent).toBe(false);
  });

  describe("the child in focus", () => {
    const child = (id: number) => ({
      id, first_name: "C", full_name: "C D", initials: "CD", photo_url: "",
      admission_number: "", class_name: "", relationship: "",
    });
    const FAMILY = { ...ME, children: [child(11), child(12)] };

    it("is remembered on this device when the parent chooses one", () => {
      localStorage.clear();
      const next = authReducer(authReducer(undefined, meLoaded(FAMILY)), childFocused(12));
      expect(next.focusChildId).toBe(12);
      expect(localStorage.getItem("xvs.parent.focus-child")).toBe("12");
    });

    it("is dropped when it is not one of this parent's children", () => {
      const next = authReducer(
        { checked: true, me: null, notAParent: false, focusChildId: 99 },
        meLoaded(FAMILY),
      );
      expect(next.focusChildId).toBeNull();
    });

    it("is kept when the parent's details are read again", () => {
      const next = authReducer(
        { checked: true, me: FAMILY, notAParent: false, focusChildId: 12 },
        meLoaded(FAMILY),
      );
      expect(next.focusChildId).toBe(12);
    });

    it("is forgotten on sign-out, so the next parent on the phone starts afresh", () => {
      localStorage.setItem("xvs.parent.focus-child", "12");
      const next = authReducer(
        { checked: true, me: FAMILY, notAParent: false, focusChildId: 12 },
        sessionEnded(),
      );
      expect(next.focusChildId).toBeNull();
      expect(localStorage.getItem("xvs.parent.focus-child")).toBeNull();
    });
  });
});
