import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { homeScreenLabel, schoolManifestUrl, touchIconFrom } from "./school-app";

const host = vi.hoisted(() => ({ slug: "meridian-crest" }));
vi.mock("@/utils/school-host", () => ({ currentSchoolSlug: () => host.slug }));

const CORONA = "/parent/app/corona/manifest.webmanifest";

describe("the school's own manifest", () => {
  it("is asked for on the app's own address, naming the school in the path", () => {
    expect(schoolManifestUrl("corona")).toBe(`${import.meta.env.BASE_URL}app/corona/manifest.webmanifest`);
  });

  it("is not asked for on an address that names no school", () => {
    expect(schoolManifestUrl("")).toBe("");
  });
});

describe("the iPhone home-screen icon", () => {
  it("uses the crest's icon when the manifest's icons sit beside it", () => {
    expect(touchIconFrom({ icons: [{ src: "icons/icon-192.png" }] }, CORONA)).toBe(
      "/parent/app/corona/icons/apple-touch-icon.png",
    );
  });

  it("uses the crest's icon when the manifest names it at the API", () => {
    expect(
      touchIconFrom({ icons: [{ src: "https://api.codexng.com/v1/portal/parent/app/corona/icons/icon-192.png" }] }, CORONA),
    ).toBe("https://api.codexng.com/v1/portal/parent/app/corona/icons/apple-touch-icon.png");
  });

  it("keeps the XVS icon for a school with no crest", () => {
    expect(touchIconFrom({ icons: [{ src: "/parent/icons/icon-192.png" }] }, CORONA)).toBe("");
    expect(touchIconFrom({}, CORONA)).toBe("");
  });
});

describe("the label under the home-screen icon", () => {
  it("is the whole name when it fits", () => {
    expect(homeScreenLabel("Bright Star")).toBe("Bright Star");
    expect(homeScreenLabel("  Bright   Star ")).toBe("Bright Star");
  });

  it("is the first word when the whole name does not fit", () => {
    expect(homeScreenLabel("Meridian Crest Academy")).toBe("Meridian");
    expect(homeScreenLabel("Lagoon View Academy")).toBe("Lagoon");
  });

  it("never cuts a word in half, however long", () => {
    expect(homeScreenLabel("Ogbomosholand College")).toBe("Ogbomosholand");
    expect(homeScreenLabel("Ogbomosholand")).toBe("Ogbomosholand");
  });

  it("counts letters, not bytes, in any script", () => {
    // 12 letters with accents: fits whole.
    expect(homeScreenLabel("École Sainté")).toBe("École Sainté");
    expect(homeScreenLabel("Ọmọlúàbí Academy")).toBe("Ọmọlúàbí");
    expect(homeScreenLabel("学校 星光")).toBe("学校 星光");
  });
});

describe("naming the page after the school", () => {
  const meta = (name: string) =>
    document.head.querySelector<HTMLMetaElement>(`meta[name="${name}"]`)?.content;

  /** A fresh copy of the module, since it remembers the name it last set. */
  const load = async () => {
    vi.resetModules();
    return import("./school-app");
  };

  const answer = (body: unknown, ok = true) =>
    vi.fn(async () => ({ ok, json: async () => body }) as Response);

  beforeEach(() => {
    host.slug = "meridian-crest";
    document.title = "XVS Parent";
    document.head.querySelectorAll("meta[name]").forEach((m) => m.remove());
    localStorage.clear();
  });

  afterEach(() => vi.unstubAllGlobals());

  it("names the app after the school's own name in its manifest", async () => {
    vi.stubGlobal("fetch", answer({
      name: "Meridian Crest Academy Parent", short_name: "Meridian Parent",
      school_name: "Meridian Crest Academy",
    }));
    const { applySchoolApp, schoolFullName, schoolAppName } = await load();
    const readName = vi.fn();
    await applySchoolApp(readName);
    expect(document.title).toBe("Meridian Crest Academy Parent");
    expect(meta("apple-mobile-web-app-title")).toBe("Meridian Parent");
    expect(meta("application-name")).toBe("Meridian Parent");
    expect([schoolFullName(), schoolAppName()]).toEqual(["Meridian Crest Academy", "Meridian Parent"]);
    expect(readName).not.toHaveBeenCalled();
  });

  it("reads the school's name from a manifest that does not name it apart", async () => {
    vi.stubGlobal("fetch", answer({ name: "Bright Star" }));
    const { applySchoolApp, schoolFullName } = await load();
    await applySchoolApp();
    expect(document.title).toBe("Bright Star Parent");
    expect(meta("apple-mobile-web-app-title")).toBe("Bright Star Parent");
    expect(schoolFullName()).toBe("Bright Star");
  });

  it("falls back to the school's public name when the manifest cannot be had", async () => {
    vi.stubGlobal("fetch", answer({}, false));
    const { applySchoolApp } = await load();
    const readName = vi.fn(async () => "Meridian Crest Academy");
    await applySchoolApp(readName);
    expect(readName).toHaveBeenCalledWith("meridian-crest");
    expect(document.title).toBe("Meridian Crest Academy Parent");
    expect(meta("apple-mobile-web-app-title")).toBe("Meridian Parent");
    expect(meta("application-name")).toBe("Meridian Parent");
  });

  it("names the next start at once, before anything is fetched", async () => {
    vi.stubGlobal("fetch", answer({ school_name: "Meridian Crest Academy" }));
    await (await load()).applySchoolApp();
    document.title = "XVS Parent";

    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(() => {})));
    void (await load()).applySchoolApp();
    expect(document.title).toBe("Meridian Crest Academy Parent");
    expect(meta("apple-mobile-web-app-title")).toBe("Meridian Parent");
  });

  it("does not carry one school's name to another school's address", async () => {
    vi.stubGlobal("fetch", answer({ name: "Meridian Crest Academy" }));
    await (await load()).applySchoolApp();
    document.title = "XVS Parent";

    host.slug = "bright-star";
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(() => {})));
    void (await load()).applySchoolApp();
    expect(document.title).toBe("XVS Parent");
  });

  it("stays XVS Parent on an address that names no school", async () => {
    host.slug = "";
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const readName = vi.fn();
    await (await load()).applySchoolApp(readName);
    expect(document.title).toBe("XVS Parent");
    expect(meta("apple-mobile-web-app-title")).toBeUndefined();
    expect(fetch).not.toHaveBeenCalled();
    expect(readName).not.toHaveBeenCalled();
  });

  it("stays XVS Parent when no name can be had at all", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new TypeError("offline"))));
    await (await load()).applySchoolApp(async () => Promise.reject(new Error("offline")));
    expect(document.title).toBe("XVS Parent");
  });
});
