import type { Audience } from "../lib/types.js";

const AUDIENCE_STYLE: Record<Audience, string> = {
  kids: "thick bold outlines, large simple shapes with plenty of room to color, cute friendly characters, minimal background",
  adults: "intricate detailed line work with medium-weight outlines, rich patterns and textures drawn as lines, full composition with a detailed background",
};

/** Prompt for one interior page. The negatives matter more than the subject. */
export function buildPagePrompt(subject: string, styleGuide: string, audience: Audience, improvementHints: string[] = []): string {
  const hints =
    improvementHints.length > 0
      ? `\nFix these problems from the previous attempt:\n${improvementHints.map((h) => `- ${h}`).join("\n")}`
      : "";
  return `
Black-and-white coloring book page. Portrait orientation, the illustration fills the frame.
Subject: ${subject}.
Art direction (shared by every page of this book): ${styleGuide}.
Line style: ${AUDIENCE_STYLE[audience]}.
Requirements: pure black outlines on a pure white background; every shape is a closed outline that can be colored in; NO shading, NO gray tones, NO gradients, NO hatching or stippling, NO solid black fills, NO color; NO text, letters, numbers, signatures or watermarks; NO page border or frame.
Anatomy must be correct (count fingers, legs, eyes).${hints}
`.trim();
}

/** Full-color cover illustration. Text is overlaid later in the PDF, never drawn. */
export function buildCoverPrompt(coverConcept: string, styleGuide: string, audience: Audience): string {
  return `
Full-color illustration for the front cover of a ${audience === "kids" ? "children's" : "adult"} coloring book, portrait orientation.
Concept: ${coverConcept}.
Style: same characters and look as the interior (${styleGuide}), but fully colored with a vibrant, appealing palette, as if a colorist finished one of the pages.
Keep the top 25% of the image calm and uncluttered (a title will be placed there).
Absolutely NO text, letters, titles, logos or watermarks.
`.trim();
}
