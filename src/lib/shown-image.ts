import { useAuthImageQuery } from "@/redux/services/portal-api";

/**
 * A file address as the API serves it.
 *
 * The API answers a stored file (a crest, a photograph) as `/media/...`, a
 * path on its own host, which is not this app's host in a build. A path is
 * therefore read against the API's origin, and a full address is kept.
 */
export function apiAddress(url: string): string {
  const api = new URL(import.meta.env.VITE_BACKEND_URL || "/", window.location.origin);
  return new URL(url, api.origin).href;
}

/** Whether `url` is a file the API stores, which it serves only to a signed-in reader. */
export function isStoredFile(url: string): boolean {
  if (!url || url.startsWith("blob:") || url.startsWith("data:")) return false;
  return new URL(apiAddress(url)).pathname.startsWith("/media/");
}

/**
 * A picture's address as an `<img>` can show it.
 *
 * A file the school stores (its crest, a child's photograph) is served only to
 * a signed-in reader, and an `<img>` cannot send the app's token, so such a
 * file is fetched with the token and shown from a local `blob:` address. Any
 * other address, such as the school's public crest on the sign-in page, is
 * shown as it is.
 *
 * `src` is "" when there is nothing to show: no address, or a stored file that
 * could not be had. `pending` is true while a stored file is on its way, so a
 * caller can hold the space rather than flash a stand-in.
 */
export function useShownImage(url?: string | null): { src: string; pending: boolean } {
  const address = url ?? "";
  const stored = isStoredFile(address);
  const { data, isLoading, isError } = useAuthImageQuery(stored ? apiAddress(address) : "", { skip: !stored });
  if (!address) return { src: "", pending: false };
  if (!stored) return { src: address, pending: false };
  return { src: isError ? "" : (data ?? ""), pending: isLoading };
}
