import { afterEach, describe, expect, it, vi } from "vitest";

import { lookUpSchool } from "./school-lookup";

afterEach(() => vi.unstubAllGlobals());

const answer = (status: number, body: unknown = {}) =>
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(body), { status })));

describe("lookUpSchool", () => {
  it("asks the public name route for the code and returns the school's name", async () => {
    answer(200, { name: "Meridian Crest Academy" });
    expect(await lookUpSchool("meridian")).toEqual({ ok: true, name: "Meridian Crest Academy" });
    const [address] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(String(address)).toBe("http://test.local/v1/i/public/schools/meridian/name/");
  });

  it("says there is no such school on a 404", async () => {
    answer(404);
    expect(await lookUpSchool("nowhere")).toEqual({ ok: false, reason: "not-found" });
  });

  it("does not call a busy server or a lost connection a missing school", async () => {
    answer(503);
    expect(await lookUpSchool("meridian")).toEqual({ ok: false, reason: "unreachable" });
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("Failed to fetch"); }));
    expect(await lookUpSchool("meridian")).toEqual({ ok: false, reason: "unreachable" });
  });
});
