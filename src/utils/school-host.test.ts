import { describe, expect, it } from "vitest";

import { schoolSlugFromHostname } from "./school-host";

const BASE = "xvs.codexng.com";

describe("the school a hostname names", () => {
  it("reads the school off its own subdomain", () => {
    expect(schoolSlugFromHostname("bright-star.xvs.codexng.com", BASE)).toBe("bright-star");
    expect(schoolSlugFromHostname("corona.xvs.codexng.com", BASE)).toBe("corona");
    expect(schoolSlugFromHostname("school2024.xvs.codexng.com", BASE)).toBe("school2024");
  });

  // The whole reason this module exists. `hostname.split(".")[0]` answers "xvs"
  // here, and sending that as a tenant asserts a school that does not exist.
  it("treats the bare domain as no school, not as a school called xvs", () => {
    expect(schoolSlugFromHostname("xvs.codexng.com", BASE)).toBe("");
  });

  it("ignores case and a fully-qualified trailing dot", () => {
    expect(schoolSlugFromHostname("Bright-Star.XVS.CodexNG.com", BASE)).toBe("bright-star");
    expect(schoolSlugFromHostname("bright-star.xvs.codexng.com.", BASE)).toBe("bright-star");
    expect(schoolSlugFromHostname("xvs.codexng.com.", BASE)).toBe("");
  });

  it("refuses an address with more than one label in front of the base", () => {
    // Not "Bright Star with something in front of it" - an address nobody
    // issued. Guessing which label to believe is how the wrong tenant gets
    // asserted.
    expect(schoolSlugFromHostname("a.bright-star.xvs.codexng.com", BASE)).toBe("");
  });

  it("refuses www, which people type out of habit", () => {
    expect(schoolSlugFromHostname("www.xvs.codexng.com", BASE)).toBe("");
  });

  it("refuses a host that is not under the base domain at all", () => {
    expect(schoolSlugFromHostname("bright-star.example.com", BASE)).toBe("");
    expect(schoolSlugFromHostname("intranet.codexng.com", BASE)).toBe("");
    // A look-alike that merely ends with the same letters must not pass.
    expect(schoolSlugFromHostname("evilxvs.codexng.com", BASE)).toBe("");
    expect(schoolSlugFromHostname("bright-star.xvs.codexng.com.attacker.test", BASE)).toBe("");
  });

  it("returns nothing for a bare host, an IP, or an empty string", () => {
    expect(schoolSlugFromHostname("localhost", BASE)).toBe("");
    expect(schoolSlugFromHostname("127.0.0.1", BASE)).toBe("");
    expect(schoolSlugFromHostname("", BASE)).toBe("");
  });

  it("refuses a label that is not a legal slug", () => {
    // Underscores are refused by the backend's own slug validator, which is
    // also what stops a school ever colliding with its `__none__` sentinel.
    expect(schoolSlugFromHostname("bright_star.xvs.codexng.com", BASE)).toBe("");
    expect(schoolSlugFromHostname("-bright.xvs.codexng.com", BASE)).toBe("");
  });

  it("reads a school off *.localhost, so development rehearses production", () => {
    expect(schoolSlugFromHostname("bright-star.localhost", "localhost")).toBe("bright-star");
    expect(schoolSlugFromHostname("localhost", "localhost")).toBe("");
  });
});
