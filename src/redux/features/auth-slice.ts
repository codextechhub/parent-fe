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
  /**
   * The child the parent last chose in the switcher, whatever screen they
   * chose them on, so every per-child screen opens on that child. Null until
   * they choose, and for a child no longer on their account.
   */
  focusChildId: number | null;
};

/** Where the chosen child is kept on this device, so a reload opens on them too. */
const FOCUS_KEY = "xvs.parent.focus-child";

function rememberedChild(): number | null {
  try {
    const id = Number(localStorage.getItem(FOCUS_KEY));
    return Number.isSafeInteger(id) && id > 0 ? id : null;
  } catch {
    return null;
  }
}

function remember(id: number | null) {
  try {
    if (id === null) localStorage.removeItem(FOCUS_KEY);
    else localStorage.setItem(FOCUS_KEY, String(id));
  } catch {
    // Not kept on this device: the choice still holds until the app is closed.
  }
}

const initialState: AuthState = {
  checked: false, me: null, notAParent: false, focusChildId: rememberedChild(),
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    meLoaded(state, action: PayloadAction<MeData>) {
      state.me = action.payload;
      state.checked = true;
      state.notAParent = false;
      // A child kept from another account on this device, or one since unlinked, is not this parent's.
      if (!action.payload.children.some((child) => child.id === state.focusChildId)) {
        state.focusChildId = null;
      }
    },
    childFocused(state, action: PayloadAction<number>) {
      state.focusChildId = action.payload;
      remember(action.payload);
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
      state.focusChildId = null;
      remember(null);
    },
    signInStarted(state) {
      state.notAParent = false;
    },
  },
});

export const { childFocused, meLoaded, meRefused, sessionEnded, signInStarted } = authSlice.actions;
export const authReducer = authSlice.reducer;
