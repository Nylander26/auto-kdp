/**
 * Generates every planned page that has no attempt yet (resumable), plus the cover art.
 *
 * Uso: pnpm generate [--book <id>] [--limit N] [--regen-cover]
 */
import { getFlag, hasFlag, isMain } from "../lib/args.js";
import { latestBookId, listPages, readBook } from "../lib/book-store.js";
import { budgetReport, BudgetExceededError } from "../lib/budget.js";
import { generateCover, generatePage } from "./page.js";

export async function generateBook(bookId: string, opts: { limit?: number; regenCover?: boolean } = {}): Promise<number> {
  let book = readBook(bookId);
  const done = new Set(listPages(bookId).map((p) => p.index));
  const todo = book.pages.filter((p) => !done.has(p.index)).slice(0, opts.limit ?? Infinity);

  console.log(`\n🎨 ${book.title} — ${todo.length} páginas por generar (${done.size} ya existen)`);
  let generated = 0;
  for (const plan of todo) {
    try {
      const page = await generatePage(book, plan);
      generated++;
      console.log(`  ✓ ${page.id}  tinta ${(100 * (page.inkCoverage ?? 0)).toFixed(1)}%  — ${plan.subject}`);
    } catch (err) {
      if (err instanceof BudgetExceededError) throw err;
      console.log(`  ✗ p${plan.index}: ${err instanceof Error ? err.message : err}`);
    }
  }

  if (!book.cover || opts.regenCover) {
    try {
      book = await generateCover(book);
      console.log(`  ✓ portada: ${book.cover?.raw}`);
    } catch (err) {
      if (err instanceof BudgetExceededError) throw err;
      console.log(`  ✗ portada: ${err instanceof Error ? err.message : err}`);
    }
  }
  console.log(`\n  ${budgetReport()}`);
  return generated;
}

async function main() {
  const bookId = getFlag("book") ?? latestBookId();
  if (!bookId) throw new Error("No hay libros. Ejecuta primero: pnpm plan --niche \"...\"");
  const limit = getFlag("limit");
  await generateBook(bookId, { ...(limit ? { limit: parseInt(limit, 10) } : {}), regenCover: hasFlag("regen-cover") });
  console.log(`\n  Siguiente paso: pnpm validate --book ${bookId}\n`);
}

if (isMain(import.meta.url)) {
  main().catch((err) => {
    console.error("Generator failed:", err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
