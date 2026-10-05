/**
 * Validates every pending-validation page of a book.
 *
 *   approved (>= approval_threshold) → approved            (auto_approve_passing=true)
 *   borderline / approved w/o auto   → pending-review      (pnpm review)
 *   rejected → regenerate with the SAME image model + hints, up to max_regenerations,
 *              then rejected                               (auto_regenerate=true)
 *
 * Uso: pnpm validate [--book <id>]
 */
import { readFileSync } from "fs";
import sharp from "sharp";
import { analyzeImage } from "../lib/gemini.js";
import { getConfig } from "../lib/config.js";
import { getFlag, isMain } from "../lib/args.js";
import { latestBookId, listPages, readBook, writePage } from "../lib/book-store.js";
import { budgetReport, BudgetExceededError } from "../lib/budget.js";
import { generatePage } from "../generator/page.js";
import { buildValidatorPrompt, inkCheck, normalizeValidation } from "./criteria.js";
import type { BookMeta, PageMeta, ValidationResult } from "../lib/types.js";

export interface ValidationSummary {
  approved: number;
  pendingReview: number;
  rejected: number;
  regenerated: number;
}

export async function validatePage(book: BookMeta, page: PageMeta): Promise<ValidationResult> {
  const pre = inkCheck(page.inkCoverage ?? 0);
  if (pre) return pre;
  // The binarized print page is what gets printed; 1200px is plenty for the model.
  const jpeg = await sharp(readFileSync(page.files.print)).resize(1200, 1200, { fit: "inside" }).jpeg({ quality: 85 }).toBuffer();
  const raw = await analyzeImage<Parameters<typeof normalizeValidation>[0]>(
    jpeg.toString("base64"),
    "image/jpeg",
    buildValidatorPrompt(page.subject, book.styleGuide, book.audience)
  );
  return normalizeValidation(raw, getConfig().validator.vision_model);
}

/** Regenerates a rejected page if the cap allows. Returns the new page or null. */
export async function regeneratePage(book: BookMeta, page: PageMeta, v: ValidationResult): Promise<PageMeta | null> {
  if ((page.regenerationCount ?? 0) >= getConfig().validator.max_regenerations) return null;
  const plan = book.pages.find((p) => p.index === page.index) ?? { index: page.index, subject: page.subject };
  const next = await generatePage(book, plan, { parent: page, hints: [...v.reasons.blockers, ...v.suggestedImprovements] });
  writePage({ ...page, status: "rejected", validation: v }); // superseded by its successor
  return next;
}

export async function validateBook(bookId: string): Promise<ValidationSummary> {
  const cfg = getConfig().validator;
  const book = readBook(bookId);
  const queue = listPages(bookId, (p) => p.status === "pending-validation");
  const s: ValidationSummary = { approved: 0, pendingReview: 0, rejected: 0, regenerated: 0 };

  console.log(`\n🔎 ${book.title} — ${queue.length} páginas por validar`);
  while (queue.length > 0) {
    const page = queue.shift() as PageMeta;
    let v: ValidationResult;
    try {
      v = await validatePage(book, page);
    } catch (err) {
      if (err instanceof BudgetExceededError) throw err;
      console.log(`  ⚠️  ${page.id}: validación falló (${err instanceof Error ? err.message : err}) — queda pendiente`);
      continue;
    }
    const tag = `${page.id} ${v.verdict} ${v.scores.overall.toFixed(1)}`;

    if (v.verdict === "approved" && cfg.auto_approve_passing) {
      writePage({ ...page, status: "approved", validation: v });
      s.approved++;
      console.log(`  ✅ ${tag}`);
    } else if (v.verdict !== "rejected") {
      writePage({ ...page, status: "pending-review", validation: v });
      s.pendingReview++;
      console.log(`  👀 ${tag} → revisión manual`);
    } else {
      const next = cfg.auto_regenerate ? await regeneratePage(book, page, v).catch((err) => {
        if (err instanceof BudgetExceededError) throw err;
        return null;
      }) : null;
      if (next) {
        s.regenerated++;
        queue.push(next);
        console.log(`  🔄 ${tag} — ${v.reasons.blockers.join("; ") || "bajo umbral"} → ${next.id}`);
      } else {
        writePage({ ...page, status: "rejected", validation: v });
        s.rejected++;
        console.log(`  ❌ ${tag} — ${v.reasons.blockers.join("; ") || "bajo umbral"} (sin más intentos)`);
      }
    }
  }
  console.log(`\n  ✅ ${s.approved} aprobadas · 👀 ${s.pendingReview} a revisión · ❌ ${s.rejected} rechazadas · 🔄 ${s.regenerated} regeneradas`);
  console.log(`  ${budgetReport()}`);
  return s;
}

async function main() {
  const bookId = getFlag("book") ?? latestBookId();
  if (!bookId) throw new Error("No hay libros.");
  const s = await validateBook(bookId);
  console.log(`\n  Siguiente paso: ${s.pendingReview > 0 ? "pnpm review" : "pnpm assemble"} --book ${bookId}\n`);
}

if (isMain(import.meta.url)) {
  main().catch((err) => {
    console.error("Validator failed:", err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
