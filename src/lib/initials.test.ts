import { describe, expect, it } from "vitest";

import { initialsOf } from "./initials";

describe("a teacher's initials", () => {
  it("takes the name past any title", () => {
    expect(initialsOf("Mrs Funke Okoro")).toBe("FO");
    expect(initialsOf("School office")).toBe("SO");
  });

  it("keeps the title's letter when one word is all that is left", () => {
    expect(initialsOf("Mr. Okafor")).toBe("MO");
    expect(initialsOf("Dr Nwosu")).toBe("DN");
  });

  it("gives a mark even for a name with no letters", () => {
    expect(initialsOf("")).toBe("?");
  });
});
