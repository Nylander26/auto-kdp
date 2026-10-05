/**
 * Book concept prompt + normalization of the model's JSON into KDP-safe metadata.
 */
import type { Audience, BookPlan, PagePlan } from "../lib/types.js";

// KDP: title + subtitle together must stay under 200 characters; 7 keyword slots of
// up to 50 characters each.
export const MAX_TITLE_SUBTITLE = 200;
export const KEYWORD_SLOTS = 7;
export const MAX_KEYWORD_LEN = 50;

export function buildPlanPrompt(niche: string, audience: Audience, pages: number, country: string): string {
  const who =
    audience === "kids"
      ? "children aged 4-8 (simple, friendly, big shapes, nothing scary)"
      : "adults who color to relax (detailed, intricate, calming)";
  return `
You are an expert Amazon KDP publisher of best-selling coloring books for the ${country} market.

Plan a coloring book for the niche: "${niche}".
Audience: ${who}.
Number of illustrations: ${pages}.

Rules:
- Title: the main search phrase buyers type on Amazon, natural (not keyword-stuffed). Include "Coloring Book".
- Subtitle: benefit + audience + count, e.g. "${pages} Relaxing Designs for Stress Relief".
- Title + subtitle under ${MAX_TITLE_SUBTITLE} characters together.
- No trademarked characters, brands, franchises or celebrity names anywhere.
- description: 120-200 words, simple HTML only (<b>, <i>, <br>, <ul><li>). Mention single-sided pages and the page size 8.5 x 11.
- keywords: exactly ${KEYWORD_SLOTS} long-tail search phrases (<= ${MAX_KEYWORD_LEN} chars each) NOT repeating words from the title.
- categories: 3 Amazon browse paths, e.g. "Books > Crafts, Hobbies & Home > Coloring Books for Grown-Ups > Animals".
- styleGuide: ONE art direction for every page (line weight, level of detail, background treatment, mood) so the book looks consistent.
- coverConcept: a full-color cover illustration idea (no text — the title is added later).
- pages: ${pages} DISTINCT subjects, each a concrete scene in one sentence; vary poses, settings and composition; avoid repeating the same scene.

Return strict JSON:
{
  "title": string,
  "subtitle": string,
  "description": string,
  "keywords": string[],
  "categories": string[],
  "styleGuide": string,
  "coverConcept": string,
  "pages": [{ "subject": string }]
}
`.trim();
}

interface RawPlan {
  title?: unknown;
  subtitle?: unknown;
  description?: unknown;
  keywords?: unknown;
  categories?: unknown;
  styleGuide?: unknown;
  coverConcept?: unknown;
  pages?: unknown;
}

const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");
const strArr = (v: unknown): string[] =>
  Array.isArray(v) ? v.map((x) => (typeof x === "string" ? x : str((x as { subject?: unknown })?.subject))).map((s) => s.trim()).filter(Boolean) : [];

/**
 * Coerces the model output into a valid BookPlan: dedupes subjects, caps keywords to
 * KDP's slots/length, trims the subtitle so title+subtitle fits, renumbers pages.
 * Throws when the essentials (title, enough pages) are missing.
 */
export function normalizePlan(raw: RawPlan, wantedPages: number): BookPlan {
  const title = str(raw.title);
  if (!title) throw new Error("El plan no tiene título");

  let subtitle = str(raw.subtitle);
  const room = MAX_TITLE_SUBTITLE - title.length - 1;
  if (subtitle.length > room) subtitle = subtitle.slice(0, Math.max(0, room)).replace(/\s+\S*$/, "").trim();

  const seen = new Set<string>();
  const subjects = strArr(raw.pages).filter((s) => {
    const key = s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const minPages = Math.ceil(wantedPages * 0.8);
  if (subjects.length < minPages) {
    throw new Error(`El plan trae ${subjects.length} páginas distintas (mínimo ${minPages})`);
  }
  const pages: PagePlan[] = subjects.slice(0, wantedPages).map((subject, i) => ({ index: i + 1, subject }));

  const kwSeen = new Set<string>();
  const keywords = strArr(raw.keywords)
    .map((k) => k.slice(0, MAX_KEYWORD_LEN).trim())
    .filter((k) => {
      const key = k.toLowerCase();
      if (kwSeen.has(key)) return false;
      kwSeen.add(key);
      return true;
    })
    .slice(0, KEYWORD_SLOTS);

  return {
    title,
    subtitle,
    description: str(raw.description),
    keywords,
    categories: strArr(raw.categories).slice(0, 3),
    styleGuide: str(raw.styleGuide),
    coverConcept: str(raw.coverConcept),
    pages,
  };
}
