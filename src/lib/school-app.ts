import { currentSchoolSlug } from "@/utils/school-host";

/**
 * The installed app's name and icons: the school's own, where it has them.
 *
 * The backend serves each school's manifest (its name, and icons cut from its
 * crest) at `/v1/portal/parent/app/<slug>/manifest.webmanifest`. The app asks
 * for it on its own address, `/parent/app/<slug>/manifest.webmanifest`, which
 * the host passes through to the API. The school is named in the path because
 * a static host's rules cannot read which school's address was asked for.
 * When that manifest arrives, the page's manifest link is pointed at it;
 * until then, or when it cannot be had, the XVS manifest in `index.html`
 * stays, so the app can always be installed.
 *
 * iOS ignores the manifest's icons and reads `<link rel="apple-touch-icon">`
 * when somebody adds the app to the Home Screen. The backend draws a 180px
 * icon from the crest beside the manifest's icons, only for a school that has
 * a crest; a school without one lists this app's own XVS icons under
 * `/parent/icons/`, and the XVS touch icon stays.
 *
 * iOS ignores the manifest's names too: Add to Home Screen labels the icon
 * from `<meta name="apple-mobile-web-app-title">`, else the page's title, and
 * the app switcher shows the title. So the page carries the school's full
 * name as its title ("Meridian Crest Academy") and the home-screen label
 * ("Meridian") in that meta and in `application-name`, the same label the
 * backend puts in the manifest's `short_name` for Android. They come from the
 * manifest, else from the school's public name, and are kept per school so
 * the next start, offline included, is named before anything is fetched.
 * An address that names no school stays "XVS Parent", as `index.html` has it.
 */
type Manifest = { name?: string; short_name?: string; icons?: { src?: string }[] };

/** The most a home screen shows under an icon; the backend's `SHORT_NAME_LENGTH`. */
const LABEL_LENGTH = 12;

/** Where the last name read for a school is kept, so the next start has it at once. */
const KEPT_NAME_KEY = "xvs.parent.school-name";

let fullName = "";
let appName = "";
const nameListeners = new Set<() => void>();

/** The school's full name, or "" before it is read. */
export function schoolFullName(): string {
  return fullName;
}

/** The name under the school's icon ("Meridian"), or "" before it is read. */
export function schoolAppName(): string {
  return appName;
}

export function subscribeSchoolName(listener: () => void): () => void {
  nameListeners.add(listener);
  return () => nameListeners.delete(listener);
}

/**
 * The school's name as a home screen shows it under the icon: the whole name
 * when it fits, else its first word, never part of a word. "Bright Star"
 * stays whole, "Meridian Crest Academy" is "Meridian". Counted in code points,
 * as the backend's `short_name()` counts, so Android and iPhone agree.
 */
export function homeScreenLabel(name: string): string {
  const whole = name.trim().split(/\s+/).join(" ");
  if ([...whole].length <= LABEL_LENGTH) return whole;
  return whole.split(" ")[0];
}

function setMeta(name: string, content: string) {
  let meta = document.head.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
  if (!meta) {
    meta = document.createElement("meta");
    meta.name = name;
    document.head.append(meta);
  }
  meta.content = content;
}

/** Names the page after the school: its full name as the title, its label under the icon. */
export function nameThePage(name: string, label: string = homeScreenLabel(name)): void {
  const full = name.trim();
  if (!full) return;
  const short = label.trim() || homeScreenLabel(full);
  document.title = full;
  setMeta("apple-mobile-web-app-title", short);
  setMeta("application-name", short);
  fullName = full;
  appName = short;
  for (const listener of nameListeners) listener();
}

type KeptName = { slug: string; name: string; label: string };

function keptName(slug: string): KeptName | null {
  try {
    const kept = JSON.parse(localStorage.getItem(KEPT_NAME_KEY) ?? "null") as KeptName | null;
    return kept?.slug === slug && kept.name ? kept : null;
  } catch {
    return null;
  }
}

function keepName(kept: KeptName) {
  try {
    localStorage.setItem(KEPT_NAME_KEY, JSON.stringify(kept));
  } catch {
    // Not kept: the next start is named once the name is read again.
  }
}

/** Where this school's manifest is asked for, or "" on an address that names no school. */
export function schoolManifestUrl(slug: string = currentSchoolSlug()): string {
  return slug ? `${import.meta.env.BASE_URL}app/${encodeURIComponent(slug)}/manifest.webmanifest` : "";
}

/** The crest's touch icon for a manifest read from `manifestUrl`, or "" to keep the XVS one. */
export function touchIconFrom(manifest: Manifest, manifestUrl: string): string {
  const src = manifest.icons?.[0]?.src ?? "";
  if (!src) return "";
  const icon = new URL(src, new URL(manifestUrl, "http://app.invalid"));
  if (icon.pathname.startsWith("/parent/icons/")) return "";
  const resolved = icon.origin === "http://app.invalid" ? icon.pathname : icon.href;
  return resolved.replace(/[^/]+$/, "apple-touch-icon.png");
}

/**
 * Points the page's manifest and touch icon at this school's own, when it has
 * them, and names the page after the school.
 *
 * `readName` asks for the school's public name, for when the manifest cannot
 * be had or names nobody.
 */
export async function applySchoolApp(readName?: (slug: string) => Promise<string>): Promise<void> {
  const slug = currentSchoolSlug();
  const url = schoolManifestUrl(slug);
  if (!url) return;
  const kept = keptName(slug);
  if (kept) nameThePage(kept.name, kept.label);

  const named = (name: string, label?: string) => {
    nameThePage(name, label);
    if (fullName) keepName({ slug, name: fullName, label: appName });
  };
  try {
    const response = await fetch(url);
    if (response.ok) {
      const manifest = (await response.json()) as Manifest;
      const manifestLink = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
      if (manifestLink) manifestLink.href = url;
      const touch = touchIconFrom(manifest, url);
      const touchLink = document.querySelector<HTMLLinkElement>('link[rel="apple-touch-icon"]');
      if (touch && touchLink) touchLink.href = touch;
      const name = (manifest.name ?? "").trim();
      if (name) return named(name, manifest.short_name);
    }
  } catch {
    // No school manifest to read: the XVS one stays, and the name is asked for below.
  }
  if (!readName) return;
  try {
    named(await readName(slug));
  } catch {
    // No name to be had: the kept one, or "XVS Parent", stays.
  }
}
