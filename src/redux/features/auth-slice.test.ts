import { describe, expect, it } from "vitest";

import {
  authReducer,
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
    const next = authReducer({ checked: false, me: ME, notAParent: false }, meRefused());
    expect(next.me).toBeNull();
    expect(next.notAParent).toBe(true);
  });

  it("ends the session", () => {
    const next = authReducer({ checked: true, me: ME, notAParent: true }, sessionEnded());
    expect(next.me).toBeNull();
    expect(next.notAParent).toBe(false);
    expect(next.checked).toBe(true);
  });

  it("clears the not-a-parent flag when a new sign-in starts", () => {
    const next = authReducer(
      { checked: true, me: null, notAParent: true },
      signInStarted(),
    );
    expect(next.notAParent).toBe(false);
  });
});
