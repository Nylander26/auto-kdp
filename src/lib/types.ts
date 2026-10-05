import type { PaperType, TrimSize } from "./kdp-specs.js";

export type Audience = "kids" | "adults";

export type PageStatus =
  | "pending-validation" // generated, awaiting the AI validator
  | "pending-review"     // borderline or force-approved — needs a human
  | "approved"           // goes into the interior PDF
  | "rejected";          // dropped (or superseded by a regeneration)

export interface PagePlan {
  index: number;   // 1-based position in the book
  subject: string; // e.g. "a sleepy fox curled up in autumn leaves"
}

export interface BookPlan {
  title: string;
  subtitle: string;
  description: string; // KDP description (simple HTML allowed: <b>, <i>, <br>, <ul><li>)
  keywords: string[];  // KDP allows 7 keyword slots
  categories: string[];
  styleGuide: string;  // one shared art direction so every page looks like the same book
  coverConcept: string;
  pages: PagePlan[];
}

export interface BookMeta extends BookPlan {
  id: string;
  niche: string;
  audience: Audience;
  author: string;
  trim: TrimSize;
  paper: PaperType;
  bleed: boolean;
  createdAt: string;
  cover?: { raw: string; prompt: string; createdAt: string };
}

export interface ValidationScores {
  lineQuality: number;     // clean, closed, consistent black outlines
  colorability: number;    // regions big enough to color, no solid fills / gray
  subjectFidelity: number; // depicts the planned subject, no anatomy glitches
  audienceFit: number;     // complexity matches kids vs adults
  overall: number;
}

export interface ValidationResult {
  verdict: "approved" | "borderline" | "rejected";
  scores: ValidationScores;
  reasons: { strengths: string[]; concerns: string[]; blockers: string[] };
  suggestedImprovements: string[];
  evaluatedAt: string;
  model: string;
}

export interface PageMeta {
  id: string; // "p03", regenerations "p03-r1", "p03-r2"
  bookId: string;
  index: number;
  subject: string;
  prompt: string;
  status: PageStatus;
  createdAt: string;
  files: { raw: string; print: string };
  inkCoverage?: number;
  validation?: ValidationResult;
  regenerationCount?: number;
  parentPageId?: string;
  forceApproved?: boolean;
}
