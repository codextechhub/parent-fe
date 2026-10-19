import { baseApi } from "./base-api";

/**
 * The school's public face, readable before anybody signs in: its display name
 * by slug. The install card asks for it when the manifest cannot be read, so a
 * parent on a flaky connection still sees the school's name under the icon.
 * The crest is an image address (`schoolLogoUrl`), not a query.
 */
export const schoolApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    schoolName: build.query<string, string>({
      query: (slug) => `/i/public/schools/${encodeURIComponent(slug)}/name/`,
      transformResponse: (body: { name?: string }) => body?.name ?? "",
    }),
  }),
});

export const { useSchoolNameQuery } = schoolApi;
