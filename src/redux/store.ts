import { configureStore } from "@reduxjs/toolkit";
import { setupListeners } from "@reduxjs/toolkit/query";

import { authReducer } from "./features/auth-slice";
import { connectivityReducer } from "./features/connectivity-slice";
import { baseApi } from "./services/base-api";
// Side-effect import: registering endpoints on the base API.
import "./services/portal-api";

/**
 * The app's one store.
 *
 * - `baseApi` holds the RTK Query cache for every portal read and write.
 * - `auth` holds the signed-in parent (`me`) and the one-shot "not a parent"
 *   flag the sign-in page watches for.
 * - `connectivity` sits here so the OfflineBar reads it on every render.
 */
export const store = configureStore({
  reducer: {
    [baseApi.reducerPath]: baseApi.reducer,
    auth: authReducer,
    connectivity: connectivityReducer,
  },
  middleware: (getDefault) => getDefault().concat(baseApi.middleware),
});

setupListeners(store.dispatch);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
