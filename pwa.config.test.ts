import { describe, expect, it } from "vitest";

import { workboxOptions } from "./pwa.config";

/**
 * The service worker's cache is shared across parents who might sign in on
 * the same browser, so it must never hold an API answer or an uploaded file,
 * and its fallback page must be this app's, not school-fe's or student-fe's
 * on the same origin.
 */
describe("service worker caching", () => {
  it("has no runtime caching rule, so no API answer is ever cached", () => {
    expect(workboxOptions.runtimeCaching).toEqual([]);
  });

  it("never answers an API or media address with the app's page", () => {
    const denied = (url: string) =>
      workboxOptions.navigateFallbackDenylist.some((rule) => rule.test(url));
    expect(denied("/v1/portal/parent/home/")).toBe(true);
    expect(denied("/media/students/photo.jpg")).toBe(true);
  });

  it("falls back only within the parent app", () => {
    const allowed = (url: string) =>
      workboxOptions.navigateFallbackAllowlist.some((rule) => rule.test(url));
    expect(workboxOptions.navigateFallback).toBe("/parent/index.html");
    expect(allowed("/parent/fees")).toBe(true);
    expect(allowed("/student/fees")).toBe(false);
    expect(allowed("/overview")).toBe(false);
  });
});
