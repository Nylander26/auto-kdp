import { describe, it, expect } from "vitest";
import { buildCoverPrompt, buildPagePrompt } from "../src/generator/prompts.js";
import { buildPlanPrompt } from "../src/planner/plan.js";
import { buildValidatorPrompt } from "../src/validator/criteria.js";
import { parseAudience } from "../src/lib/types.js";

describe("bold-easy audience", () => {
  it("page prompt asks for thick lines and big shapes, never intricate detail", () => {
    const p = buildPagePrompt("a mug of cocoa by the fireplace", "cozy christmas", "bold-easy");
    expect(p).toMatch(/thick bold outlines/);
    expect(p).toMatch(/large simple shapes/);
    expect(p).not.toMatch(/intricate/);
  });

  it("adults stays intricate", () => {
    expect(buildPagePrompt("s", "g", "adults")).toMatch(/intricate/);
  });

  it("cover, plan and validator prompts name the audience", () => {
    expect(buildCoverPrompt("c", "g", "bold-easy")).toMatch(/bold and easy adult coloring book/);
    expect(buildPlanPrompt("cozy christmas", "bold-easy", 30, "US")).toMatch(/bold and easy/);
    expect(buildValidatorPrompt("s", "g", "bold-easy")).toMatch(/not babyish|rather than babyish/);
  });

  it("parseAudience validates the CLI flag", () => {
    expect(parseAudience("bold-easy")).toBe("bold-easy");
    expect(parseAudience(undefined)).toBeUndefined();
    expect(() => parseAudience("teens")).toThrow();
  });
});
