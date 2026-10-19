import { configureStore } from "@reduxjs/toolkit";
import { setupListeners } from "@reduxjs/toolkit/query";

import { baseApi } from "./services/base-api";

/**
 * The app's one store.
 *
 * Phase 1 scaffold: only the RTK Query root is wired in. Session, child
 * switcher and connectivity slices arrive with Phase 2+; a parent that
 * reopens the app expects their last read to be there, so `setupListeners`
 * is kept here too.
 */
export const store = configureStore({
  reducer: {
    [baseApi.reducerPath]: baseApi.reducer,
  },
  middleware: (getDefault) => getDefault().concat(baseApi.middleware),
});

setupListeners(store.dispatch);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
