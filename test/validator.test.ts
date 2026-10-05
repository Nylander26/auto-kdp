import { describe, it, expect } from "vitest";
import { inkCheck, normalizeValidation } from "../src/validator/criteria.js";
import { getConfig } from "../src/lib/config.js";

const v = getConfig().validator;
const scores = (overall: number) => ({ lineQuality: 8, colorability: 8, subjectFidelity: 8, audienceFit: 8, overall });

describe("normalizeValidation", () => {
  it("derives the verdict from configured thresholds, not the model's word", () => {
    expect(normalizeValidation({ verdict: "rejected", scores: scores(v.approval_threshold) }, "m").verdict).toBe("approved");
    expect(normalizeValidation({ verdict: "approved", scores: scores(v.borderline_threshold) }, "m").verdict).toBe("borderline");
    expect(normalizeValidation({ scores: scores(1) }, "m").verdict).toBe("rejected");
  });

  it("a listed blocker forces rejection even with generous scores", () => {
    const r = normalizeValidation({ scores: scores(9), reasons: { strengths: [], concerns: [], blockers: ["text in image"] } }, "m");
    expect(r.verdict).toBe("rejected");
    expect(r.reasons.blockers).toEqual(["text in image"]);
  });

  it("clamps garbage scores", () => {
    const r = normalizeValidation({ scores: { overall: 42, lineQuality: -3 } }, "m");
    expect(r.scores.overall).toBe(10);
    expect(r.scores.lineQuality).toBe(1);
    expect(r.scores.colorability).toBe(5);
  });
});

describe("inkCheck", () => {
  it("passes normal pages and rejects empty / heavy-black ones without an API call", () => {
    expect(inkCheck(0.1)).toBeNull();
    expect(inkCheck(0.001)?.verdict).toBe("rejected");
    expect(inkCheck(0.6)?.reasons.blockers[0]).toMatch(/solid black/);
  });
});
