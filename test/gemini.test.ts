import { describe, it, expect } from "vitest";
import type { GenerateContentResult } from "@google/generative-ai";
import { noImageReason } from "../src/lib/gemini.js";

const result = (response: object) => ({ response }) as unknown as GenerateContentResult;

describe("noImageReason", () => {
  it("names a safety block so the subject gets changed instead of retried", () => {
    const msg = noImageReason(result({ candidates: [{ finishReason: "PROHIBITED_CONTENT", content: { parts: [] } }] }));
    expect(msg).toMatch(/PROHIBITED_CONTENT/);
    expect(msg).toMatch(/change the subject/);
  });

  it("names a blocked prompt", () => {
    expect(noImageReason(result({ promptFeedback: { blockReason: "SAFETY" }, candidates: [] }))).toMatch(/prompt blocked \(SAFETY\)/);
  });

  it("quotes the model's text when it answered with words instead of an image", () => {
    const msg = noImageReason(result({ candidates: [{ finishReason: "STOP", content: { parts: [{ text: "I can't draw that." }] } }] }));
    expect(msg).toMatch(/text-only response\): I can't draw that\./);
  });
});
