/**
 * Assembles the KDP upload package from approved pages + cover art:
 *   output/books/{id}/kdp/{interior.pdf, cover.pdf, listing.json}
 *
 * Uso: pnpm assemble [--book <id>] [--allow-short]
 */
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { getConfig } from "../lib/config.js";
import { getFlag, hasFlag, isMain } from "../lib/args.js";
import { approvedPages, kdpDir, latestBookId, readBook } from "../lib/book-store.js";
import { markAssembled } from "../lib/db.js";
import { interiorPageSize } from "../lib/kdp-specs.js";
import { buildListing } from "../listing/index.js";
import { buildInteriorSequence, renderInterior } from "./interior.js";
import { renderCover } from "./cover.js";

export async function assembleBook(bookId: string, opts: { allowShort?: boolean } = {}): Promise<string> {
  const cfg = getConfig();
  const book = readBook(bookId);
  const pages = approvedPages(bookId);
  const planned = book.pages.length;

  if (pages.length === 0) throw new Error("No hay páginas aprobadas.");
  if (pages.length < planned && !opts.allowShort) {
    throw new Error(
      `Solo ${pages.length}/${planned} páginas aprobadas. Completa con generate/validate/review o usa --allow-short.`
    );
  }
  if (!book.cover) throw new Error("Falta la portada. Ejecuta: pnpm generate --regen-cover");

  const slots = buildInteriorSequence(
    pages.map((p) => p.files.print),
    { belongsTo: book.audience === "kids" && cfg.book.belongs_to_page, singleSided: cfg.book.single_sided }
  );
  const info = { title: book.title, subtitle: book.subtitle, author: book.author, year: new Date().getFullYear() };

  const out = kdpDir(bookId);
  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, "interior.pdf"), await renderInterior(slots, interiorPageSize(book.trim, book.bleed), info));
  writeFileSync(
    join(out, "cover.pdf"),
    await renderCover({ ...info, description: book.description, artFile: book.cover.raw, trim: book.trim, paper: book.paper, pages: slots.length })
  );
  const listing = buildListing(book, slots.length, pages.length, cfg.pricing);
  writeFileSync(join(out, "listing.json"), JSON.stringify(listing, null, 2));
  markAssembled(bookId, slots.length);

  console.log(`\n📦 ${book.title}`);
  console.log(`   ${pages.length} ilustraciones · ${slots.length} páginas · precio sugerido $${listing.pricing.listPriceUsd} (regalía ~$${listing.pricing.estimatedRoyaltyUsd})`);
  console.log(`   ${out}/interior.pdf`);
  console.log(`   ${out}/cover.pdf`);
  console.log(`   ${out}/listing.json`);
  return out;
}

async function main() {
  const bookId = getFlag("book") ?? latestBookId();
  if (!bookId) throw new Error("No hay libros.");
  await assembleBook(bookId, { allowShort: hasFlag("allow-short") });
  console.log(`\n  Siguiente paso: subir los PDFs en kdp.amazon.com siguiendo listing.json → checklist\n`);
}

if (isMain(import.meta.url)) {
  main().catch((err) => {
    console.error("Assembler failed:", err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
