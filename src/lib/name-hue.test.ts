import { describe, expect, it } from "vitest";

import { childHues, hueFor, subjectHues, toneFor } from "./name-hue";

describe("a name's colour", () => {
  it("is the same every time, whatever the spacing or case", () => {
    expect(hueFor("Mr. Okafor")).toBe(hueFor("  mr. okafor "));
    expect(toneFor("Mr. Okafor")).toEqual(toneFor("Mr. Okafor"));
  });

  it("spreads different names across the hues", () => {
    const names = ["Mr. Okafor", "Mrs. Bello", "Dr. Nwosu", "School office", "Ms. Eze", "Mme. Diallo"];
    expect(new Set(names.map(hueFor)).size).toBeGreaterThan(2);
  });
});

describe("a class's subject colours", () => {
  it("gives every subject its own hue, in alphabetical order", () => {
    const hues = subjectHues(["Mathematics", "Civic Education", "Basic Science", "English Language", "Yoruba", "Mathematics"]);
    expect([...hues.keys()]).toEqual(["basic science", "civic education", "english language", "mathematics", "yoruba"]);
    expect(new Set(hues.values()).size).toBe(5);
  });
});

describe("a child's colour", () => {
  it("gives each of a family's children a different hue, in the school's order", () => {
    const hues = childHues([431, 424, 376, 349]);
    expect([...hues.keys()]).toEqual([431, 424, 376, 349]);
    expect(new Set(hues.values()).size).toBe(4);
    expect(hues.get(431)).toBe(255);
  });
});
