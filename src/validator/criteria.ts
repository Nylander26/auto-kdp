/**
 * Coloring-page rubric. Unlike the Etsy validator ("will it sell?" — subjective),
 * this asks mostly objective questions a vision model answers well: are the lines
 * clean and closed, is there room to color, is the subject right, no glitches.
 */
import { getConfig } from "../lib/config.js";
import type { Audience, ValidationResult } from "../lib/types.js";

const WHO: Record<Audience, string> = {
  kids: "children aged 4-8",
  adults: "adults who color to relax",
  "bold-easy": "adults and seniors who want bold and easy pages",
};

const FIT: Record<Audience, string> = {
  kids: "simple and bold, nothing scary",
  adults: "detailed enough to be engaging, calming",
  "bold-easy": "thick lines and large simple shapes with few tiny details, yet grown-up and charming rather than babyish",
};

export function buildValidatorPrompt(subject: string, styleGuide: string, audience: Audience): string {
  const v = getConfig().validator;
  const who = WHO[audience];
  return `
You are the quality controller of a coloring-book publisher on Amazon KDP. You inspect one interior page (already converted to pure black and white) for a book aimed at ${who}.

Planned subject: "${subject}"
Book art direction: "${styleGuide}"

Score 1-10:
1. lineQuality — crisp, continuous, consistent black outlines; no broken/sketchy lines, no blobs, no noise specks.
2. colorability — shapes are CLOSED regions with enough room to color for ${who}; no large solid black areas, no hatching/stippling that leaves nothing to color, no tiny unusable fragments.
3. subjectFidelity — clearly depicts the planned subject; anatomy is correct (extra/missing limbs, fingers, eyes = blocker); no melted or merged objects.
4. audienceFit — complexity matches ${who} (${FIT[audience]}).
5. overall — weighted judgement; cap at 5 if any score is <= 3.

HARD BLOCKERS (verdict "rejected", overall <= 4): any text/letters/watermark; a page border/frame; anatomy errors; the artwork cut off at an edge; mostly empty page.

Return strict JSON:
{
  "verdict": "approved" | "borderline" | "rejected",
  "scores": { "lineQuality": n, "colorability": n, "subjectFidelity": n, "audienceFit": n, "overall": n },
  "reasons": { "strengths": [..1-3], "concerns": [..0-3], "blockers": [..0-4] },
  "suggestedImprovements": [2-4 concrete instructions for regenerating this page]
}

Thresholds: overall >= ${v.approval_threshold} approved; >= ${v.borderline_threshold} borderline; else rejected.
Be strict — a buyer leaves a 1-star review for a single broken page.
`.trim();
}

type RawValidation = Partial<Omit<ValidationResult, "scores">> & { scores?: Partial<ValidationResult["scores"]> };

/** Coerces model output; the verdict is re-derived from overall + configured thresholds. */
export function normalizeValidation(raw: RawValidation, modelName: string): ValidationResult {
  const cfg = getConfig().validator;
  const scores = {
    lineQuality: clamp(raw.scores?.lineQuality),
    colorability: clamp(raw.scores?.colorability),
    subjectFidelity: clamp(raw.scores?.subjectFidelity),
    audienceFit: clamp(raw.scores?.audienceFit),
    overall: clamp(raw.scores?.overall),
  };
  const blockers = raw.reasons?.blockers ?? [];
  // A blocker the model listed always wins, even when its numbers were generous.
  if (blockers.length > 0) scores.overall = Math.min(scores.overall, cfg.borderline_threshold - 0.5);

  let verdict: ValidationResult["verdict"];
  if (scores.overall >= cfg.approval_threshold) verdict = "approved";
  else if (scores.overall >= cfg.borderline_threshold) verdict = "borderline";
  else verdict = "rejected";

  return {
    verdict,
    scores,
    reasons: {
      strengths: raw.reasons?.strengths ?? [],
      concerns: raw.reasons?.concerns ?? [],
      blockers: verdict === "rejected" ? blockers : [],
    },
    suggestedImprovements: raw.suggestedImprovements ?? [],
    evaluatedAt: new Date().toISOString(),
    model: modelName,
  };
}

/** Deterministic pre-check: rejects without spending a vision call. null = passes. */
export function inkCheck(coverage: number): ValidationResult | null {
  const cfg = getConfig().validator;
  let blocker: string | null = null;
  let hint = "";
  if (coverage < cfg.min_ink_coverage) {
    blocker = `page nearly empty (${(coverage * 100).toFixed(1)}% ink)`;
    hint = "fill the whole frame with the illustration and a detailed background";
  } else if (coverage > cfg.max_ink_coverage) {
    blocker = `too much solid black (${(coverage * 100).toFixed(1)}% ink)`;
    hint = "use outlines only — no solid black fills, no dark backgrounds, no shading";
  }
  if (!blocker) return null;
  return {
    verdict: "rejected",
    scores: { lineQuality: 1, colorability: 1, subjectFidelity: 1, audienceFit: 1, overall: 1 },
    reasons: { strengths: [], concerns: [], blockers: [blocker] },
    suggestedImprovements: [hint],
    evaluatedAt: new Date().toISOString(),
    model: "ink-coverage",
  };
}

function clamp(v: number | undefined): number {
  const n = typeof v === "number" && isFinite(v) ? v : 5;
  return Math.min(10, Math.max(1, n));
}
