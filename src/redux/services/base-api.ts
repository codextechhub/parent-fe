import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";

/**
 * The API every parent screen will talk through.
 *
 * Phase 1 scaffold: a minimal RTK Query root that reaches the backend at the
 * configured base URL and sends cookies. Sign-in, the per-child header switch
 * and the offline copy ride on top of this in later phases, and will add
 * their own prepareHeaders and base query wrappers; keep this surface narrow
 * until then so the scaffold builds without the auth, offline and connectivity
 * modules the student app also carries.
 */
const API_BASE = (import.meta.env.VITE_BACKEND_URL as string) || "/v1";

export const baseApi = createApi({
  reducerPath: "api",
  baseQuery: fetchBaseQuery({ baseUrl: API_BASE, credentials: "include" }),
  tagTypes: [],
  endpoints: () => ({}),
});
