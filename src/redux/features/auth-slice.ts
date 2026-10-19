import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

/** Who the signed-in parent is, as the shell reads it from `GET me/`. */
export type ParentIdentity = { first_name: string; full_name: string; initials: string };

export type SchoolInfo = { name: string; logo_url: string };

export type SessionInfo = { id: number; name: string } | null;

export type Branch = { id: number; name: string };

export type Child = {
  id: number;
  first_name: string;
  full_name: string;
  initials: string;
  photo_url: string;
  admission_number: string;
  class_name: string;
  relationship: string;
  branch?: Branch;
};

export type MeData = {
  parent: ParentIdentity;
  school: SchoolInfo;
  show_branch: boolean;
  session: SessionInfo;
  term: SessionInfo;
  children: Child[];
};

/** Where the parent's `me/` sits in the store once a session is in hand. */
export type AuthState = {
  /** True once the session has been checked at least once this JS context. */
  checked: boolean;
  /** The signed-in parent, else null. */
  me: MeData | null;
  /**
   * The last refusal of `me/`:
   * - `"NOT_A_PARENT"` for a staff / Codex / unlinked account signed in here;
   * - `"UNAUTH"` for a tab that woke up without a session.
   * Cleared on a fresh sign-in.
   */
  notAParent: boolean;
};

const initialState: AuthState = { checked: false, me: null, notAParent: false };

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    meLoaded(state, action: PayloadAction<MeData>) {
      state.me = action.payload;
      state.checked = true;
      state.notAParent = false;
    },
    meRefused(state) {
      state.me = null;
      state.checked = true;
      state.notAParent = true;
    },
    sessionEnded(state) {
      state.me = null;
      state.checked = true;
      state.notAParent = false;
    },
    signInStarted(state) {
      state.notAParent = false;
    },
  },
});

export const { meLoaded, meRefused, sessionEnded, signInStarted } = authSlice.actions;
export const authReducer = authSlice.reducer;
