import { describe, it, expect } from "vitest";
import sharp from "sharp";
import { frameCheck, inkCheck, normalizeValidation } from "../src/validator/criteria.js";
import { cropFrame, frameCoverage } from "../src/postprocess/line-art.js";
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

const svgPage = (body: string) =>
  sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="400" height="500"><rect width="400" height="500" fill="#fff"/>${body}</svg>`)).png().toBuffer();
const tree = `<path d="M200 80 L300 380 L100 380 Z" fill="none" stroke="#000" stroke-width="8"/><line x1="40" y1="420" x2="360" y2="420" stroke="#000" stroke-width="6"/>`;

describe("frame pre-check", () => {
  it("rejects artwork boxed in by a page border without an API call", async () => {
    const framed = await svgPage(`<rect x="20" y="20" width="360" height="460" rx="12" fill="none" stroke="#000" stroke-width="8"/>${tree}`);
    const r = frameCheck(await frameCoverage(framed));
    expect(r?.verdict).toBe("rejected");
    expect(r?.reasons.blockers[0]).toMatch(/border/);
  });

  it("cropFrame removes a drawn border and leaves open artwork untouched", async () => {
    const framed = await svgPage(`<rect x="20" y="20" width="360" height="460" rx="12" fill="none" stroke="#000" stroke-width="8"/>${tree}`);
    const cropped = await cropFrame(framed, v.max_frame_coverage);
    expect(await frameCoverage(cropped)).toBeLessThan(v.max_frame_coverage);
    const open = await svgPage(tree);
    expect(await cropFrame(open, v.max_frame_coverage)).toBe(open);
  });

  it("passes open artwork, even with a ground line spanning the width", async () => {
    expect(frameCheck(await frameCoverage(await svgPage(tree)))).toBeNull();
  });
});
