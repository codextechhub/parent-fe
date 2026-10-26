import { describe, expect, it } from "vitest";

import { decideLink, parseSchoolLink } from "./app-links";

describe("parseSchoolLink", () => {
  it("reads the school from the left label and drops the /parent prefix", () => {
    expect(parseSchoolLink("https://meridian.xvs.codexng.com/parent/fees")).toEqual({ code: "meridian", path: "/fees" });
    expect(parseSchoolLink("https://lagoon-view.xvs-staging.codexng.com/parent/messages/12?x=1#top")).toEqual({
      code: "lagoon-view",
      path: "/messages/12?x=1#top",
    });
  });

  it("opens the home screen for /parent and /parent/", () => {
    expect(parseSchoolLink("https://meridian.xvs.codexng.com/parent")?.path).toBe("/");
    expect(parseSchoolLink("https://meridian.xvs.codexng.com/parent/")?.path).toBe("/");
  });

  it("ignores anything that is not a school's parent app", () => {
    for (const link of [
      "https://xvs.codexng.com/parent/fees",
      "https://a.b.xvs.codexng.com/parent/fees",
      "https://www.xvs.codexng.com/parent/fees",
      "https://meridian.example.com/parent/fees",
      "https://meridian.xvs.codexng.com.evil.com/parent/fees",
      "https://evilxvs.codexng.com/parent/fees",
      "http://meridian.xvs.codexng.com/parent/fees",
      "https://meridian.xvs.codexng.com/parentship",
      "https://meridian.xvs.codexng.com/login",
      "capacitor://localhost/fees",
      "not a link",
    ]) {
      expect(parseSchoolLink(link), link).toBeNull();
    }
  });
});

describe("a receipt link", () => {
  it("opens the receipt screen without the /parent prefix", () => {
    expect(parseSchoolLink("https://meridian.xvs.codexng.com/parent/fees/receipts/77")).toEqual({ code: "meridian", path: "/fees/receipts/77" });
    expect(decideLink("https://meridian.xvs.codexng.com/parent/fees/receipts/77", "meridian")).toEqual({ kind: "go", path: "/fees/receipts/77" });
  });
});

describe("decideLink", () => {
  const link = "https://meridian.xvs.codexng.com/parent/fees";

  it("goes straight to the screen when the link is for the school the app is set to", () => {
    expect(decideLink(link, "meridian")).toEqual({ kind: "go", path: "/fees" });
  });

  it("asks before switching to another school", () => {
    expect(decideLink(link, "lagoon-view")).toEqual({
      kind: "confirm",
      code: "meridian",
      path: "/fees",
      switching: true,
    });
  });

  it("asks before adopting the link's school when none is chosen", () => {
    expect(decideLink(link, "")).toEqual({ kind: "confirm", code: "meridian", path: "/fees", switching: false });
  });

  it("ignores a host that is not a school", () => {
    expect(decideLink("https://example.com/parent/fees", "meridian")).toEqual({ kind: "ignore" });
  });
});
