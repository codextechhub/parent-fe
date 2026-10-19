import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

/**
 * Whether the school can be reached, and how old what is on screen is.
 *
 * `offline` turns on when a read fails for want of a connection and is
 * answered from a kept copy; `lastUpdated` is the oldest moment among the
 * answers shown. Phase 2 does not yet keep offline copies, so this slice is
 * wired for the OfflineBar but only navigator.onLine toggles it today.
 */
export type ConnectivityState = { offline: boolean; lastUpdated: number | null };

const initialState: ConnectivityState = {
  offline: typeof navigator !== "undefined" && navigator.onLine === false,
  lastUpdated: null,
};

const connectivitySlice = createSlice({
  name: "connectivity",
  initialState,
  reducers: {
    servedFromCopy(state, action: PayloadAction<number>) {
      state.offline = true;
      state.lastUpdated =
        state.lastUpdated === null ? action.payload : Math.min(state.lastUpdated, action.payload);
    },
    wentOffline(state) {
      state.offline = true;
    },
    reachedSchool(state) {
      state.offline = false;
      state.lastUpdated = null;
    },
  },
});

export const { servedFromCopy, wentOffline, reachedSchool } = connectivitySlice.actions;
export const connectivityReducer = connectivitySlice.reducer;
