import { describe, it, expect } from "vitest";
import { normalizePlan, MAX_TITLE_SUBTITLE } from "../src/planner/plan.js";

const subjects = (n: number) => Array.from({ length: n }, (_, i) => ({ subject: `cat scene ${i}` }));

describe("normalizePlan", () => {
  it("dedupes subjects, renumbers and caps to the wanted count", () => {
    const plan = normalizePlan(
      { title: "Cozy Cats Coloring Book", pages: [{ subject: "A cat napping" }, { subject: "a cat  napping!" }, ...subjects(30)] },
      30
    );
    expect(plan.pages).toHaveLength(30);
    expect(plan.pages[0]).toEqual({ index: 1, subject: "A cat napping" });
    expect(plan.pages[1]?.subject).toBe("cat scene 0");
    expect(plan.pages.at(-1)?.index).toBe(30);
  });

  it("caps keywords to 7 unique slots of <= 50 chars", () => {
    const plan = normalizePlan(
      { title: "T", pages: subjects(10), keywords: ["a", "A", "b", "c", "d", "e", "f", "g", "h", "x".repeat(80)] },
      10
    );
    expect(plan.keywords).toEqual(["a", "b", "c", "d", "e", "f", "g"]);
    const long = normalizePlan({ title: "T", pages: subjects(10), keywords: ["x".repeat(80)] }, 10);
    expect(long.keywords[0]).toHaveLength(50);
  });

  it("trims the subtitle on a word boundary so title + subtitle fits KDP's limit", () => {
    const title = "T".repeat(150);
    const plan = normalizePlan({ title, subtitle: "word ".repeat(30), pages: subjects(10) }, 10);
    expect(title.length + 1 + plan.subtitle.length).toBeLessThanOrEqual(MAX_TITLE_SUBTITLE);
    expect(plan.subtitle.endsWith("word")).toBe(true);
  });

  it("rejects a plan with too few distinct pages or no title", () => {
    expect(() => normalizePlan({ title: "T", pages: subjects(5) }, 30)).toThrow();
    expect(() => normalizePlan({ pages: subjects(30) }, 30)).toThrow();
  });
});
