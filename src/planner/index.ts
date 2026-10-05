/**
 * Plans a coloring book from a niche: title, subtitle, KDP metadata, shared art
 * direction and one subject per page. Writes output/books/{id}/book.json.
 *
 * Uso: pnpm plan --niche "cozy cats" [--audience kids|adults] [--pages 30] [--force]
 */
import { generateJSON } from "../lib/gemini.js";
import { getConfig } from "../lib/config.js";
import { getFlag, hasFlag, isMain, slugify } from "../lib/args.js";
import { writeBook } from "../lib/book-store.js";
import { booksForNiche, recordBook } from "../lib/db.js";
import { buildPlanPrompt, normalizePlan } from "./plan.js";
import type { Audience, BookMeta } from "../lib/types.js";

export async function planBook(niche: string, opts: { audience?: Audience; pages?: number; force?: boolean } = {}): Promise<BookMeta> {
  const cfg = getConfig();
  const audience = opts.audience ?? cfg.book.audience;
  const pages = opts.pages ?? cfg.book.pages;

  const existing = booksForNiche(niche);
  if (existing.length > 0 && !opts.force) {
    throw new Error(
      `Ya hay ${existing.length} libro(s) para "${niche}": ${existing.map((b) => b.id).join(", ")}. Usa --force para otro.`
    );
  }

  console.log(`\n🧠 Planificando libro: "${niche}" (${audience}, ${pages} páginas)...`);
  const raw = await generateJSON<Record<string, unknown>>(buildPlanPrompt(niche, audience, pages, cfg.market.country));
  const plan = normalizePlan(raw, pages);

  const createdAt = new Date().toISOString();
  const book: BookMeta = {
    ...plan,
    id: `${slugify(niche)}-${createdAt.slice(0, 10).replace(/-/g, "")}${existing.length > 0 ? `-${existing.length + 1}` : ""}`,
    niche,
    audience,
    author: cfg.book.author,
    trim: cfg.book.trim,
    paper: cfg.book.paper,
    bleed: cfg.book.bleed,
    createdAt,
  };
  writeBook(book);
  recordBook(book);
  return book;
}

export function printPlan(book: BookMeta): void {
  console.log(`\n📘 ${book.title}`);
  console.log(`   ${book.subtitle}`);
  console.log(`   id: ${book.id}`);
  console.log(`   Estilo: ${book.styleGuide}`);
  console.log(`   Portada: ${book.coverConcept}`);
  console.log(`   Keywords: ${book.keywords.join(" · ")}`);
  console.log(`   Páginas (${book.pages.length}):`);
  for (const p of book.pages) console.log(`     ${String(p.index).padStart(2)}. ${p.subject}`);
}

async function main() {
  const niche = getFlag("niche");
  if (!niche || niche === "true") {
    console.error('Uso: pnpm plan --niche "cozy cats" [--audience kids|adults] [--pages 30] [--force]');
    process.exit(1);
  }
  const audience = getFlag("audience") as Audience | undefined;
  if (audience && audience !== "kids" && audience !== "adults") throw new Error("--audience debe ser kids o adults");
  const pagesFlag = getFlag("pages");
  const book = await planBook(niche, {
    ...(audience ? { audience } : {}),
    ...(pagesFlag ? { pages: parseInt(pagesFlag, 10) } : {}),
    force: hasFlag("force"),
  });
  printPlan(book);
  console.log(`\n  Siguiente paso: pnpm generate --book ${book.id}\n`);
}

if (isMain(import.meta.url)) {
  main().catch((err) => {
    console.error("Planner failed:", err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
