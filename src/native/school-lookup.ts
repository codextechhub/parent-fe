import { timeoutSignal } from "@/lib/request-timeout";
import { schoolNameUrl } from "@/utils/school-brand";

/**
 * What the school's public name route says about a code.
 *
 * - `ok`: the school exists, with this display name.
 * - `not-found`: the API answered 404, so no school has this code.
 * - `unreachable`: no answer, or an answer that decided nothing (a busy
 *   server, a lost connection). The code may still be right.
 */
export type SchoolLookup =
  | { ok: true; name: string }
  | { ok: false; reason: "not-found" | "unreachable" };

/** Asks the API whether `code` names a school that can sign people in, before anybody is signed in. */
export async function lookUpSchool(code: string): Promise<SchoolLookup> {
  const address = schoolNameUrl(code);
  if (!address) return { ok: false, reason: "not-found" };
  let response: Response;
  try {
    response = await fetch(address, { headers: { accept: "application/json" }, credentials: "omit", signal: timeoutSignal() });
  } catch {
    return { ok: false, reason: "unreachable" };
  }
  if (response.status === 404) return { ok: false, reason: "not-found" };
  if (!response.ok) return { ok: false, reason: "unreachable" };
  try {
    const body = (await response.json()) as { name?: string; data?: { name?: string } };
    const name = (body.name ?? body.data?.name ?? "").trim();
    return name ? { ok: true, name } : { ok: false, reason: "unreachable" };
  } catch {
    return { ok: false, reason: "unreachable" };
  }
}
