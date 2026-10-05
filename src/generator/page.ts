import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { generateImage } from "../lib/gemini.js";
import { getConfig } from "../lib/config.js";
import { interiorPageSize } from "../lib/kdp-specs.js";
import { pageDir, pageId, writePage, bookDir, writeBook } from "../lib/book-store.js";
import { toPrintPage, inkCoverage } from "../postprocess/line-art.js";
import { buildCoverPrompt, buildPagePrompt } from "./prompts.js";
import type { BookMeta, PageMeta, PagePlan } from "../lib/types.js";

export interface Regeneration {
  parent: PageMeta;
  hints: string[];
}

/**
 * Generates one interior page (raw model image + binarized print page) and records
 * it as pending-validation. A regeneration reuses the SAME image model and the
 * book's style guide, adding the validator's hints.
 */
export async function generatePage(book: BookMeta, plan: PagePlan, regen?: Regeneration): Promise<PageMeta> {
  const cfg = getConfig();
  const count = regen ? (regen.parent.regenerationCount ?? 0) + 1 : 0;
  const id = pageId(plan.index, count);
  const prompt = buildPagePrompt(plan.subject, book.styleGuide, book.audience, regen?.hints ?? []);

  const img = await generateImage(prompt, { aspectRatio: "3:4" });
  const raw = Buffer.from(img.base64, "base64");
  const print = await toPrintPage(raw, { page: interiorPageSize(book.trim, book.bleed), marginIn: cfg.book.margin_in });

  const dir = pageDir(book.id, id);
  mkdirSync(dir, { recursive: true });
  const files = { raw: join(dir, "raw.png"), print: join(dir, "print.png") };
  writeFileSync(files.raw, raw);
  writeFileSync(files.print, print);

  const page: PageMeta = {
    id,
    bookId: book.id,
    index: plan.index,
    subject: plan.subject,
    prompt,
    status: "pending-validation",
    createdAt: new Date().toISOString(),
    files,
    inkCoverage: await inkCoverage(print),
    ...(regen ? { regenerationCount: count, parentPageId: regen.parent.id } : {}),
  };
  writePage(page);
  return page;
}

/** Full-color cover art (front panel only). Stored on book.json; always reviewed by a human. */
export async function generateCover(book: BookMeta): Promise<BookMeta> {
  const prompt = buildCoverPrompt(book.coverConcept, book.styleGuide, book.audience);
  const img = await generateImage(prompt, { aspectRatio: "3:4" });
  const dir = join(bookDir(book.id), "cover");
  mkdirSync(dir, { recursive: true });
  const raw = join(dir, "raw.png");
  writeFileSync(raw, Buffer.from(img.base64, "base64"));
  const updated: BookMeta = { ...book, cover: { raw, prompt, createdAt: new Date().toISOString() } };
  writeBook(updated);
  return updated;
}
