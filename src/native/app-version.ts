import { API_BASE } from "@/auth/api";

/**
 * The store app's version check.
 *
 * The API holds a policy per app and store (`GET /v1/app-versions/`): the
 * lowest version still supported, the newest published one, and the store
 * page. The app sends the version it is and is told one of three things:
 * `update_required` (this version is no longer supported), `update_available`
 * (a newer one is published) or `current`.
 *
 * Nothing here may stop a parent getting into the app on a doubt. A 404 means
 * the API has no policy yet, and a lost connection, a busy server or an
 * answer that is not a policy decide nothing: the app carries on.
 */

export const APP_ID = "com.codexng.xvs.parent";

/** The most often the app asks while it stays open: it asks again on returning to it after this long. */
export const CHECK_EVERY_MS = 4 * 60 * 60 * 1000;

const DISMISSED_KEY = "xvs.parent.update-dismissed";

export type VersionStatus = "update_required" | "update_available" | "current";

export type VersionPolicy = {
  app: string;
  platform: string;
  minimum: string;
  latest: string;
  store_url: string;
  status: VersionStatus;
};

/** What to put in front of the parent: nothing, a screen that blocks, or a note that can be dismissed. */
export type VersionNotice =
  | { kind: "required"; storeUrl: string }
  | { kind: "available"; latest: string; storeUrl: string }
  | null;

const STATUSES = new Set<string>(["update_required", "update_available", "current"]);

/** What the API said about this build: a policy, that it has none (404), or nothing usable. */
export type PolicyAnswer = { kind: "policy"; policy: VersionPolicy } | { kind: "none" } | { kind: "unknown" };

/**
 * Asks the API for this build's policy.
 *
 * `unknown` covers every way of not having an answer: no connection, a failing
 * server and a body that is not a policy. Only a 404 says the API has no policy.
 */
export async function fetchVersionPolicy(
  platform: string,
  version: string,
  fetcher: typeof fetch = fetch,
): Promise<PolicyAnswer> {
  const query = new URLSearchParams({ app: APP_ID, platform, version });
  try {
    const response = await fetcher(`${API_BASE}/app-versions/?${query}`, {
      headers: { accept: "application/json" },
      credentials: "omit",
    });
    if (response.status === 404) return { kind: "none" };
    if (!response.ok) return { kind: "unknown" };
    const body = (await response.json()) as Partial<VersionPolicy> & { data?: Partial<VersionPolicy> };
    const policy = body.status ? body : (body.data ?? {});
    if (!policy.status || !STATUSES.has(policy.status)) return { kind: "unknown" };
    return {
      kind: "policy",
      policy: {
        app: policy.app ?? APP_ID,
        platform: policy.platform ?? platform,
        minimum: policy.minimum ?? "",
        latest: policy.latest ?? "",
        store_url: policy.store_url ?? "",
        status: policy.status,
      },
    };
  } catch {
    return { kind: "unknown" };
  }
}

/**
 * What a policy asks of the parent.
 *
 * A required update is never dismissed. An available one is shown unless the
 * parent already dismissed this very `latest`; a newer release brings the note
 * back.
 */
export function decideNotice(policy: VersionPolicy, dismissedLatest: string | null): VersionNotice {
  if (policy.status === "update_required") return { kind: "required", storeUrl: policy.store_url };
  if (policy.status === "update_available" && policy.latest !== dismissedLatest) {
    return { kind: "available", latest: policy.latest, storeUrl: policy.store_url };
  }
  return null;
}

/** Whether enough time has passed since the last check to ask again on returning to the app. */
export function shouldCheckAgain(lastCheckedAt: number | null, now: number, gapMs: number = CHECK_EVERY_MS): boolean {
  return lastCheckedAt === null || now - lastCheckedAt >= gapMs;
}

/** The `latest` version the parent last dismissed, or null. */
export async function readDismissedLatest(): Promise<string | null> {
  try {
    const { Preferences } = await import("@capacitor/preferences");
    const { value } = await Preferences.get({ key: DISMISSED_KEY });
    return value || null;
  } catch {
    return null;
  }
}

/** Remembers that the parent dismissed the note for `latest`, so it stays away until a newer one. */
export async function rememberDismissedLatest(latest: string): Promise<void> {
  try {
    const { Preferences } = await import("@capacitor/preferences");
    await Preferences.set({ key: DISMISSED_KEY, value: latest });
  } catch {
    // The note may come back next time; that is all.
  }
}

/** The version this build reports, read from the native shell. */
export async function installedVersion(): Promise<string> {
  const { App } = await import("@capacitor/app");
  return (await App.getInfo()).version;
}

/**
 * Asks the API and decides what to show.
 *
 * Returns `undefined` when there was no definite answer to act on (the version
 * could not be read, or the API could not be reached): the caller keeps
 * whatever it was already showing. A 404 and a `current` answer both return
 * `null`: nothing to show.
 */
export async function checkForUpdate(
  platform: string,
  readVersion: () => Promise<string> = installedVersion,
  fetcher: typeof fetch = fetch,
): Promise<VersionNotice | undefined> {
  let version: string;
  try {
    version = await readVersion();
  } catch {
    return undefined;
  }
  const answer = await fetchVersionPolicy(platform, version, fetcher);
  if (answer.kind === "unknown") return undefined;
  if (answer.kind === "none") return null;
  return decideNotice(answer.policy, await readDismissedLatest());
}
